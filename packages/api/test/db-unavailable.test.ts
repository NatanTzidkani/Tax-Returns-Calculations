import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { fakeGoogleVerifier } from './helpers/auth';

/**
 * A `db` whose first query throws exactly like node-postgres does when the
 * Postgres server is down (`code: 'ECONNREFUSED'`). The auth route calls
 * `db.insert(users)…` with no try/catch, so this reaches the global error
 * handler — which should classify it as a 503 outage, not a generic 500.
 */
function dbConnectionRefused() {
  const err = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), {
    code: 'ECONNREFUSED',
  });
  const throwing = () => {
    throw err;
  };
  return { insert: throwing, select: throwing } as never;
}

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('database unavailable', () => {
  it('POST /auth/google returns 503 (not 500) when the database is down', async () => {
    app = buildApp({
      db: dbConnectionRefused(),
      googleVerifier: fakeGoogleVerifier(),
    });

    const res = await app.inject({
      method: 'POST',
      url: '/auth/google',
      payload: { credential: 'fake-credential' },
    });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ message: 'השירות אינו זמין זמנית' });
  });
});
