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
  await rm(storageDir, { recursive: true, force: true });
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
    ];
    for (const opts of protectedRoutes) {
      const res = await app.inject(opts);
      expect(res.statusCode).toBe(401);
      expect(res.json().message).toMatch(/[֐-׿]/);
    }
  });

  it('GET /health stays public — no auth required', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});
