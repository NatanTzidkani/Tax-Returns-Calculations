import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TaxpayerProfile } from '@taxreturns/shared';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import * as schema from '../src/db/schema';
import type { ExtractionClient } from '../src/extraction/extractor';
import { LocalDiskStorage } from '../src/storage/local-disk';
import { authedInjector, fakeGoogleVerifier, signInAndGetCookie } from './helpers/auth';

// ---------------------------------------------------------------------------
// Taxpayer profile store (plan 2026-07-14-taxpayer-profile.md, Phase B).
// The profile is a PRE-FILL convenience store: GET/PUT /profile only. The
// architectural rule under test everywhere here: the calculate route NEVER
// reads the profile, and the profile routes NEVER touch calculations.
// Own test database — pipeline/credit-points suites own theirs and vitest
// runs files in parallel.
// ---------------------------------------------------------------------------

const ADMIN_URL = 'postgresql://tax:tax@host.docker.internal:5432/taxreturns';
const TEST_DB = 'taxreturns_test_profile';
const TEST_URL = `postgresql://tax:tax@host.docker.internal:5432/${TEST_DB}`;

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../drizzle',
);

const unusedExtractionClient: ExtractionClient = {
  messages: {
    parse: async () => {
      throw new Error('extraction must not be called in taxpayer-profile tests');
    },
  },
};

let adminPool: pg.Pool;
let pool: pg.Pool;
let db: NodePgDatabase<typeof schema>;
let storageDir: string;
let app: FastifyInstance;
let taxYearId: string;
let authedInject: (opts: InjectOptions) => Promise<LightMyRequestResponse>;

const fullProfile: TaxpayerProfile = {
  gender: 'female',
  isIsraeliResident: true,
  children: [{ yearOfBirth: 2020 }, { yearOfBirth: 2017, maintenanceShare: 0.4 }],
  parentContext: { regime: 'marriedRegisteredSpouse' },
  aliyah: { aliyahYear: 2023, aliyahMonth: 7, scheduleVariant: 'from2022' },
  degrees: [{ track: 'bachelor', completionYear: 2023, studyYears: 3 }],
};

beforeAll(async () => {
  adminPool = new pg.Pool({ connectionString: ADMIN_URL, max: 1 });
  await adminPool.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
  await adminPool.query(`CREATE DATABASE ${TEST_DB}`);

  pool = new pg.Pool({ connectionString: TEST_URL });
  db = drizzle(pool, { schema });
  await migrate(db, { migrationsFolder });

  storageDir = await mkdtemp(path.join(tmpdir(), 'taxreturns-profile-storage-'));
  app = buildApp({
    db,
    storage: new LocalDiskStorage(storageDir),
    anthropic: unusedExtractionClient,
    googleVerifier: fakeGoogleVerifier(),
  });
  const cookie = await signInAndGetCookie(app);
  authedInject = authedInjector(app, cookie);

  const created = await authedInject({
    method: 'POST',
    url: '/tax-years',
    payload: { year: 2025 },
  });
  expect(created.statusCode).toBe(201);
  taxYearId = created.json().id;
}, 120_000);

afterAll(async () => {
  await app?.close();
  await pool?.end();
  if (adminPool) {
    await adminPool.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
    await adminPool.end();
  }
  if (storageDir) await rm(storageDir, { recursive: true, force: true });
});

async function profileRowCount(): Promise<number> {
  return (await db.select().from(schema.taxpayerProfiles)).length;
}

async function calculationRowCount(): Promise<number> {
  return (await db.select().from(schema.calculations)).length;
}

describe('GET/PUT /profile — the pre-fill store', () => {
  it('GET with no stored profile → 404 with a Hebrew message', async () => {
    const res = await authedInject({ method: 'GET', url: '/profile' });
    expect(res.statusCode).toBe(404);
    expect(res.json().message).toMatch(/[֐-׿]/);
  });

  it('unauthenticated GET and PUT → 401 (global fail-closed gate)', async () => {
    const get = await app.inject({ method: 'GET', url: '/profile' });
    expect(get.statusCode).toBe(401);
    const put = await app.inject({
      method: 'PUT',
      url: '/profile',
      payload: fullProfile,
    });
    expect(put.statusCode).toBe(401);
  });

  it('PUT a valid profile → 200 {payload, updatedAt}; GET returns it', async () => {
    const put = await authedInject({
      method: 'PUT',
      url: '/profile',
      payload: fullProfile,
    });
    expect(put.statusCode).toBe(200);
    expect(put.json().payload).toEqual(fullProfile);
    expect(typeof put.json().updatedAt).toBe('string');

    const get = await authedInject({ method: 'GET', url: '/profile' });
    expect(get.statusCode).toBe(200);
    expect(get.json().payload).toEqual(fullProfile);
  });

  it('a second PUT updates the SAME row (upsert converges — never a second row)', async () => {
    const updated: TaxpayerProfile = {
      gender: 'female',
      isIsraeliResident: true,
      children: [{ yearOfBirth: 2020 }],
    };
    const put = await authedInject({
      method: 'PUT',
      url: '/profile',
      payload: updated,
    });
    expect(put.statusCode).toBe(200);
    expect(put.json().payload).toEqual(updated);
    expect(await profileRowCount()).toBe(1);

    const get = await authedInject({ method: 'GET', url: '/profile' });
    expect(get.json().payload).toEqual(updated);
  });

  it('PUT with ageInTaxYear on a child → 400 Hebrew, stored row untouched', async () => {
    const before = await authedInject({ method: 'GET', url: '/profile' });
    const res = await authedInject({
      method: 'PUT',
      url: '/profile',
      payload: {
        gender: 'male',
        children: [{ yearOfBirth: 2020, ageInTaxYear: 5 }],
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toMatch(/[֐-׿]/);
    const after = await authedInject({ method: 'GET', url: '/profile' });
    expect(after.json().payload).toEqual(before.json().payload);
  });

  it('PUT with aliyah month 13 → 400 Hebrew', async () => {
    const res = await authedInject({
      method: 'PUT',
      url: '/profile',
      payload: {
        gender: 'male',
        aliyah: { aliyahYear: 2023, aliyahMonth: 13, scheduleVariant: 'from2022' },
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toMatch(/[֐-׿]/);
  });
});

describe('calculate ↔ profile isolation (the architectural rule)', () => {
  it('a calculate with a bare taxpayer body ignores the stored profile entirely', async () => {
    // The stored profile (from the tests above) is full of children/degrees.
    // A bare calculate body must produce a snapshot whose input.taxpayer has
    // NO profile-derived fields — proving no server-side merge exists.
    const res = await authedInject({
      method: 'POST',
      url: `/tax-years/${taxYearId}/calculate`,
      payload: { taxpayer: { gender: 'male' } },
    });
    expect(res.statusCode).toBe(200);
    const storedTaxpayer = res.json().input.taxpayer;
    expect(storedTaxpayer).toEqual({
      gender: 'male',
      isIsraeliResident: true,
      additionalCreditPoints: 0,
    });
    expect('children' in storedTaxpayer).toBe(false);
    expect('parentContext' in storedTaxpayer).toBe(false);
  });

  it('PUT /profile creates no calculations row', async () => {
    const before = await calculationRowCount();
    const res = await authedInject({
      method: 'PUT',
      url: '/profile',
      payload: fullProfile,
    });
    expect(res.statusCode).toBe(200);
    expect(await calculationRowCount()).toBe(before);
  });
});
