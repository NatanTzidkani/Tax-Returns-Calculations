import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  AliyahInput,
  CalculateRequest,
  ChildInput,
  DegreeInput,
  ParentContext,
} from '@taxreturns/shared';
import type { TaxpayerInput } from '@taxreturns/tax-engine';
import { eq } from 'drizzle-orm';
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
// Type-drift guard (plan 2026-07-14-credit-points-wiring.md, Phase A1).
//
// mapConfirmedData passes `CalculateRequest['taxpayer']` STRAIGHT into the
// engine's `TaxYearInput.taxpayer`, and structural typing would NOT reject a
// typo'd optional key in the Zod schema — it would silently never reach the
// engine. These compile-time equality assertions pin the shared schemas'
// inferred types to the engine's `TaxpayerInput` contract exactly.
// ---------------------------------------------------------------------------

type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

type Taxpayer = CalculateRequest['taxpayer'];

// Whole-field equality (also fails to compile if the taxpayer key is typo'd,
// because the indexed access itself would not resolve):
type _ChildrenField = Expect<Equal<Taxpayer['children'], TaxpayerInput['children']>>;
type _ParentContextField = Expect<
  Equal<Taxpayer['parentContext'], TaxpayerInput['parentContext']>
>;
type _AliyahField = Expect<Equal<Taxpayer['aliyah'], TaxpayerInput['aliyah']>>;
type _DegreesField = Expect<Equal<Taxpayer['degrees'], TaxpayerInput['degrees']>>;

// Element-type equality for the exported shared types. The il-0.6.0 child
// element is `{ ageInTaxYear; maintenanceShare?; deferBirthYearPoint?;
// claimDeferredBirthYearPoint? }` — `role` is REMOVED, so this assertion
// also rejects any resurrected `role` key:
type _ChildElement = Expect<
  Equal<ChildInput, NonNullable<TaxpayerInput['children']>[number]>
>;
type _ParentContextShape = Expect<
  Equal<ParentContext, NonNullable<TaxpayerInput['parentContext']>>
>;
type _AliyahShape = Expect<Equal<AliyahInput, NonNullable<TaxpayerInput['aliyah']>>>;
type _DegreeElement = Expect<
  Equal<DegreeInput, NonNullable<TaxpayerInput['degrees']>[number]>
>;

// ---------------------------------------------------------------------------
// Route tests: structured credit-point inputs flow request → engine →
// append-only snapshot; engine legal errors come back as Hebrew 400s.
// Own test database — the pipeline suite owns `taxreturns_test` and vitest
// runs test files in parallel.
// ---------------------------------------------------------------------------

const ADMIN_URL = 'postgresql://tax:tax@host.docker.internal:5432/taxreturns';
const TEST_DB = 'taxreturns_test_credit_points';
const TEST_URL = `postgresql://tax:tax@host.docker.internal:5432/${TEST_DB}`;

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../drizzle',
);

/** Extraction is never exercised here — fail loudly if a test drifts into it. */
const unusedExtractionClient: ExtractionClient = {
  messages: {
    parse: async () => {
      throw new Error('extraction must not be called in credit-points wiring tests');
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

beforeAll(async () => {
  adminPool = new pg.Pool({ connectionString: ADMIN_URL, max: 1 });
  await adminPool.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
  await adminPool.query(`CREATE DATABASE ${TEST_DB}`);

  pool = new pg.Pool({ connectionString: TEST_URL });
  db = drizzle(pool, { schema });
  await migrate(db, { migrationsFolder });

  storageDir = await mkdtemp(path.join(tmpdir(), 'taxreturns-cp-storage-'));
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

async function calculate(taxpayer: Record<string, unknown>) {
  return authedInject({
    method: 'POST',
    url: `/tax-years/${taxYearId}/calculate`,
    payload: { taxpayer },
  });
}

async function snapshotCount(): Promise<number> {
  const rows = await db
    .select()
    .from(schema.calculations)
    .where(eq(schema.calculations.taxYearId, taxYearId));
  return rows.length;
}

describe('POST /tax-years/:id/calculate — structured credit-point inputs', () => {
  it('a child age 2 under marriedRegisteredSpouse flows to the engine (6.75 points) and into the snapshot input', async () => {
    const res = await calculate({
      gender: 'male',
      parentContext: { regime: 'marriedRegisteredSpouse' },
      children: [{ ageInTaxYear: 2 }],
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    // resident base 2.25 + child age 2 (4.5 pts, Schedule A via §66(ג)(4) —
    // engine rules credit-points-tables.ts CHILD_POINT_TWELFTHS[2] = 54/12,
    // routed by rules/child-allocation.ts) = 6.75 (mirrors the engine's own
    // credit-points.test.ts case).
    expect(body.result.creditPoints.points).toBe(6.75);
    const childRow = body.result.creditPoints.breakdown.find(
      (row: { reason: string }) => row.reason === 'child',
    );
    expect(childRow).toMatchObject({ points: 4.5 });

    // The append-only snapshot's stored input carries the structured fields
    // verbatim (audit trail) — both in the response and in the DB row.
    const expectedTaxpayer = {
      gender: 'male',
      isIsraeliResident: true,
      additionalCreditPoints: 0,
      parentContext: { regime: 'marriedRegisteredSpouse' },
      children: [{ ageInTaxYear: 2 }],
    };
    expect(body.input.taxpayer).toEqual(expectedTaxpayer);

    const [stored] = await db
      .select()
      .from(schema.calculations)
      .where(eq(schema.calculations.id, body.id));
    expect((stored!.input as { taxpayer: unknown }).taxpayer).toEqual(expectedTaxpayer);
  });

  it('a child age 7 (unverified 6-17 band) → 400 with the engine Hebrew-prefixed message, no snapshot', async () => {
    const before = await snapshotCount();
    const res = await calculate({
      gender: 'male',
      parentContext: { regime: 'marriedRegisteredSpouse' },
      children: [{ ageInTaxYear: 7 }],
    });
    expect(res.statusCode).toBe(400);
    const message: string = res.json().message;
    expect(message).toMatch(/[֐-׿]/);
    expect(message).toContain('שגיאה בחישוב');
    expect(message).toContain('6-17'); // the engine's disabled-band reason
    expect(await snapshotCount()).toBe(before);
  });

  it('children WITHOUT parentContext → 400 with the engine Hebrew-prefixed message, no snapshot', async () => {
    // The engine (not Zod) owns the children-require-parentContext rule —
    // it never infers the §66(ג)/§40 regime.
    const before = await snapshotCount();
    const res = await calculate({
      gender: 'male',
      children: [{ ageInTaxYear: 2 }],
    });
    expect(res.statusCode).toBe(400);
    const message: string = res.json().message;
    expect(message).toMatch(/[֐-׿]/);
    expect(message).toContain('שגיאה בחישוב');
    expect(message).toContain('parentContext');
    expect(await snapshotCount()).toBe(before);
  });

  it('a father regime (marriedOtherSpouse, disabled Schedule B) → 400 not-yet-owner-verified, no snapshot', async () => {
    const before = await snapshotCount();
    const res = await calculate({
      gender: 'male',
      parentContext: { regime: 'marriedOtherSpouse' },
      children: [{ ageInTaxYear: 2 }],
    });
    expect(res.statusCode).toBe(400);
    const message: string = res.json().message;
    expect(message).toContain('שגיאה בחישוב');
    expect(message).toContain('not yet owner-verified'); // פעוט range dispute
    expect(await snapshotCount()).toBe(before);
  });

  it('singleParent: the §40(ב)(1ב) bonus row appears and the snapshot stores parentContext', async () => {
    const res = await calculate({
      gender: 'male',
      parentContext: { regime: 'singleParent' },
      children: [{ ageInTaxYear: 2 }],
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    // 27 (resident man) + 54 (age 2, Schedule A) + 12 (§40(ב)(1ב) bonus)
    // = 93 twelfths = 7.75 pts (mirrors the engine's credit-points.test.ts
    // singleParent case).
    expect(body.result.creditPoints.points).toBe(7.75);
    const bonusRow = body.result.creditPoints.breakdown.find(
      (row: { reason: string }) => row.reason === 'singleParentBonus',
    );
    expect(bonusRow).toMatchObject({ points: 1 });

    expect(body.input.taxpayer.parentContext).toEqual({ regime: 'singleParent' });
    const [stored] = await db
      .select()
      .from(schema.calculations)
      .where(eq(schema.calculations.id, body.id));
    expect(
      (stored!.input as { taxpayer: { parentContext: unknown } }).taxpayer.parentContext,
    ).toEqual({ regime: 'singleParent' });
  });

  it('vocational + bachelor degrees (§7(ג) exclusivity) → 400 Hebrew-prefixed, no snapshot', async () => {
    const before = await snapshotCount();
    const res = await calculate({
      gender: 'male',
      degrees: [
        { track: 'vocational', completionYear: 2023, studyYears: 3 },
        { track: 'bachelor', completionYear: 2023, studyYears: 3 },
      ],
    });
    expect(res.statusCode).toBe(400);
    const message: string = res.json().message;
    expect(message).toMatch(/[֐-׿]/);
    expect(message).toContain('שגיאה בחישוב');
    expect(message).toContain('vocational');
    expect(await snapshotCount()).toBe(before);
  });

  it('children + aliyah + degrees + additionalCreditPoints combine to the exact engine total', async () => {
    // Expected points for tax year 2025, derived from the engine's own rules
    // modules (never invented):
    //   resident base (credit-points.ts RESIDENT_TWELFTHS)          2.25
    //   female (FEMALE_TWELFTHS)                                    0.50
    //   child age 2, Schedule A via marriedRegisteredSpouse
    //     (CHILD_POINT_TWELFTHS[2] = 54)                            4.50
    //   child age 4, same Schedule A (CHILD_POINT_TWELFTHS[4] = 30) 2.50
    //   aliyah 7/2024 'from2022' (credit-points-tables.ts
    //     OLEH_SCHEDULES.from2022): 2025 covers schedule months
    //     7-18 → 6×(1/12) + 6×(3/12) = 24 twelfths                  2.00
    //   bachelor, completion 2023, 3 study years
    //     (degree-credit-points.ts DEGREE_TRACKS.bachelor):
    //     window 2024-2026 → 2025 is year 2 of 3, 1 pt/yr           1.00
    //   additionalCreditPoints                                      0.75
    //                                                       total  13.50
    // (Same numbers as before il-0.6.0: the engine's own re-expressed test —
    // credit-points.test.ts 'resident woman, marriedRegisteredSpouse,
    // children 2 & 4' — confirms ages 2/4 keep 4.5/2.5 under Schedule A;
    // marriedRegisteredSpouse without flags adds no flat rows.)
    const res = await calculate({
      gender: 'female',
      additionalCreditPoints: 0.75,
      parentContext: { regime: 'marriedRegisteredSpouse' },
      children: [{ ageInTaxYear: 2 }, { ageInTaxYear: 4 }],
      aliyah: { aliyahYear: 2024, aliyahMonth: 7, scheduleVariant: 'from2022' },
      degrees: [{ track: 'bachelor', completionYear: 2023, studyYears: 3 }],
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.result.creditPoints.points).toBe(13.5);
    expect(
      body.result.creditPoints.breakdown.map((row: { reason: string }) => row.reason),
    ).toEqual([
      'resident',
      'female',
      'child',
      'child',
      'oleh',
      'degree',
      'additional',
    ]);
  });

  it('omitting the structured fields keeps them out of the snapshot input (undefined, never [])', async () => {
    const res = await calculate({ gender: 'male' });
    expect(res.statusCode).toBe(200);
    const taxpayer = res.json().input.taxpayer;
    expect('children' in taxpayer).toBe(false);
    expect('parentContext' in taxpayer).toBe(false);
    expect('aliyah' in taxpayer).toBe(false);
    expect('degrees' in taxpayer).toBe(false);
    expect(res.json().result.creditPoints.points).toBe(2.25);
  });
});
