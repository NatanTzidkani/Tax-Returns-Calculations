# Google Sign-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate the app behind Google Sign-In. The owner signs in with their
Google account via the "Sign in with Google" button (Google Identity
Services); the server verifies the ID token, checks it matches the single
configured owner email, and issues a session cookie. All existing routes
(except `/health` and the sign-in endpoint itself) require a valid session.

**Why now, deviating from the spec's "no auth in phase 1":** explicit owner
request. The app is still effectively single-user — this replaces the
"auto-create a default user on first request" trick with a real identity
check, it does not add multi-user support. `packages/api/CLAUDE.md`'s
current-state table and the "Out of scope for phase 1" line in the design
spec should be updated once this lands (Task 6).

**Architecture:** Google Identity Services (GIS) — the modern "Sign in with
Google" button — returns a signed **ID token** (a JWT) to the browser. The
browser POSTs that token to the API; the API verifies it against Google's
public keys via `google-auth-library` (audience = our client ID, so no
client *secret* is needed — this is the credential/One-Tap flow, not the
OAuth redirect/code-exchange flow). No new external round trip from our
server to Google is needed per sign-in. On success the API upserts a
`users` row by email (reusing the existing unique-email column) and sets an
encrypted, signed session cookie via `@fastify/secure-session` containing
`userId`. A `requireAuth` preHandler protects every route except `/health`
and `POST /auth/google`.

**Owner setup required (cannot be done from this container):** create an
OAuth 2.0 Client ID in Google Cloud Console (APIs & Services → Credentials →
"OAuth client ID" → Web application), add authorized JavaScript origin
`http://localhost:5173` (and whatever production origin later), and put the
resulting client ID in `.env` as `GOOGLE_CLIENT_ID`. No client secret is
needed for this flow. The owner also sets `OWNER_GOOGLE_EMAIL` (the only
email allowed to sign in) and a random 32+ byte `SESSION_SECRET`.

**Testing:** Backend injects a fake Google-token verifier (same pattern as
`ExtractionClient` in the document pipeline) so tests never call the real
Google API. Frontend mocks the auth client entirely, same as existing
screens.

## Global Constraints

- `/health` stays public (Docker healthchecks). Every other route requires
  a session.
- No client secret in the codebase or env — the ID-token flow only needs
  the (public) client ID.
- Session cookie is httpOnly, secure in production, `sameSite: lax`.
- Money/Hebrew/logical-property/TDD conventions from CLAUDE.md apply as usual.
- Root `pnpm test` and `pnpm typecheck` green before every commit.

---

### Task 1: shared — auth payload types

**Files:** `packages/shared/src/auth.ts` (new), test, export from index.

Small Zod schema for what the API returns from `/auth/me` and
`/auth/google`: `AuthUserSchema = z.object({ id: z.string().uuid(), email:
z.string().email() })`. Not much logic here — this just keeps the "Zod in
shared is the source of truth" rule intact for the one new payload shape.

- [ ] Write `AuthUserSchema` + test (valid/invalid shapes).
- [ ] Export from `packages/shared/src/index.ts`.
- [ ] Commit `feat(shared): auth user schema`.

### Task 2: api — Google ID-token verification + session plugin

**Files:** `packages/api/src/auth/verify-google-token.ts`,
`packages/api/src/auth/session.ts`, `packages/api/src/app.ts` (register
`@fastify/secure-session`), `package.json` (add `google-auth-library`,
`@fastify/secure-session`).

**Interfaces:**
- `GoogleTokenVerifier` injectable interface (mirrors `ExtractionClient`):
  `verifyIdToken(idToken: string): Promise<{ email: string; emailVerified:
  boolean; sub: string } | null>` (null = invalid/unverifiable token — never
  throw for a bad token, that's an expected case, not a bug).
- Real implementation wraps `google-auth-library`'s `OAuth2Client` with
  `audience: process.env.GOOGLE_CLIENT_ID`.
- `AppDeps` gains `googleVerifier?: GoogleTokenVerifier`, resolved lazily
  like `anthropic`/`storage`.
- `@fastify/secure-session` registered with `key` derived from
  `process.env.SESSION_SECRET` (throw a clear startup error if unset AND
  `NODE_ENV === 'production'`; a fixed insecure dev-only fallback is fine
  for `test`/local so `buildApp()` keeps working without env in tests).

- [ ] Failing tests for `verify-google-token.ts` against a fake HTTP/JWKS
      layer or by injecting a fake `OAuth2Client`-shaped object — whichever
      keeps the real `google-auth-library` code path exercised without a
      network call. Cover: valid token → user info; wrong audience →
      null; expired/malformed → null (library throws, we catch and return
      null).
- [ ] Implement; green.
- [ ] Commit `feat(api): google id-token verification`.

### Task 3: api — auth routes + requireAuth preHandler

**Files:** `packages/api/src/routes/auth.ts` (new), `src/app.ts` (register
route + global `preHandler` gate), `src/routes/tax-years.ts` (remove
`defaultUserId()`, read `req.session.get('userId')` instead),
`src/routes/documents.ts` (same, wherever it resolves the acting user).

**Routes:**
- `POST /auth/google { credential }` → verify via `deps.googleVerifier`;
  400 Hebrew if body invalid; 401 Hebrew if token invalid/unverifiable;
  403 Hebrew if `emailVerified` false or email ≠
  `process.env.OWNER_GOOGLE_EMAIL` (case-insensitive); on success upsert
  `users` row by email (`onConflictDoNothing`, then select — same pattern
  the old `defaultUserId()` used), `req.session.set('userId', user.id)`,
  return `{ id, email }` (201 first sign-in, 200 subsequent — or just 200
  both times, keep it simple).
- `GET /auth/me` → 401 Hebrew if no session `userId`; else `{ id, email }`.
- `POST /auth/logout` → `req.session.delete()`; 204.
- Global `preHandler` on the Fastify instance (skip for `/health` and
  `POST /auth/google`): 401 Hebrew `{message}` if
  `req.session.get('userId')` is missing.

- [ ] Failing integration tests in `test/pipeline.test.ts` (or a new
      `test/auth.test.ts`) using the fake verifier: sign-in with matching
      owner email sets a session and `Set-Cookie` header; sign-in with a
      different email → 403; `/auth/me` without a cookie → 401; with the
      cookie from a successful sign-in (reuse `app.inject`'s cookie
      jar/manually pass the `Set-Cookie` value back as `Cookie` on the next
      `inject` call) → 200; every existing tax-years/documents test now
      needs the session cookie attached first, or those tests need a small
      test helper `signInAndGetCookie(app)` that does the fake-verifier
      sign-in once and returns the cookie header to reuse.
- [ ] Implement; green. Update every existing pipeline test to sign in
      first (this is the bulk of the diff — mechanical, not risky).
- [ ] Commit `feat(api): auth routes and session-gated pipeline routes`.

### Task 4: web — Google button, sign-in screen, auth-aware routing

**Files:** `packages/web/src/api/client.ts` (add
`signInWithGoogle`/`getMe`/`signOut`), `packages/web/src/screens/SignIn.tsx`
(new) + test, `packages/web/src/router.tsx` (new `/sign-in` route +
`beforeLoad` guard on the protected routes, auth-aware header with a
sign-out button), `package.json` (add `@react-oauth/google`).

**Interfaces:**
- `getMe()` returns `AuthUser | null` (client-side: catch a 401 `ApiError`
  and resolve `null` rather than throwing — callers shouldn't need to know
  the transport detail).
- `useAuth()` hook: `useQuery({ queryKey: ['auth', 'me'], queryFn: getMe,
  retry: false })`.
- Router `beforeLoad` on `dashboardRoute`/`taxYearDetailRoute`: uses
  `queryClient.ensureQueryData` for the me-query; `redirect({ to:
  '/sign-in' })` if null.
- `SignIn.tsx`: `<GoogleOAuthProvider clientId={import.meta.env
  .VITE_GOOGLE_CLIENT_ID}><GoogleLogin onSuccess={...} /></GoogleOAuthProvider>`,
  on success calls `signInWithGoogle(credential)` then navigates to `/`;
  on failure shows a Hebrew alert. All strings via i18next as usual.
- Header (`RootLayout` in `router.tsx`): when `useAuth()` resolves a user,
  show the email + a sign-out button (`signOut()` → invalidate the
  me-query → router redirects via the guard on next navigation).

- [ ] Failing component tests for `SignIn.tsx` (mock `@react-oauth/google`'s
      `GoogleLogin` — render a plain button in the mock, click it, assert
      `signInWithGoogle` called and navigation happened) and for the router
      guard (mock `getMe` to resolve `null`, assert landing on `/sign-in`
      when visiting `/`).
- [ ] Implement; keep every existing Dashboard/TaxYearDetail test passing —
      they'll need `getMe` mocked to resolve an authenticated user in
      `beforeEach` now that the guard exists.
- [ ] Commit `feat(web): google sign-in screen and auth-gated routing`.

### Task 5: independent review

Run the **reviewer** agent (`.claude/agents/reviewer.md`) against the full
diff before merging — this is security-sensitive (session handling, token
verification, the owner-email allowlist check). Address blocking findings
before merge.

### Task 6: docs + config + verification

- [ ] Update `.env.example`: add `GOOGLE_CLIENT_ID`, `OWNER_GOOGLE_EMAIL`,
      `SESSION_SECRET`; remove `DEFAULT_USER_EMAIL` (superseded).
- [ ] Update `infra/docker-compose.yml`: pass `GOOGLE_CLIENT_ID`,
      `OWNER_GOOGLE_EMAIL`, `SESSION_SECRET` through to the `api` service,
      and `VITE_GOOGLE_CLIENT_ID` to `web`.
- [ ] Update `CLAUDE.md`: current-state table gains auth; remove the
      "Out of scope for phase 1: authentication" line or annotate it as
      superseded with the date and reason.
- [ ] Root `pnpm test` + `pnpm typecheck` green.
- [ ] Note in the final report that live sign-in cannot be verified from
      this container without the owner's real `GOOGLE_CLIENT_ID` — that's
      an owner action, not a code gap.
