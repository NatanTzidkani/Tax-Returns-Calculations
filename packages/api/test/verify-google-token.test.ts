import { describe, expect, it } from 'vitest';
import {
  GoogleAuthLibraryVerifier,
  type OAuth2ClientLike,
} from '../src/auth/verify-google-token';

const AUDIENCE = 'test-client-id.apps.googleusercontent.com';

function fakeClient(
  behavior:
    | { payload: { email?: string; email_verified?: boolean; sub?: string } }
    | { throws: Error },
): OAuth2ClientLike {
  return {
    verifyIdToken: async (options) => {
      expect(options.audience).toBe(AUDIENCE);
      if ('throws' in behavior) throw behavior.throws;
      return { getPayload: () => behavior.payload };
    },
  };
}

describe('GoogleAuthLibraryVerifier', () => {
  it('returns user info for a valid, verified token', async () => {
    const verifier = new GoogleAuthLibraryVerifier(
      fakeClient({
        payload: { email: 'owner@example.com', email_verified: true, sub: '12345' },
      }),
      AUDIENCE,
    );
    await expect(verifier.verifyIdToken('good-token')).resolves.toEqual({
      email: 'owner@example.com',
      emailVerified: true,
      sub: '12345',
    });
  });

  it('resolves null (never throws) when the library rejects a wrong-audience/expired/malformed token', async () => {
    const verifier = new GoogleAuthLibraryVerifier(
      fakeClient({ throws: new Error('Wrong recipient, payload audience != requiredAudience') }),
      AUDIENCE,
    );
    await expect(verifier.verifyIdToken('bad-token')).resolves.toBeNull();
  });

  it('resolves null when the payload is missing an email or sub', async () => {
    const verifier = new GoogleAuthLibraryVerifier(
      fakeClient({ payload: { email_verified: true } }),
      AUDIENCE,
    );
    await expect(verifier.verifyIdToken('token')).resolves.toBeNull();
  });

  it('marks emailVerified false when the payload omits it', async () => {
    const verifier = new GoogleAuthLibraryVerifier(
      fakeClient({ payload: { email: 'x@example.com', sub: '1' } }),
      AUDIENCE,
    );
    await expect(verifier.verifyIdToken('token')).resolves.toEqual({
      email: 'x@example.com',
      emailVerified: false,
      sub: '1',
    });
  });
});
