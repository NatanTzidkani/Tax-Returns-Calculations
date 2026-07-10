import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';
import type { GoogleTokenVerifier } from '../../src/auth/verify-google-token';

/** The only "owner" email these tests are allowed to sign in as. */
export const OWNER_EMAIL = 'owner@example.com';
process.env.OWNER_GOOGLE_EMAIL = OWNER_EMAIL;

/**
 * Fake Google verifier — tests never call the real Google API (mirrors the
 * fake `ExtractionClient` used for extraction tests).
 */
export function fakeGoogleVerifier(
  overrides: Partial<{ email: string; emailVerified: boolean; sub: string }> = {},
): GoogleTokenVerifier {
  const info = { email: OWNER_EMAIL, emailVerified: true, sub: 'fake-sub', ...overrides };
  return {
    verifyIdToken: async () => info,
  };
}

/** A verifier that always rejects — simulates an invalid/expired token. */
export function fakeGoogleVerifierRejecting(): GoogleTokenVerifier {
  return { verifyIdToken: async () => null };
}

/**
 * Signs in via POST /auth/google (fake verifier) and returns the `Cookie`
 * header value to attach to subsequent `app.inject` calls.
 *
 * Deliberately reads the raw `Set-Cookie` response header rather than
 * light-my-request's parsed `res.cookies[].value` — that value is
 * percent-*decoded*, and @fastify/secure-session's payload contains a
 * literal `;` once decoded, which truncates a hand-built `Cookie:` header.
 * The raw header is still percent-encoded, exactly like a real browser
 * would send it back.
 */
export async function signInAndGetCookie(app: FastifyInstance): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/google',
    payload: { credential: 'fake-credential' },
  });
  if (res.statusCode !== 200) {
    throw new Error(`signInAndGetCookie: sign-in failed (${res.statusCode}): ${res.body}`);
  }
  const setCookie = res.headers['set-cookie'];
  const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (!raw) {
    throw new Error('signInAndGetCookie: no Set-Cookie header in the sign-in response');
  }
  return raw.split(';')[0]!;
}

/** Wraps `app.inject`, attaching a session `Cookie` header to every call. */
export function authedInjector(
  app: FastifyInstance,
  cookie: string,
): (opts: InjectOptions) => Promise<LightMyRequestResponse> {
  return (opts: InjectOptions) =>
    app.inject({ ...opts, headers: { ...opts.headers, cookie } });
}
