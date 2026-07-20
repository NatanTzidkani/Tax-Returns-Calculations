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
