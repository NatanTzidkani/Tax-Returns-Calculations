import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENGINE_VERSION } from '@taxreturns/tax-engine';
import { and, eq } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import * as schema from '../src/db/schema';
import { EXTRACTION_MODEL, type ExtractionClient } from '../src/extraction/extractor';
import { LocalDiskStorage } from '../src/storage/local-disk';
import {
  authedInjector,
  fakeGoogleVerifier,
  fakeGoogleVerifierRejecting,
  OWNER_EMAIL,
  signInAndGetCookie,
} from './helpers/auth';

// Real Postgres on the sibling container (spec §8 / plan Task 4). The admin
// connection uses the dev `taxreturns` database ONLY to issue CREATE/DROP
// DATABASE for the dedicated test database — it never touches its tables.
const ADMIN_URL = 'postgresql://tax:tax@host.docker.internal:5432/taxreturns';
const TEST_DB = 'taxreturns_test';
const TEST_URL = `postgresql://tax:tax@host.docker.internal:5432/${TEST_DB}`;

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../drizzle',
);

// Fixture wire payload — the shape the model returns for a form 106.
const form106Wire = {
  taxYear: 2025,
  employerName: 'אקמי בע"מ',
  employerDeductionsFileId: '912345678',
  employeeNationalId: '012345678',
  boxes: [
    { code: '158', amountAgorot: 24_000_000 },
    { code: '042', amountAgorot: 3_600_000 },
  ],
  uncertainBoxes: [],
};

/** Switchable fake Anthropic client — no live API in tests. */
let fakeMode: 'ok' | 'refuse' | 'transport' = 'ok';
const fakeClient: ExtractionClient = {
  messages: {
    parse: async () => {
      if (fakeMode === 'transport') throw new Error('connection reset');
      return {
        model: EXTRACTION_MODEL,
        stop_reason: fakeMode === 'refuse' ? 'refusal' : 'end_turn',
        parsed_output: fakeMode === 'ok' ? form106Wire : null,
      };
    },
  },
};
const fake = {
  get mode() {
    return fakeMode;
  },
  set mode(m: 'ok' | 'refuse' | 'transport') {
    fakeMode = m;
  },
  client: fakeClient,
};

function multipartBody(
  fields: Record<string, string>,
  file?: { filename: string; contentType: string; data: Buffer },
) {
  const boundary = `----vitest${randomUUID().replaceAll('-', '')}`;
  const parts: Buffer[] = [];
  for (const [name, value] of Object.entries(fields)) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
      ),
    );
  }
  if (file) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`,
      ),
    );
    parts.push(file.data, Buffer.from('\r\n'));
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return {
    payload: Buffer.concat(parts),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

const pdfFile = {
  filename: 'tofes106.pdf',
  contentType: 'application/pdf',
  data: Buffer.from('%PDF-1.4 fake form 106'),
};

async function uploadDocument(
  app: FastifyInstance,
  taxYearId: string,
  kind: string,
): Promise<{ id: string; storageKey: string }> {
  const { payload, headers } = multipartBody({ kind }, pdfFile);
  const res = await authedInject({
    method: 'POST',
    url: `/tax-years/${taxYearId}/documents`,
    payload,
    headers,
  });
  expect(res.statusCode).toBe(201);
  return res.json();
}

let adminPool: pg.Pool;
let pool: pg.Pool;
let db: NodePgDatabase<typeof schema>;
let storage: LocalDiskStorage;
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

  storageDir = await mkdtemp(path.join(tmpdir(), 'taxreturns-storage-'));
  storage = new LocalDiskStorage(storageDir);

  app = buildApp({
    db,
    storage,
    anthropic: fake.client,
    googleVerifier: fakeGoogleVerifier(),
  });
  const cookie = await signInAndGetCookie(app);
  authedInject = authedInjector(app, cookie);
}, 60_000);

afterAll(async () => {
  await app?.close();
  await pool?.end();
  await adminPool?.end();
  // storageDir stays undefined when beforeAll fails early (e.g. db down) —
  // don't cascade a TypeError over the real setup error.
  if (storageDir) await rm(storageDir, { recursive: true, force: true });
});

describe('tax years', () => {
  it('creates a tax year (and the single default user) on POST /tax-years', async () => {
    const res = await authedInject({
      method: 'POST',
      url: '/tax-years',
      payload: { year: 2025 },
    });
    expect(res.statusCode).toBe(201);
    const row = res.json();
    expect(row.year).toBe(2025);
    expect(row.status).toBe('draft');
    expect(row.id).toMatch(/^[0-9a-f-]{36}$/);
    taxYearId = row.id;

    const users = await db.select().from(schema.users);
    expect(users).toHaveLength(1);
  });

  it('rejects a duplicate year with 409 and a Hebrew message', async () => {
    const res = await authedInject({
      method: 'POST',
      url: '/tax-years',
      payload: { year: 2025 },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().message).toMatch(/[֐-׿]/);
  });

  it('rejects an invalid year with 400', async () => {
    const res = await authedInject({
      method: 'POST',
      url: '/tax-years',
      payload: { year: 'לא שנה' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toMatch(/[֐-׿]/);
  });

  it('rejects a year after the current calendar year with 400', async () => {
    const nextYear = new Date().getUTCFullYear() + 1;
    const res = await authedInject({
      method: 'POST',
      url: '/tax-years',
      payload: { year: nextYear },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toMatch(/[֐-׿]/);
  });

  it('accepts the current calendar year', async () => {
    const currentYear = new Date().getUTCFullYear();
    const res = await authedInject({
      method: 'POST',
      url: '/tax-years',
      payload: { year: currentYear },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().year).toBe(currentYear);
  });

  it('lists tax years on GET /tax-years', async () => {
    const second = await authedInject({
      method: 'POST',
      url: '/tax-years',
      payload: { year: 2024 },
    });
    expect(second.statusCode).toBe(201);

    const res = await authedInject({ method: 'GET', url: '/tax-years' });
    expect(res.statusCode).toBe(200);
    const years = res.json().map((t: { year: number }) => t.year);
    expect(years).toContain(2024);
    expect(years).toContain(2025);
  });
});

describe('document upload', () => {
  it('uploads a document via multipart and stores the file', async () => {
    const { payload, headers } = multipartBody({ kind: 'form106' }, pdfFile);
    const res = await authedInject({
      method: 'POST',
      url: `/tax-years/${taxYearId}/documents`,
      payload,
      headers,
    });
    expect(res.statusCode).toBe(201);
    const row = res.json();
    expect(row.kind).toBe('form106');
    expect(row.taxYearId).toBe(taxYearId);
    expect(row.extractionStatus).toBe('pending');
    expect(row.originalFilename).toBe('tofes106.pdf');
    expect(row.storageKey).toMatch(
      new RegExp(`^${taxYearId}/[0-9a-f-]{36}-tofes106\\.pdf$`),
    );

    const stored = await storage.get(row.storageKey);
    expect(stored.equals(pdfFile.data)).toBe(true);
  });

  it('serves the raw uploaded file on GET /documents/:id/file', async () => {
    const doc = await uploadDocument(app, taxYearId, 'form106');
    const res = await authedInject({ method: 'GET', url: `/documents/${doc.id}/file` });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain('tofes106.pdf');
    expect(res.rawPayload.equals(pdfFile.data)).toBe(true);
  });

  it('serves a file with a Hebrew filename (header must stay Latin-1 safe)', async () => {
    const hebrewFile = {
      filename: 'טופס 106 - 2024.pdf',
      contentType: 'application/pdf',
      data: Buffer.from('%PDF-1.4 hebrew name'),
    };
    const { payload, headers } = multipartBody({ kind: 'form106' }, hebrewFile);
    const upload = await authedInject({
      method: 'POST',
      url: `/tax-years/${taxYearId}/documents`,
      payload,
      headers,
    });
    expect(upload.statusCode).toBe(201);

    const res = await authedInject({
      method: 'GET',
      url: `/documents/${upload.json().id}/file`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    // RFC 5987 encoded form carries the real name; the plain filename= is
    // an ASCII fallback.
    expect(res.headers['content-disposition']).toContain(
      `filename*=UTF-8''${encodeURIComponent('טופס 106 - 2024.pdf')}`,
    );
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.rawPayload.equals(hebrewFile.data)).toBe(true);
  });

  it('404s GET /documents/:id/file for an unknown document', async () => {
    const res = await authedInject({ method: 'GET', url: `/documents/${randomUUID()}/file` });
    expect(res.statusCode).toBe(404);
    expect(res.json().message).toMatch(/[֐-׿]/);
  });

  it('404s for an unknown tax year', async () => {
    const { payload, headers } = multipartBody({ kind: 'form106' }, pdfFile);
    const res = await authedInject({
      method: 'POST',
      url: `/tax-years/${randomUUID()}/documents`,
      payload,
      headers,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().message).toMatch(/[֐-׿]/);
  });

  it('400s on an invalid kind', async () => {
    const { payload, headers } = multipartBody({ kind: 'form999' }, pdfFile);
    const res = await authedInject({
      method: 'POST',
      url: `/tax-years/${taxYearId}/documents`,
      payload,
      headers,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toMatch(/[֐-׿]/);
  });

  it('sanitizes a path-traversal filename — upload succeeds, blob stays inside the year directory', async () => {
    const evilFile = {
      filename: 'a/../../evil.pdf',
      contentType: 'application/pdf',
      data: Buffer.from('%PDF-1.4 traversal attempt'),
    };
    const { payload, headers } = multipartBody({ kind: 'form106' }, evilFile);
    const res = await authedInject({
      method: 'POST',
      url: `/tax-years/${taxYearId}/documents`,
      payload,
      headers,
    });
    expect(res.statusCode).toBe(201);
    const row = res.json();
    // The raw client name survives only as display metadata…
    expect(row.originalFilename).toBe('a/../../evil.pdf');
    // …while the storage key uses the sanitized basename, INSIDE the year dir.
    expect(row.storageKey).toMatch(
      new RegExp(`^${taxYearId}/[0-9a-f-]{36}-evil\\.pdf$`),
    );
    const stored = await storage.get(row.storageKey);
    expect(stored.equals(evilFile.data)).toBe(true);
  });

  it('strips null bytes from the filename before composing the storage key', async () => {
    const nulFile = {
      filename: 'ev\u0000il.pdf',
      contentType: 'application/pdf',
      data: Buffer.from('%PDF-1.4 null byte'),
    };
    const { payload, headers } = multipartBody({ kind: 'form106' }, nulFile);
    const res = await authedInject({
      method: 'POST',
      url: `/tax-years/${taxYearId}/documents`,
      payload,
      headers,
    });
    expect(res.statusCode).toBe(201);
    const row = res.json();
    expect(row.storageKey).toMatch(
      new RegExp(`^${taxYearId}/[0-9a-f-]{36}-evil\\.pdf$`),
    );
    await expect(storage.get(row.storageKey)).resolves.toBeInstanceOf(Buffer);
  });

  it('400s when no file part is sent', async () => {
    const { payload, headers } = multipartBody({ kind: 'form106' });
    const res = await authedInject({
      method: 'POST',
      url: `/tax-years/${taxYearId}/documents`,
      payload,
      headers,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toMatch(/[֐-׿]/);
  });
});

describe('GET /tax-years/:taxYearId/documents', () => {
  it('lists documents uploaded for that tax year', async () => {
    const first = await uploadDocument(app, taxYearId, 'form106');
    const second = await uploadDocument(app, taxYearId, 'form867');

    const res = await authedInject({
      method: 'GET',
      url: `/tax-years/${taxYearId}/documents`,
    });
    expect(res.statusCode).toBe(200);
    const ids = res.json().map((d: { id: string }) => d.id);
    expect(ids).toEqual(expect.arrayContaining([first.id, second.id]));
    for (const doc of res.json()) {
      expect(doc.taxYearId).toBe(taxYearId);
    }
  });

  it('404s for an unknown tax year', async () => {
    const res = await authedInject({
      method: 'GET',
      url: `/tax-years/${randomUUID()}/documents`,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().message).toMatch(/[֐-׿]/);
  });
});

describe('extraction', () => {
  it('extracts a pending document: persists extracted_fields, status → extracted', async () => {
    fake.mode = 'ok';
    const doc = await uploadDocument(app, taxYearId, 'form106');

    const res = await authedInject({
      method: 'POST',
      url: `/documents/${doc.id}/extract`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.extractionStatus).toBe('extracted');
    expect(body.extractedPayload.boxes).toEqual({
      '158': 24_000_000,
      '042': 3_600_000,
    });

    const rows = await db
      .select()
      .from(schema.extractedFields)
      .where(eq(schema.extractedFields.documentId, doc.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.model).toBe(EXTRACTION_MODEL);
    expect((rows[0]!.payload as { taxYear: number }).taxYear).toBe(2025);
  });

  it('marks the document failed (+reason) and responds 502 when extraction fails', async () => {
    fake.mode = 'refuse';
    const doc = await uploadDocument(app, taxYearId, 'form106');

    const res = await authedInject({
      method: 'POST',
      url: `/documents/${doc.id}/extract`,
    });
    expect(res.statusCode).toBe(502);
    expect(res.json().message).toMatch(/[֐-׿]/);

    const [row] = await db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.id, doc.id));
    expect(row!.extractionStatus).toBe('failed');
    expect(row!.extractionError).toMatch(/[֐-׿]/);
    fake.mode = 'ok';
  });

  it("400s on extract for kind 'other'", async () => {
    const doc = await uploadDocument(app, taxYearId, 'other');
    const res = await authedInject({
      method: 'POST',
      url: `/documents/${doc.id}/extract`,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toMatch(/[֐-׿]/);
  });

  it('404s on extract for an unknown document', async () => {
    const res = await authedInject({
      method: 'POST',
      url: `/documents/${randomUUID()}/extract`,
    });
    expect(res.statusCode).toBe(404);
  });
});

const confirmedForm106 = {
  taxYear: 2025,
  employerName: 'אקמי בע"מ',
  employerDeductionsFileId: '912345678',
  employeeNationalId: '012345678',
  boxes: { '158': 24_000_000, '042': 3_600_000 },
  uncertainBoxes: [],
};

describe('confirmation', () => {
  it('confirms an extracted document: confirmed_data row, status → confirmed', async () => {
    fake.mode = 'ok';
    const doc = await uploadDocument(app, taxYearId, 'form106');
    await authedInject({ method: 'POST', url: `/documents/${doc.id}/extract` });

    const res = await authedInject({
      method: 'POST',
      url: `/documents/${doc.id}/confirm`,
      payload: { payload: confirmedForm106 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().extractionStatus).toBe('confirmed');

    const rows = await db
      .select()
      .from(schema.confirmedData)
      .where(eq(schema.confirmedData.documentId, doc.id));
    expect(rows).toHaveLength(1);
    expect((rows[0]!.payload as { taxYear: number }).taxYear).toBe(2025);
  });

  it('confirms straight from pending (manual-entry fallback)', async () => {
    const doc = await uploadDocument(app, taxYearId, 'form106');
    const res = await authedInject({
      method: 'POST',
      url: `/documents/${doc.id}/confirm`,
      payload: { payload: confirmedForm106 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().extractionStatus).toBe('confirmed');
  });

  it('rejects an invalid payload with 400 and a Hebrew message', async () => {
    const doc = await uploadDocument(app, taxYearId, 'form106');
    const res = await authedInject({
      method: 'POST',
      url: `/documents/${doc.id}/confirm`,
      payload: {
        payload: { ...confirmedForm106, employeeNationalId: '12' },
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toMatch(/[֐-׿]/);

    const [row] = await db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.id, doc.id));
    expect(row!.extractionStatus).toBe('pending');
  });

  it('rejects a negative box amount with 400 and a Hebrew message', async () => {
    const doc = await uploadDocument(app, taxYearId, 'form106');
    const res = await authedInject({
      method: 'POST',
      url: `/documents/${doc.id}/confirm`,
      payload: {
        payload: { ...confirmedForm106, boxes: { '158': -100 } },
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toMatch(/[֐-׿]/);
  });

  it("400s on confirm for kind 'other'", async () => {
    const doc = await uploadDocument(app, taxYearId, 'other');
    const res = await authedInject({
      method: 'POST',
      url: `/documents/${doc.id}/confirm`,
      payload: { payload: confirmedForm106 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('404s on confirm for an unknown document', async () => {
    const res = await authedInject({
      method: 'POST',
      url: `/documents/${randomUUID()}/confirm`,
      payload: { payload: confirmedForm106 },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('GET /documents/:id', () => {
  it('returns the row with latest extracted and confirmed payloads', async () => {
    fake.mode = 'ok';
    const doc = await uploadDocument(app, taxYearId, 'form106');
    await authedInject({ method: 'POST', url: `/documents/${doc.id}/extract` });
    await authedInject({
      method: 'POST',
      url: `/documents/${doc.id}/confirm`,
      payload: { payload: confirmedForm106 },
    });

    const res = await authedInject({ method: 'GET', url: `/documents/${doc.id}` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(doc.id);
    expect(body.extractionStatus).toBe('confirmed');
    expect(body.extractedPayload.boxes['158']).toBe(24_000_000);
    expect(body.confirmedPayload).toEqual(confirmedForm106);
  });

  it('returns null payloads for a fresh pending document', async () => {
    const doc = await uploadDocument(app, taxYearId, 'form106');
    const res = await authedInject({ method: 'GET', url: `/documents/${doc.id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().extractedPayload).toBeNull();
    expect(res.json().confirmedPayload).toBeNull();
  });

  it('404s for an unknown document id', async () => {
    const res = await authedInject({
      method: 'GET',
      url: `/documents/${randomUUID()}`,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().message).toMatch(/[֐-׿]/);
  });

  it('404s for a malformed document id', async () => {
    const res = await authedInject({ method: 'GET', url: '/documents/not-a-uuid' });
    expect(res.statusCode).toBe(404);
  });
});

describe('auth', () => {
  it('signs in with the owner email: 200 + Set-Cookie + upserted user', async () => {
    const authApp = buildApp({ db, storage, googleVerifier: fakeGoogleVerifier() });
    const res = await authApp.inject({
      method: 'POST',
      url: '/auth/google',
      payload: { credential: 'fake-credential' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ id: expect.any(String), email: OWNER_EMAIL });
    expect(res.cookies.some((c) => c.name === 'session')).toBe(true);
    await authApp.close();
  });

  it('rejects sign-in with a different email: 403 Hebrew', async () => {
    const authApp = buildApp({
      db,
      storage,
      googleVerifier: fakeGoogleVerifier({ email: 'someone-else@example.com' }),
    });
    const res = await authApp.inject({
      method: 'POST',
      url: '/auth/google',
      payload: { credential: 'fake-credential' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().message).toMatch(/[֐-׿]/);
    await authApp.close();
  });

  it('rejects sign-in with an invalid/unverifiable token: 401 Hebrew', async () => {
    const authApp = buildApp({ db, storage, googleVerifier: fakeGoogleVerifierRejecting() });
    const res = await authApp.inject({
      method: 'POST',
      url: '/auth/google',
      payload: { credential: 'bad-token' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().message).toMatch(/[֐-׿]/);
    await authApp.close();
  });

  it('rejects sign-in with a missing credential: 400 Hebrew', async () => {
    const authApp = buildApp({ db, storage, googleVerifier: fakeGoogleVerifier() });
    const res = await authApp.inject({ method: 'POST', url: '/auth/google', payload: {} });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toMatch(/[֐-׿]/);
    await authApp.close();
  });

  it('GET /auth/me without a session cookie: 401 Hebrew', async () => {
    const res = await app.inject({ method: 'GET', url: '/auth/me' });
    expect(res.statusCode).toBe(401);
    expect(res.json().message).toMatch(/[֐-׿]/);
  });

  it('GET /auth/me with a valid session cookie: 200 + the signed-in user', async () => {
    const res = await authedInject({ method: 'GET', url: '/auth/me' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ id: expect.any(String), email: OWNER_EMAIL });
  });

  it('POST /auth/logout clears the session: 204, then /auth/me 401s', async () => {
    const authApp = buildApp({ db, storage, googleVerifier: fakeGoogleVerifier() });
    const cookie = await signInAndGetCookie(authApp);
    const injectAs = authedInjector(authApp, cookie);

    const logoutRes = await injectAs({ method: 'POST', url: '/auth/logout' });
    expect(logoutRes.statusCode).toBe(204);

    // A well-behaved client drops the cookie logout just cleared rather than
    // resending the stale one — secure-session is a stateless signed cookie,
    // so a client that ignores the clearing Set-Cookie and keeps sending the
    // old value would still authenticate (there's no server-side revocation
    // list, by design).
    const meRes = await authApp.inject({ method: 'GET', url: '/auth/me' });
    expect(meRes.statusCode).toBe(401);
    await authApp.close();
  });

  it('treats a forged/tampered session cookie as unauthenticated (401), never a 500 or a bypass', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { cookie: 'session=this-is-not-a-valid-encrypted-payload' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().message).toMatch(/[֐-׿]/);
  });

  it('every protected route 401s without a session cookie', async () => {
    const protectedRoutes: InjectOptions[] = [
      { method: 'GET', url: '/tax-years' },
      { method: 'POST', url: '/tax-years', payload: { year: 2025 } },
      { method: 'GET', url: `/tax-years/${taxYearId}/documents` },
      { method: 'GET', url: `/documents/${randomUUID()}` },
      {
        method: 'POST',
        url: `/tax-years/${taxYearId}/calculate`,
        payload: { taxpayer: { gender: 'male' } },
      },
      { method: 'GET', url: `/tax-years/${taxYearId}/calculation` },
      {
        method: 'PATCH',
        url: `/tax-years/${taxYearId}/status`,
        payload: { status: 'in_review' },
      },
    ];
    for (const opts of protectedRoutes) {
      const res = await app.inject(opts);
      expect(res.statusCode).toBe(401);
      expect(res.json().message).toMatch(/[֐-׿]/);
    }
  });

  it('401s an unauthenticated POST BEFORE parsing its body — a large malformed JSON payload must not 400 first', async () => {
    // The auth gate runs in onRequest, i.e. before Fastify's body parsing.
    // If it ever moves back to preHandler, this malformed 1MB JSON body gets
    // parsed pre-auth and the parser's 400 wins over the gate's 401.
    const res = await app.inject({
      method: 'POST',
      url: '/tax-years',
      headers: { 'content-type': 'application/json' },
      payload: `{"junk":"${'x'.repeat(1024 * 1024)}`,
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().message).toMatch(/[֐-׿]/);
  });

  it('GET /health stays public — no auth required', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});

// ---------------------------------------------------------------------------
// Plan 5 — calculation wiring, carry-forward, status flow (contract in
// docs/superpowers/plans/2026-07-07-calculation-and-filing.md).
// ---------------------------------------------------------------------------

const taxpayerBody = { taxpayer: { gender: 'male' as const } };

async function findYearId(year: number): Promise<string> {
  const res = await authedInject({ method: 'GET', url: '/tax-years' });
  expect(res.statusCode).toBe(200);
  const row = res.json().find((t: { year: number }) => t.year === year);
  expect(row).toBeDefined();
  return row.id;
}

describe('POST /tax-years/:id/calculate', () => {
  let firstCalculationId: string;

  it('calculates from the confirmed data and persists a snapshot', async () => {
    // By this point the 2025 year (taxYearId) has exactly 3 confirmed
    // form106 documents, each with boxes 158=24,000,000 / 042=3,600,000.
    const res = await authedInject({
      method: 'POST',
      url: `/tax-years/${taxYearId}/calculate`,
      payload: taxpayerBody,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.taxYearId).toBe(taxYearId);
    expect(body.engineVersion).toBe(ENGINE_VERSION);
    expect(body.metadata).toEqual({ excludedDonations: 0 });

    // Engine input mapped only from confirmed_data (never extracted_fields):
    expect(body.input.year).toBe(2025);
    expect(body.input.taxpayer).toEqual({
      gender: 'male',
      isIsraeliResident: true,
      additionalCreditPoints: 0,
    });
    expect(body.input.salaries).toHaveLength(3);
    for (const salary of body.input.salaries) {
      expect(salary).toEqual({
        employerName: 'אקמי בע"מ',
        grossSalaryAgorot: 24_000_000,
        taxWithheldAgorot: 3_600_000,
        pensionEmployeeContributionAgorot: 0,
      });
    }

    expect(body.result.year).toBe(2025);
    expect(body.result.totalWithheldAgorot).toBe(3 * 3_600_000);
    expect(typeof body.result.refundAgorot).toBe('number');

    const rows = await db
      .select()
      .from(schema.calculations)
      .where(eq(schema.calculations.taxYearId, taxYearId));
    expect(rows).toHaveLength(1);
    firstCalculationId = rows[0]!.id;
  });

  it('recalculating appends a SECOND snapshot (append-only) and returns the new one', async () => {
    const res = await authedInject({
      method: 'POST',
      url: `/tax-years/${taxYearId}/calculate`,
      payload: taxpayerBody,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).not.toBe(firstCalculationId);

    const rows = await db
      .select()
      .from(schema.calculations)
      .where(eq(schema.calculations.taxYearId, taxYearId));
    expect(rows).toHaveLength(2);
  });

  it('a year with zero confirmed documents is a legal zero return', async () => {
    const year2024Id = await findYearId(2024);
    const res = await authedInject({
      method: 'POST',
      url: `/tax-years/${year2024Id}/calculate`,
      payload: taxpayerBody,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.input.salaries).toEqual([]);
    expect(body.result.totalLiabilityAgorot).toBe(0);
    expect(body.result.refundAgorot).toBe(0);
  });

  it('400s (Hebrew) on an invalid body', async () => {
    const res = await authedInject({
      method: 'POST',
      url: `/tax-years/${taxYearId}/calculate`,
      payload: { taxpayer: { gender: 'unknown' } },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toMatch(/[֐-׿]/);
  });

  it('400s (Hebrew) when the engine rejects the year (2023 has no rule set)', async () => {
    const create = await authedInject({
      method: 'POST',
      url: '/tax-years',
      payload: { year: 2023 },
    });
    expect(create.statusCode).toBe(201);

    const res = await authedInject({
      method: 'POST',
      url: `/tax-years/${create.json().id}/calculate`,
      payload: taxpayerBody,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toMatch(/[֐-׿]/);
    expect(res.json().message).toContain('2023');
  });

  it('404s for an unknown tax year', async () => {
    const res = await authedInject({
      method: 'POST',
      url: `/tax-years/${randomUUID()}/calculate`,
      payload: taxpayerBody,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().message).toMatch(/[֐-׿]/);
  });
});

describe('loss carry-forward across years', () => {
  const form867Loss = {
    taxYear: 2024,
    brokerName: 'בנק דיסקונט',
    realGainsAgorot: 0,
    realLossesAgorot: 5_000_000,
    interestDividendAgorot: 0,
    taxWithheldAgorot: 0,
    uncertainFields: [],
  };
  let year2024Id: string;

  it('a net capital loss in year A writes a loss_carryforward row', async () => {
    year2024Id = await findYearId(2024);
    const doc = await uploadDocument(app, year2024Id, 'form867');
    const confirm = await authedInject({
      method: 'POST',
      url: `/documents/${doc.id}/confirm`,
      payload: { payload: form867Loss },
    });
    expect(confirm.statusCode).toBe(200);

    const res = await authedInject({
      method: 'POST',
      url: `/tax-years/${year2024Id}/calculate`,
      payload: taxpayerBody,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().result.lossCarryforwardOutAgorot).toBe(5_000_000);

    const rows = await db
      .select()
      .from(schema.lossCarryforward)
      .where(eq(schema.lossCarryforward.fromYear, 2024));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      amountAgorot: 5_000_000,
      kind: 'capital',
      consumedByYear: null,
    });
  });

  it('a later year picks the carry-forward up in its engine input', async () => {
    const res = await authedInject({
      method: 'POST',
      url: `/tax-years/${taxYearId}/calculate`,
      payload: taxpayerBody,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.input.capital.lossCarryforwardInAgorot).toBe(5_000_000);
    expect(body.result.capitalGains.lossCarryforwardInAgorot).toBe(5_000_000);
    // 2025 has no gains to consume it — it flows out again.
    expect(body.result.capitalGains.carryforwardConsumedAgorot).toBe(0);
  });

  it('recalculating year A REPLACES its carry-forward row, never duplicates', async () => {
    const res = await authedInject({
      method: 'POST',
      url: `/tax-years/${year2024Id}/calculate`,
      payload: taxpayerBody,
    });
    expect(res.statusCode).toBe(200);

    const rows = await db
      .select()
      .from(schema.lossCarryforward)
      .where(eq(schema.lossCarryforward.fromYear, 2024));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.amountAgorot).toBe(5_000_000);
  });

  it('does NOT sum non-capital carry-forward kinds into the capital loss IN', async () => {
    // Defense-in-depth: `kind` is free text; a future charity carry-forward
    // row for an earlier year must never leak into the CAPITAL loss offset.
    const [user] = await db.select().from(schema.users);
    await db.insert(schema.lossCarryforward).values({
      userId: user!.id,
      fromYear: 2024,
      amountAgorot: 77_700,
      kind: 'charity',
    });

    const res = await authedInject({
      method: 'POST',
      url: `/tax-years/${taxYearId}/calculate`,
      payload: taxpayerBody,
    });
    expect(res.statusCode).toBe(200);
    // Only the 5,000,000 capital loss from 2024 — not the 77,700 charity row.
    expect(res.json().input.capital.lossCarryforwardInAgorot).toBe(5_000_000);
  });

  it('the database rejects a second (user, fromYear, kind) row outright', async () => {
    // The race guarantee: even if two concurrent recalculations both saw an
    // empty delete, the unique index makes a duplicate insert impossible.
    const [user] = await db.select().from(schema.users);
    await expect(
      db.insert(schema.lossCarryforward).values({
        userId: user!.id,
        fromYear: 2024,
        amountAgorot: 1,
        kind: 'capital',
      }),
    ).rejects.toThrow();

    const rows = await db
      .select()
      .from(schema.lossCarryforward)
      .where(
        and(
          eq(schema.lossCarryforward.fromYear, 2024),
          eq(schema.lossCarryforward.kind, 'capital'),
        ),
      );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.amountAgorot).toBe(5_000_000);
  });
});

describe('GET /tax-years/:id/calculation', () => {
  it('returns the latest calculation with stale:false right after calculating', async () => {
    const res = await authedInject({
      method: 'GET',
      url: `/tax-years/${taxYearId}/calculation`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.taxYearId).toBe(taxYearId);
    expect(body.engineVersion).toBe(ENGINE_VERSION);
    expect(body.stale).toBe(false);
    // Latest = the carry-forward-aware recalculation from the block above.
    expect(body.input.capital.lossCarryforwardInAgorot).toBe(5_000_000);
  });

  it('flips stale to true after a document is re-confirmed', async () => {
    const docs = await authedInject({
      method: 'GET',
      url: `/tax-years/${taxYearId}/documents`,
    });
    const confirmedDoc = docs
      .json()
      .find((d: { extractionStatus: string }) => d.extractionStatus === 'confirmed');
    expect(confirmedDoc).toBeDefined();
    const reconfirm = await authedInject({
      method: 'POST',
      url: `/documents/${confirmedDoc.id}/confirm`,
      payload: { payload: confirmedForm106 },
    });
    expect(reconfirm.statusCode).toBe(200);

    const res = await authedInject({
      method: 'GET',
      url: `/tax-years/${taxYearId}/calculation`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().stale).toBe(true);
  });

  it('404s (Hebrew) when the year exists but was never calculated', async () => {
    const year2023Id = await findYearId(2023);
    const res = await authedInject({
      method: 'GET',
      url: `/tax-years/${year2023Id}/calculation`,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().message).toMatch(/[֐-׿]/);
  });

  it('404s for an unknown year', async () => {
    const res = await authedInject({
      method: 'GET',
      url: `/tax-years/${randomUUID()}/calculation`,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().message).toMatch(/[֐-׿]/);
  });
});

describe('PATCH /tax-years/:id/status', () => {
  let year2023Id: string;

  async function patchStatus(status: string) {
    return authedInject({
      method: 'PATCH',
      url: `/tax-years/${year2023Id}/status`,
      payload: { status },
    });
  }

  it('rejects an illegal transition (draft→filed) with 400 naming the current status', async () => {
    year2023Id = await findYearId(2023);
    const res = await patchStatus('filed');
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toMatch(/[֐-׿]/);
    expect(res.json().message).toContain('draft');
  });

  it('walks the legal path draft→in_review→ready_to_file→filed, setting filedAt', async () => {
    const toReview = await patchStatus('in_review');
    expect(toReview.statusCode).toBe(200);
    expect(toReview.json().status).toBe('in_review');
    expect(toReview.json().filedAt).toBeNull();

    const toReady = await patchStatus('ready_to_file');
    expect(toReady.statusCode).toBe(200);
    expect(toReady.json().status).toBe('ready_to_file');

    const toFiled = await patchStatus('filed');
    expect(toFiled.statusCode).toBe(200);
    expect(toFiled.json().status).toBe('filed');
    expect(toFiled.json().filedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('supports the backward steps in_review→draft and ready_to_file→in_review', async () => {
    // 2024 is still draft — walk it forward and back.
    const year2024Id = await findYearId(2024);
    const patch = (status: string) =>
      authedInject({
        method: 'PATCH',
        url: `/tax-years/${year2024Id}/status`,
        payload: { status },
      });
    expect((await patch('in_review')).statusCode).toBe(200);
    expect((await patch('ready_to_file')).statusCode).toBe(200);
    const back = await patch('in_review');
    expect(back.statusCode).toBe(200);
    expect(back.json().status).toBe('in_review');
    const toDraft = await patch('draft');
    expect(toDraft.statusCode).toBe(200);
    expect(toDraft.json().status).toBe('draft');
  });

  it('rejects filed→in_review (only amended is legal from filed)', async () => {
    const res = await patchStatus('in_review');
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain('filed');
  });

  it('filed→amended keeps filedAt as history, and amended→in_review continues', async () => {
    const amended = await patchStatus('amended');
    expect(amended.statusCode).toBe(200);
    expect(amended.json().status).toBe('amended');
    expect(amended.json().filedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const review = await patchStatus('in_review');
    expect(review.statusCode).toBe(200);
    expect(review.json().status).toBe('in_review');
    expect(review.json().filedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('400s (Hebrew) on an unknown status value', async () => {
    const res = await patchStatus('done');
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toMatch(/[֐-׿]/);
  });

  it('404s for an unknown tax year', async () => {
    const res = await authedInject({
      method: 'PATCH',
      url: `/tax-years/${randomUUID()}/status`,
      payload: { status: 'in_review' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().message).toMatch(/[֐-׿]/);
  });
});

describe('GET /tax-years refund estimates', () => {
  it('carries refundEstimateAgorot from the latest calculation, null without one', async () => {
    const latestCalc = await authedInject({
      method: 'GET',
      url: `/tax-years/${taxYearId}/calculation`,
    });
    expect(latestCalc.statusCode).toBe(200);
    const expectedRefund = latestCalc.json().result.refundAgorot;

    const res = await authedInject({ method: 'GET', url: '/tax-years' });
    expect(res.statusCode).toBe(200);
    const byYear = new Map(
      res.json().map((t: { year: number; refundEstimateAgorot: number | null }) => [
        t.year,
        t.refundEstimateAgorot,
      ]),
    );
    expect(byYear.get(2025)).toBe(expectedRefund);
    expect(typeof byYear.get(2025)).toBe('number');
    expect(byYear.get(2023)).toBeNull(); // year exists, never calculated
  });
});

// ---------------------------------------------------------------------------
// Cross-user isolation: every tax-year-scoped read/write must be limited to
// the requester's own years. A second user + year is created directly in the
// DB (sign-in is single-owner-only) and must be invisible/untouchable to the
// authenticated owner. These blocks run last so the extra user row doesn't
// perturb earlier single-user assumptions.
// ---------------------------------------------------------------------------

describe('cross-user isolation', () => {
  let intruderYearId: string;

  beforeAll(async () => {
    const [other] = await db
      .insert(schema.users)
      .values({ email: 'intruder@example.com' })
      .returning();
    const [year] = await db
      .insert(schema.taxYears)
      .values({ userId: other!.id, year: 2025 })
      .returning();
    intruderYearId = year!.id;
  });

  it('GET /tax-years never lists another user’s years', async () => {
    const res = await authedInject({ method: 'GET', url: '/tax-years' });
    expect(res.statusCode).toBe(200);
    const ids = res.json().map((t: { id: string }) => t.id);
    expect(ids).not.toContain(intruderYearId);
  });

  it('404s (Hebrew) on every tax-year-scoped route for another user’s year', async () => {
    const attempts: InjectOptions[] = [
      { method: 'GET', url: `/tax-years/${intruderYearId}/documents` },
      {
        method: 'POST',
        url: `/tax-years/${intruderYearId}/calculate`,
        payload: taxpayerBody,
      },
      { method: 'GET', url: `/tax-years/${intruderYearId}/calculation` },
      { method: 'GET', url: `/tax-years/${intruderYearId}/confirmed-data` },
      {
        method: 'PATCH',
        url: `/tax-years/${intruderYearId}/status`,
        payload: { status: 'in_review' },
      },
      { method: 'DELETE', url: `/tax-years/${intruderYearId}` },
    ];
    for (const opts of attempts) {
      const res = await authedInject(opts);
      expect(res.statusCode, `${opts.method} ${opts.url}`).toBe(404);
      expect(res.json().message).toMatch(/[֐-׿]/);
    }
  });

  it('does NOT upload documents into another user’s year', async () => {
    const { payload, headers } = multipartBody({ kind: 'form106' }, pdfFile);
    const res = await authedInject({
      method: 'POST',
      url: `/tax-years/${intruderYearId}/documents`,
      payload,
      headers,
    });
    expect(res.statusCode).toBe(404);
  });

  it('another user’s calculation rows never influence the refund estimates', async () => {
    const before = await authedInject({ method: 'GET', url: '/tax-years' });
    expect(before.statusCode).toBe(200);

    // A calculation for the INTRUDER's year with an unmistakable refund. The
    // refund-estimate query is user-scoped (joined to the requester's years),
    // so the owner's listing must be byte-identical before and after.
    await db.insert(schema.calculations).values({
      taxYearId: intruderYearId,
      engineVersion: ENGINE_VERSION,
      input: {},
      result: { refundAgorot: 999_999_999 },
    });

    const after = await authedInject({ method: 'GET', url: '/tax-years' });
    expect(after.statusCode).toBe(200);
    expect(after.json()).toEqual(before.json());
    for (const year of after.json()) {
      expect(year.refundEstimateAgorot).not.toBe(999_999_999);
    }
  });

  it('leaves the other user’s year fully intact after the blocked attempts', async () => {
    const [row] = await db
      .select()
      .from(schema.taxYears)
      .where(eq(schema.taxYears.id, intruderYearId));
    expect(row).toBeDefined();
    expect(row!.status).toBe('draft');
  });
});

// ---------------------------------------------------------------------------
// DELETE /tax-years/:id — cascade-delete the year and everything under it.
// ---------------------------------------------------------------------------

describe('DELETE /tax-years/:id', () => {
  async function ownerUserId(): Promise<string> {
    const [owner] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, OWNER_EMAIL));
    return owner!.id;
  }

  it('cascade-deletes the year, all child rows, and the stored files (204)', async () => {
    // A fresh year with the full spread of children. Engine year-support is
    // irrelevant here, so calculation/carry-forward rows are inserted directly
    // rather than via the calculate route (2022 has no rule set).
    const create = await authedInject({
      method: 'POST',
      url: '/tax-years',
      payload: { year: 2022 },
    });
    expect(create.statusCode).toBe(201);
    const yearId = create.json().id;
    const userId = await ownerUserId();

    const doc = await uploadDocument(app, yearId, 'form106');
    // extracted_fields (audit) + confirmed_data (approved) for the document.
    await db
      .insert(schema.extractedFields)
      .values({ documentId: doc.id, payload: form106Wire, model: EXTRACTION_MODEL });
    const confirm = await authedInject({
      method: 'POST',
      url: `/documents/${doc.id}/confirm`,
      payload: { payload: confirmedForm106 },
    });
    expect(confirm.statusCode).toBe(200);

    // calculation snapshot + loss carry-forward row, inserted directly.
    await db.insert(schema.calculations).values({
      taxYearId: yearId,
      engineVersion: ENGINE_VERSION,
      input: {},
      result: {},
    });
    await db.insert(schema.lossCarryforward).values({
      userId,
      fromYear: 2022,
      amountAgorot: 1_234_500,
      kind: 'capital',
    });

    const [docRow] = await db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.id, doc.id));
    const storageKey = docRow!.storageKey;
    // The file exists before the delete.
    await expect(storage.get(storageKey)).resolves.toBeInstanceOf(Buffer);

    const del = await authedInject({ method: 'DELETE', url: `/tax-years/${yearId}` });
    expect(del.statusCode).toBe(204);

    // Every child row is gone.
    expect(
      await db
        .select()
        .from(schema.calculations)
        .where(eq(schema.calculations.taxYearId, yearId)),
    ).toHaveLength(0);
    expect(
      await db.select().from(schema.documents).where(eq(schema.documents.taxYearId, yearId)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(schema.confirmedData)
        .where(eq(schema.confirmedData.documentId, doc.id)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(schema.extractedFields)
        .where(eq(schema.extractedFields.documentId, doc.id)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(schema.lossCarryforward)
        .where(
          and(
            eq(schema.lossCarryforward.userId, userId),
            eq(schema.lossCarryforward.fromYear, 2022),
          ),
        ),
    ).toHaveLength(0);
    // The tax_years row itself is gone.
    expect(
      await db.select().from(schema.taxYears).where(eq(schema.taxYears.id, yearId)),
    ).toHaveLength(0);
    // The stored blob is deleted.
    await expect(storage.get(storageKey)).rejects.toThrow();

    // And it no longer appears in the listing.
    const list = await authedInject({ method: 'GET', url: '/tax-years' });
    expect(list.json().map((t: { year: number }) => t.year)).not.toContain(2022);
  });

  it('404s (Hebrew) for a non-UUID id — never a 500', async () => {
    const res = await authedInject({ method: 'DELETE', url: '/tax-years/not-a-uuid' });
    expect(res.statusCode).toBe(404);
    expect(res.json().message).toMatch(/[֐-׿]/);
  });

  it('404s (Hebrew) for an unknown UUID', async () => {
    const res = await authedInject({ method: 'DELETE', url: `/tax-years/${randomUUID()}` });
    expect(res.statusCode).toBe(404);
    expect(res.json().message).toMatch(/[֐-׿]/);
  });

  it('tolerates an already-missing stored file (still 204, rows gone)', async () => {
    const create = await authedInject({
      method: 'POST',
      url: '/tax-years',
      payload: { year: 2021 },
    });
    expect(create.statusCode).toBe(201);
    const yearId = create.json().id;
    const doc = await uploadDocument(app, yearId, 'form106');

    const [docRow] = await db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.id, doc.id));
    // Simulate a blob that vanished out-of-band.
    await storage.delete(docRow!.storageKey);

    const del = await authedInject({ method: 'DELETE', url: `/tax-years/${yearId}` });
    expect(del.statusCode).toBe(204);
    expect(
      await db.select().from(schema.documents).where(eq(schema.documents.taxYearId, yearId)),
    ).toHaveLength(0);
  });
});
