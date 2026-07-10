import { createHash } from 'node:crypto';
import secureSession from '@fastify/secure-session';
import type { FastifyInstance, FastifyRequest } from 'fastify';

declare module '@fastify/secure-session' {
  interface SessionData {
    userId: string;
  }
}

// Fixed, publicly-known, TEST-only fallback (see sessionKey() below). Its
// only job is to let buildApp() work without env vars set in the test
// suite. Deliberately gated on NODE_ENV==='test' rather than
// NODE_ENV!=='production': nothing in this repo's docker-compose/deploy
// path ever sets NODE_ENV=production, so gating on that would let this
// well-known string silently sign real sessions (anyone who reads this
// file can compute the exact key and forge a valid userId cookie).
const DEV_FALLBACK_SESSION_SECRET =
  'taxreturns-insecure-dev-only-session-secret-do-not-use-in-production';

const MIN_SESSION_SECRET_LENGTH = 32;

/** @fastify/secure-session needs a 32-byte key; SHA-256 gets us there from any-length input. */
function sessionKey(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (secret) {
    if (secret.length < MIN_SESSION_SECRET_LENGTH) {
      throw new Error(
        `SESSION_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} characters ` +
          `(got ${secret.length}) — generate one with \`openssl rand -hex 32\``,
      );
    }
    return createHash('sha256').update(secret).digest();
  }
  if (process.env.NODE_ENV === 'test') {
    return createHash('sha256').update(DEV_FALLBACK_SESSION_SECRET).digest();
  }
  throw new Error(
    'SESSION_SECRET must be set (32+ random bytes, e.g. `openssl rand -hex 32`) — ' +
      'the insecure fallback key is only used when NODE_ENV=test',
  );
}

/** Mirrors how `multipart` is registered in app.ts: deferred, not awaited. */
export function registerSession(app: FastifyInstance): void {
  app.register(secureSession, {
    key: sessionKey(),
    cookie: {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    },
  });
}

/**
 * Reads the session's userId. Safe to call unconditionally in any route
 * behind the global auth-gate preHandler in app.ts, which already rejects
 * the request with 401 before the handler runs if it's missing.
 */
export function requireUserId(req: FastifyRequest): string {
  const userId = req.session.get('userId');
  if (!userId) {
    throw new Error(
      'requireUserId() called on an unauthenticated request — the global auth gate should have already rejected it',
    );
  }
  return userId;
}
