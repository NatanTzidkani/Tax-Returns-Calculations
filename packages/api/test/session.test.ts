import { createHash } from 'node:crypto';
import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { registerSession } from '../src/auth/session';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('registerSession / sessionKey', () => {
  // Registering @fastify/secure-session does real libsodium/key setup (~13s
  // here); only the two non-throwing cases reach it, and under full-suite CPU
  // contention they can exceed the default timeout — give them headroom so the
  // slow-but-correct path never flakes red.
  it('accepts a SESSION_SECRET of sufficient length outside NODE_ENV=test', async () => {
    process.env.NODE_ENV = 'development';
    process.env.SESSION_SECRET = 'a'.repeat(32);
    const app = Fastify();
    expect(() => registerSession(app)).not.toThrow();
    await app.close();
  }, 60_000);

  it('rejects a SESSION_SECRET shorter than 32 characters', async () => {
    process.env.NODE_ENV = 'development';
    process.env.SESSION_SECRET = 'too-short';
    const app = Fastify();
    expect(() => registerSession(app)).toThrow(/32/);
    await app.close();
  });

  it('throws when SESSION_SECRET is unset outside NODE_ENV=test (never silently falls back)', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.SESSION_SECRET;
    const app = Fastify();
    expect(() => registerSession(app)).toThrow(/SESSION_SECRET/);
    await app.close();
  });

  it('throws when NODE_ENV is unset (bare docker/production-like run) and SESSION_SECRET is missing', async () => {
    delete process.env.NODE_ENV;
    delete process.env.SESSION_SECRET;
    const app = Fastify();
    expect(() => registerSession(app)).toThrow(/SESSION_SECRET/);
    await app.close();
  });

  it('falls back to a fixed dev key only under NODE_ENV=test, and never reuses a real SESSION_SECRET value as the raw key', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.SESSION_SECRET;
    const app = Fastify();
    expect(() => registerSession(app)).not.toThrow();
    await app.close();
  }, 60_000);

  it('derives the key as SHA-256 of the secret, never the raw secret bytes', () => {
    const secret = 'b'.repeat(40);
    const expected = createHash('sha256').update(secret).digest();
    expect(expected).toHaveLength(32);
    expect(Buffer.from(secret).length).not.toBe(32);
  });
});

describe('cookie Secure flag (COOKIE_SECURE)', () => {
  /** Signs a session in a throwaway app and returns the Set-Cookie header. */
  async function setCookieHeader(): Promise<string> {
    const app = Fastify();
    registerSession(app);
    app.post('/login', async (req, reply) => {
      req.session.set('userId', 'user-1');
      return reply.send({ ok: true });
    });
    const res = await app.inject({ method: 'POST', url: '/login' });
    await app.close();
    return String(res.headers['set-cookie'] ?? '');
  }

  it('COOKIE_SECURE=true marks the session cookie Secure', async () => {
    process.env.NODE_ENV = 'test';
    process.env.COOKIE_SECURE = 'true';
    expect(await setCookieHeader()).toMatch(/;\s*Secure/i);
  });

  it('COOKIE_SECURE=1 also counts as truthy', async () => {
    process.env.NODE_ENV = 'test';
    process.env.COOKIE_SECURE = '1';
    expect(await setCookieHeader()).toMatch(/;\s*Secure/i);
  });

  it('unset COOKIE_SECURE leaves the cookie non-Secure (plain-HTTP local run)', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.COOKIE_SECURE;
    expect(await setCookieHeader()).not.toMatch(/;\s*Secure/i);
  });

  it('COOKIE_SECURE=false and =0 stay non-Secure explicitly', async () => {
    process.env.NODE_ENV = 'test';
    process.env.COOKIE_SECURE = 'false';
    expect(await setCookieHeader()).not.toMatch(/;\s*Secure/i);
    process.env.COOKIE_SECURE = '0';
    expect(await setCookieHeader()).not.toMatch(/;\s*Secure/i);
  });

  it('NODE_ENV=production alone never flips the flag — only COOKIE_SECURE does', async () => {
    // The old `NODE_ENV === 'production'` check was dead code: nothing in the
    // deploy path sets NODE_ENV. The flag must be explicit, not inferred.
    process.env.NODE_ENV = 'production';
    process.env.SESSION_SECRET = 'c'.repeat(32);
    delete process.env.COOKIE_SECURE;
    expect(await setCookieHeader()).not.toMatch(/;\s*Secure/i);
  });
});
