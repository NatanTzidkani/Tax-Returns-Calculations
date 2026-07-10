import { OAuth2Client } from 'google-auth-library';

export interface GoogleUserInfo {
  email: string;
  emailVerified: boolean;
  sub: string;
}

/**
 * Injectable seam — tests supply a fake, the server wraps
 * google-auth-library's `OAuth2Client` (mirrors `ExtractionClient` in
 * `../extraction/extractor.ts`). Never throws for a bad token: an
 * invalid/expired/wrong-audience token is an expected case, not a bug, so
 * it resolves `null`.
 */
export interface GoogleTokenVerifier {
  verifyIdToken(idToken: string): Promise<GoogleUserInfo | null>;
}

/** The slice of `OAuth2Client` this wraps — injectable in tests without a network call. */
export interface OAuth2ClientLike {
  verifyIdToken(options: { idToken: string; audience: string }): Promise<{
    getPayload(): { email?: string; email_verified?: boolean; sub?: string } | undefined;
  }>;
}

export class GoogleAuthLibraryVerifier implements GoogleTokenVerifier {
  constructor(
    private readonly client: OAuth2ClientLike,
    private readonly audience: string,
  ) {}

  async verifyIdToken(idToken: string): Promise<GoogleUserInfo | null> {
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.audience,
      });
      const payload = ticket.getPayload();
      if (!payload?.email || !payload.sub) return null;
      return {
        email: payload.email,
        emailVerified: payload.email_verified === true,
        sub: payload.sub,
      };
    } catch {
      // Expired, malformed, wrong-signature, or wrong-audience tokens all
      // throw inside google-auth-library — all are just "not signed in".
      return null;
    }
  }
}

export function createGoogleTokenVerifier(): GoogleTokenVerifier {
  const audience = process.env.GOOGLE_CLIENT_ID;
  if (!audience) {
    throw new Error('GOOGLE_CLIENT_ID is not set');
  }
  return new GoogleAuthLibraryVerifier(new OAuth2Client(audience), audience);
}
