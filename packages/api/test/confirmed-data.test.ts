import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
// GET /tax-years/:id/confirmed-data — the data panel's projection (plan
// 2026-07-16-confirmed-data-panel.md): the SAME mapConfirmedData the
// calculate route uses, document-derived fields only. Own test database —
// sibling suites own theirs and vitest runs files in parallel.
// ---------------------------------------------------------------------------

const ADMIN_URL = 'postgresql://tax:tax@host.docker.internal:5432/taxreturns';
const TEST_DB = 'taxreturns_test_confirmed_data';
const TEST_URL = `postgresql://tax:tax@host.docker.internal:5432/${TEST_DB}`;

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../drizzle',
);

const unusedExtractionClient: ExtractionClient = {
  messages: {
    parse: async () => {
      throw new Error('extraction must not be called in confirmed-data tests');
    },
  },
};

let adminPool: pg.Pool;
let pool: pg.Pool;
let db: NodePgDatabase<typeof schema>;
let storageDir: string;
let app: FastifyInstance;
let taxYearId: string;
let userId: string;
let authedInject: (opts: InjectOptions) => Promise<LightMyRequestResponse>;

/** Inserts a document row + a confirmed_data payload for it directly (the
 *  route under test only READS; the confirm flow is pipeline.test.ts's). */
async function insertConfirmedDocument(
  kind: 'form106' | 'form867' | 'charity_receipt',
  payload: unknown,
  confirmedAt: Date,
): Promise<string> {
  const [doc] = await db
    .insert(schema.documents)
    .values({
      taxYearId,
      kind,
      storageKey: `test/${kind}-${confirmedAt.getTime()}`,
      originalFilename: `${kind}.pdf`,
      extractionStatus: 'confirmed',
    })
    .returning();
  await db
    .insert(schema.confirmedData)
    .values({ documentId: doc!.id, payload, confirmedAt });
  return doc!.id;
}

beforeAll(async () => {
  adminPool = new pg.Pool({ connectionString: ADMIN_URL, max: 1 });
  await adminPool.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
  await adminPool.query(`CREATE DATABASE ${TEST_DB}`);

  pool = new pg.Pool({ connectionString: TEST_URL });
  db = drizzle(pool, { schema });
  await migrate(db, { migrationsFolder });

  storageDir = await mkdtemp(path.join(tmpdir(), 'taxreturns-cd-storage-'));
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
  const [yearRow] = await db
    .select()
    .from(schema.taxYears)
    .where(eq(schema.taxYears.id, taxYearId));
  userId = yearRow!.userId;
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

describe('GET /tax-years/:id/confirmed-data', () => {
  it('unauthenticated → 401 (global fail-closed gate)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/tax-years/${taxYearId}/confirmed-data`,
    });
    expect(res.statusCode).toBe(401);
  });

  it('an unknown year id → 404 Hebrew', async () => {
    const res = await authedInject({
      method: 'GET',
      url: '/tax-years/00000000-0000-0000-0000-000000000000/confirmed-data',
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().message).toMatch(/[֐-׿]/);
  });

  it('a year with no confirmed documents → empty projection with 0s', async () => {
    const res = await authedInject({
      method: 'GET',
      url: `/tax-years/${taxYearId}/confirmed-data`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      salaries: [],
      donations: [],
      excludedDonations: 0,
      capital: { entries: [], lossCarryforwardInAgorot: 0 },
    });
  });

  it('maps confirmed 106/867/receipts exactly like the calculate route (latest payload wins)', async () => {
    const base = {
      taxYear: 2025,
      employerDeductionsFileId: '123456789',
      employeeNationalId: '012345678',
      uncertainBoxes: [],
    };
    const docId = await insertConfirmedDocument(
      'form106',
      {
        ...base,
        employerName: 'אקמי בע"מ',
        boxes: { '158': 10_000_000, '042': 900_000, '045': 500_000 },
      },
      new Date('2026-07-01T10:00:00Z'),
    );
    // A LATER confirmation of the SAME document supersedes the first.
    await db.insert(schema.confirmedData).values({
      documentId: docId,
      payload: {
        ...base,
        employerName: 'אקמי בע"מ',
        boxes: { '158': 12_000_000, '042': 1_200_000, '045': 720_000 },
      },
      confirmedAt: new Date('2026-07-02T10:00:00Z'),
    });
    await insertConfirmedDocument(
      'form867',
      {
        taxYear: 2025,
        brokerName: 'ברוקר',
        realGainsAgorot: 100_000,
        realLossesAgorot: 500_000,
        interestDividendAgorot: 20_000,
        taxWithheldAgorot: 25_000,
        uncertainFields: [],
      },
      new Date('2026-07-01T11:00:00Z'),
    );
    await insertConfirmedDocument(
      'charity_receipt',
      {
        taxYear: 2025,
        institutionName: 'עמותה',
        amountAgorot: 100_000,
        hasSection46Approval: true,
        uncertainFields: [],
      },
      new Date('2026-07-01T12:00:00Z'),
    );
    await insertConfirmedDocument(
      'charity_receipt',
      {
        taxYear: 2025,
        institutionName: 'עמותה בלי אישור',
        amountAgorot: 50_000,
        hasSection46Approval: false,
        uncertainFields: [],
      },
      new Date('2026-07-01T13:00:00Z'),
    );
    // An open capital carry-forward from an EARLIER year feeds the IN-sum.
    await db.insert(schema.lossCarryforward).values({
      userId,
      fromYear: 2024,
      amountAgorot: 300_000,
      kind: 'capital',
    });

    const res = await authedInject({
      method: 'GET',
      url: `/tax-years/${taxYearId}/confirmed-data`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.salaries).toEqual([
      {
        employerName: 'אקמי בע"מ',
        grossSalaryAgorot: 12_000_000,
        taxWithheldAgorot: 1_200_000,
        pensionEmployeeContributionAgorot: 720_000,
      },
    ]);
    expect(body.donations).toEqual([
      { institutionName: 'עמותה', amountAgorot: 100_000 },
    ]);
    expect(body.excludedDonations).toBe(1);
    expect(body.capital).toEqual({
      entries: [
        {
          brokerName: 'ברוקר',
          realGainAgorot: 100_000,
          realLossAgorot: 500_000,
          interestDividendAgorot: 20_000,
          taxWithheldAgorot: 25_000,
        },
      ],
      lossCarryforwardInAgorot: 300_000,
    });
    // Document-derived fields ONLY — no taxpayer, no year echo.
    expect('taxpayer' in body).toBe(false);
  });

  it("surfaces & SUMS 867 appendix-ד' non-linked interest under nonLinkedInterest", async () => {
    // A fresh year isolates this from the docs the previous test inserted.
    const created = await authedInject({
      method: 'POST',
      url: '/tax-years',
      payload: { year: 2024 },
    });
    expect(created.statusCode).toBe(201);
    const year2024Id: string = created.json().id;

    const insert867 = async (
      brokerName: string,
      nonLinkedInterestAgorot: number,
      nonLinkedInterestWithheldAgorot: number,
    ) => {
      const [doc] = await db
        .insert(schema.documents)
        .values({
          taxYearId: year2024Id,
          kind: 'form867',
          storageKey: `test/867-${brokerName}`,
          originalFilename: '867.pdf',
          extractionStatus: 'confirmed',
        })
        .returning();
      await db.insert(schema.confirmedData).values({
        documentId: doc!.id,
        payload: {
          taxYear: 2024,
          brokerName,
          realGainsAgorot: 0,
          realLossesAgorot: 0,
          interestDividendAgorot: 0,
          taxWithheldAgorot: 0,
          nonLinkedInterestAgorot,
          nonLinkedInterestWithheldAgorot,
          uncertainFields: [],
        },
        confirmedAt: new Date('2026-07-01T10:00:00Z'),
      });
    };
    await insert867('בנק א', 1_000_000, 150_000);
    await insert867('בנק ב', 400_000, 60_000);

    const res = await authedInject({
      method: 'GET',
      url: `/tax-years/${year2024Id}/confirmed-data`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().nonLinkedInterest).toEqual({
      amountAgorot: 1_400_000,
      taxWithheldAgorot: 210_000,
    });
  });
});
