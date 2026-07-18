import { randomUUID } from 'node:crypto';
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
// DELETE /documents/:id — per-document deletion (plan
// 2026-07-17-document-deletion.md): the tax-year cascade's child order for a
// single document (extracted_fields → confirmed_data → documents → blob),
// blocked with a Hebrew 409 on a filed year, and stale-flag aware — deleting
// a confirmed document must flip the latest calculation to stale even though
// the deletion only REMOVES confirmed rows (invisible to the
// newer-confirmation timestamp check). Own test database — sibling suites
// own theirs and vitest runs files in parallel.
// ---------------------------------------------------------------------------

const ADMIN_URL = 'postgresql://tax:tax@host.docker.internal:5432/taxreturns';
const TEST_DB = 'taxreturns_test_document_deletion';
const TEST_URL = `postgresql://tax:tax@host.docker.internal:5432/${TEST_DB}`;

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../drizzle',
);

const unusedExtractionClient: ExtractionClient = {
  messages: {
    parse: async () => {
      throw new Error('extraction must not be called in document-deletion tests');
    },
  },
};

/** Confirmed Form-106 payload with a distinguishing employer name. */
function form106Payload(employerName: string) {
  return {
    taxYear: 2025,
    employerName,
    employerDeductionsFileId: '123456789',
    employeeNationalId: '012345678',
    boxes: { '158': 10_000_000, '042': 900_000 },
    uncertainBoxes: [],
  };
}

let adminPool: pg.Pool;
let pool: pg.Pool;
let db: NodePgDatabase<typeof schema>;
let storage: LocalDiskStorage;
let storageDir: string;
let app: FastifyInstance;
let authedInject: (opts: InjectOptions) => Promise<LightMyRequestResponse>;
/** year 2025 — the stale-flag scenarios (kept unpolluted by other blocks). */
let staleYearId: string;
/** year 2023 — the cascade scenarios. */
let cascadeYearId: string;
/** year 2024 — the status-guard scenarios (its status is flipped directly). */
let statusYearId: string;

let seq = 0;

/** Seeds a document row + stored blob (and optionally extracted/confirmed
 *  rows) directly — the upload/confirm flows are pipeline.test.ts's. */
async function seedDocument(opts: {
  taxYearId: string;
  kind?: 'form106' | 'other';
  confirmedPayload?: unknown;
  confirmedAt?: Date;
  withExtracted?: boolean;
}): Promise<{ id: string; storageKey: string }> {
  seq += 1;
  const storageKey = `${opts.taxYearId}/doc-${seq}.pdf`;
  await storage.put(storageKey, Buffer.from('%PDF-1.4 test blob'));
  const [doc] = await db
    .insert(schema.documents)
    .values({
      taxYearId: opts.taxYearId,
      kind: opts.kind ?? 'form106',
      storageKey,
      originalFilename: `doc-${seq}.pdf`,
      extractionStatus: opts.confirmedPayload ? 'confirmed' : 'pending',
    })
    .returning();
  if (opts.withExtracted) {
    await db
      .insert(schema.extractedFields)
      .values({ documentId: doc!.id, payload: {}, model: 'test-model' });
  }
  if (opts.confirmedPayload !== undefined) {
    await db.insert(schema.confirmedData).values({
      documentId: doc!.id,
      payload: opts.confirmedPayload,
      confirmedAt: opts.confirmedAt ?? new Date(),
    });
  }
  return { id: doc!.id, storageKey };
}

async function createYear(year: number): Promise<string> {
  const res = await authedInject({
    method: 'POST',
    url: '/tax-years',
    payload: { year },
  });
  expect(res.statusCode).toBe(201);
  return res.json().id;
}

async function rowsFor(docId: string) {
  return {
    document: await db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.id, docId)),
    extracted: await db
      .select()
      .from(schema.extractedFields)
      .where(eq(schema.extractedFields.documentId, docId)),
    confirmed: await db
      .select()
      .from(schema.confirmedData)
      .where(eq(schema.confirmedData.documentId, docId)),
  };
}

beforeAll(async () => {
  adminPool = new pg.Pool({ connectionString: ADMIN_URL, max: 1 });
  await adminPool.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
  await adminPool.query(`CREATE DATABASE ${TEST_DB}`);

  pool = new pg.Pool({ connectionString: TEST_URL });
  db = drizzle(pool, { schema });
  await migrate(db, { migrationsFolder });

  storageDir = await mkdtemp(path.join(tmpdir(), 'taxreturns-deldoc-storage-'));
  storage = new LocalDiskStorage(storageDir);
  app = buildApp({
    db,
    storage,
    anthropic: unusedExtractionClient,
    googleVerifier: fakeGoogleVerifier(),
  });
  const cookie = await signInAndGetCookie(app);
  authedInject = authedInjector(app, cookie);

  staleYearId = await createYear(2025);
  statusYearId = await createYear(2024);
  cascadeYearId = await createYear(2023);
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

describe('DELETE /documents/:id — scoping', () => {
  it('unauthenticated → 401 (global fail-closed gate)', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/documents/${randomUUID()}`,
    });
    expect(res.statusCode).toBe(401);
  });

  it('a non-UUID id → 404 Hebrew, never a 500', async () => {
    const res = await authedInject({ method: 'DELETE', url: '/documents/not-a-uuid' });
    expect(res.statusCode).toBe(404);
    expect(res.json().message).toMatch(/[֐-׿]/);
  });

  it('an unknown UUID → 404 Hebrew', async () => {
    const res = await authedInject({
      method: 'DELETE',
      url: `/documents/${randomUUID()}`,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().message).toMatch(/[֐-׿]/);
  });
});

describe('DELETE /documents/:id — cascade', () => {
  it('deletes the document, its extracted/confirmed rows and its blob; siblings untouched (204)', async () => {
    const doomed = await seedDocument({
      taxYearId: cascadeYearId,
      confirmedPayload: form106Payload('מעסיק למחיקה'),
      withExtracted: true,
    });
    const sibling = await seedDocument({
      taxYearId: cascadeYearId,
      confirmedPayload: form106Payload('מעסיק שנשאר'),
      withExtracted: true,
    });

    const res = await authedInject({ method: 'DELETE', url: `/documents/${doomed.id}` });
    expect(res.statusCode).toBe(204);

    const doomedRows = await rowsFor(doomed.id);
    expect(doomedRows.document).toHaveLength(0);
    expect(doomedRows.extracted).toHaveLength(0);
    expect(doomedRows.confirmed).toHaveLength(0);
    await expect(storage.get(doomed.storageKey)).rejects.toThrow();

    // The sibling document (rows AND blob) is untouched.
    const siblingRows = await rowsFor(sibling.id);
    expect(siblingRows.document).toHaveLength(1);
    expect(siblingRows.extracted).toHaveLength(1);
    expect(siblingRows.confirmed).toHaveLength(1);
    await expect(storage.get(sibling.storageKey)).resolves.toBeInstanceOf(Buffer);
  });

  it('calculation snapshots are append-only — deletion never removes them', async () => {
    await db.insert(schema.calculations).values({
      taxYearId: cascadeYearId,
      engineVersion: 'test',
      input: {},
      result: {},
    });
    const doc = await seedDocument({
      taxYearId: cascadeYearId,
      confirmedPayload: form106Payload('מעסיק'),
    });
    const res = await authedInject({ method: 'DELETE', url: `/documents/${doc.id}` });
    expect(res.statusCode).toBe(204);
    expect(
      await db
        .select()
        .from(schema.calculations)
        .where(eq(schema.calculations.taxYearId, cascadeYearId)),
    ).toHaveLength(1);
  });

  it('tolerates an already-missing stored file (still 204, rows gone)', async () => {
    const doc = await seedDocument({ taxYearId: cascadeYearId });
    // Simulate a blob that vanished out-of-band.
    await storage.delete(doc.storageKey);

    const res = await authedInject({ method: 'DELETE', url: `/documents/${doc.id}` });
    expect(res.statusCode).toBe(204);
    expect((await rowsFor(doc.id)).document).toHaveLength(0);
  });
});

describe('DELETE /documents/:id — status guard', () => {
  async function setStatus(status: (typeof schema.taxYearStatus.enumValues)[number]) {
    await db
      .update(schema.taxYears)
      .set({ status })
      .where(eq(schema.taxYears.id, statusYearId));
  }

  it('allows deletion in every non-filed status', async () => {
    for (const status of ['draft', 'in_review', 'ready_to_file', 'amended'] as const) {
      await setStatus(status);
      const doc = await seedDocument({ taxYearId: statusYearId });
      const res = await authedInject({ method: 'DELETE', url: `/documents/${doc.id}` });
      expect(res.statusCode, `status ${status}`).toBe(204);
    }
  });

  it('blocks deletion on a filed year with a Hebrew 409 — rows and blob intact', async () => {
    await setStatus('in_review');
    const doc = await seedDocument({
      taxYearId: statusYearId,
      confirmedPayload: form106Payload('מעסיק'),
      withExtracted: true,
    });
    await setStatus('filed');

    const res = await authedInject({ method: 'DELETE', url: `/documents/${doc.id}` });
    expect(res.statusCode).toBe(409);
    expect(res.json().message).toMatch(/[֐-׿]/);

    const rows = await rowsFor(doc.id);
    expect(rows.document).toHaveLength(1);
    expect(rows.extracted).toHaveLength(1);
    expect(rows.confirmed).toHaveLength(1);
    await expect(storage.get(doc.storageKey)).resolves.toBeInstanceOf(Buffer);
  });
});

describe('DELETE /documents/:id — stale flag and projection', () => {
  it('deleting a confirmed document flips the latest calculation to stale and drops it from confirmed-data', async () => {
    const past = new Date('2026-07-01T10:00:00Z');
    await seedDocument({
      taxYearId: staleYearId,
      confirmedPayload: form106Payload('מעסיק א'),
      confirmedAt: past,
    });
    const docB = await seedDocument({
      taxYearId: staleYearId,
      confirmedPayload: form106Payload('מעסיק ב'),
      confirmedAt: past,
    });
    // Snapshot taken AFTER both confirmations (createdAt = now) → fresh.
    await db.insert(schema.calculations).values({
      taxYearId: staleYearId,
      engineVersion: 'test',
      input: {},
      result: {},
    });

    const before = await authedInject({
      method: 'GET',
      url: `/tax-years/${staleYearId}/calculation`,
    });
    expect(before.statusCode).toBe(200);
    expect(before.json().stale).toBe(false);
    const projBefore = await authedInject({
      method: 'GET',
      url: `/tax-years/${staleYearId}/confirmed-data`,
    });
    expect(projBefore.json().salaries).toHaveLength(2);

    const del = await authedInject({ method: 'DELETE', url: `/documents/${docB.id}` });
    expect(del.statusCode).toBe(204);

    // The deletion made the year LESS recently confirmed — the timestamp
    // comparison alone can't see it. It must still read as stale.
    const after = await authedInject({
      method: 'GET',
      url: `/tax-years/${staleYearId}/calculation`,
    });
    expect(after.statusCode).toBe(200);
    expect(after.json().stale).toBe(true);

    // And the projection (what the next calculate will consume) drops it.
    const projAfter = await authedInject({
      method: 'GET',
      url: `/tax-years/${staleYearId}/confirmed-data`,
    });
    const salaries = projAfter.json().salaries as { employerName: string }[];
    expect(salaries).toHaveLength(1);
    expect(salaries[0]!.employerName).toBe('מעסיק א');
  });

  it('deleting a never-confirmed document does NOT flip a fresh snapshot to stale', async () => {
    // A fresh snapshot taken after the previous deletion.
    await db.insert(schema.calculations).values({
      taxYearId: staleYearId,
      engineVersion: 'test',
      input: {},
      result: {},
    });
    const fresh = await authedInject({
      method: 'GET',
      url: `/tax-years/${staleYearId}/calculation`,
    });
    expect(fresh.json().stale).toBe(false);

    // A pending document never fed any calculation — deleting it must not
    // mark the snapshot stale.
    const pendingDoc = await seedDocument({ taxYearId: staleYearId });
    const del = await authedInject({
      method: 'DELETE',
      url: `/documents/${pendingDoc.id}`,
    });
    expect(del.statusCode).toBe(204);

    const after = await authedInject({
      method: 'GET',
      url: `/tax-years/${staleYearId}/calculation`,
    });
    expect(after.json().stale).toBe(false);
  });

  it('a re-confirmation after the snapshot still reads as stale (existing mechanism intact)', async () => {
    // Newest snapshot is the one from the previous test (fresh). Confirm a
    // NEW payload now — newer than the snapshot — via the timestamp path.
    await seedDocument({
      taxYearId: staleYearId,
      confirmedPayload: form106Payload('מעסיק ג'),
      confirmedAt: new Date(Date.now() + 1000),
    });
    const res = await authedInject({
      method: 'GET',
      url: `/tax-years/${staleYearId}/calculation`,
    });
    expect(res.json().stale).toBe(true);
  });
});
