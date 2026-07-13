# TaxReturns — Project Guide for Claude Code

You are working inside the `taxdev` Ubuntu dev container on **TaxReturns**: a web
app for preparing and tracking Israeli personal income-tax returns (דוח שנתי).
The owner (Matan) uploads source documents — Form 106 (טופס 106, salary), Form
867 (broker capital gains/losses), charity receipts (קבלות תרומה, סעיף 46) — and
the app extracts the data with AI (human-reviewed), calculates the refund with a
fully auditable worksheet, and produces a Form 1301 field map for filing.
Phase 1 is single-user (the owner). Multi-user and multi-country are designed
for but NOT built now.

**Read these before non-trivial work:**
- Design spec (approved): `docs/superpowers/specs/2026-07-03-tax-returns-app-design.md`
- Completed foundation plan (example of our plan format): `docs/superpowers/plans/2026-07-03-foundation.md`

## Current state (Plan 5 filing & lifecycle complete, 2026-07-13)

All green (root `pnpm test`: shared 42, tax-engine 83, api 92, web 55 — clean
typecheck; engine branch coverage 98.82%, ≥95% gate). The calculation loop is
closed end-to-end: confirmed data → `calculate()` → append-only snapshot →
worksheet panel + Form 1301 filing view → year status flow. Note: the api
integration suite needs the compose `db` container up (it has no restart
policy — consider adding `restart: unless-stopped`; if it's down every
`pipeline.test.ts` run fails at DB setup).

| Package | What exists |
|---|---|
| `packages/shared` | Branded `Agorot` money module; `Form106Schema`/`Form867Schema`/`CharityReceiptSchema` (Zod, `documentSchemas` map); `AuthUserSchema` |
| `packages/api` | Fastify 5, `buildApp(deps?)` with injectable `db`/`storage`/`anthropic`/`googleVerifier`; Drizzle schema, all 7 tables migrated; **Google Sign-In**: `POST /auth/google` (ID-token verify via `google-auth-library`, single-owner-email allowlist), `GET /auth/me`, `POST /auth/logout`, `@fastify/secure-session` cookie, global fail-closed auth-gate `preHandler` (only `GET /health` and `POST /auth/google` are public) — see `docs/superpowers/plans/2026-07-06-google-sign-in.md`; document pipeline: `Storage`/`LocalDiskStorage`, multipart upload, Claude-vision extraction (`ExtractionClient` injectable), `pending→extracted→confirmed|failed`, manual-entry fallback — see `docs/superpowers/plans/2026-07-04-document-pipeline.md`; **Plan 5 filing/lifecycle**: `POST /tax-years/:id/calculate` (maps confirmed data → engine, append-only `calculations` snapshot stamped `ENGINE_VERSION`, engine errors → 400 Hebrew, `metadata.excludedDonations`), `GET /tax-years/:id/calculation` (+`stale`), `PATCH /tax-years/:id/status` (server-enforced legal-transition map, `filedAt` on filing), `refundEstimateAgorot` in `GET /tax-years`; loss carry-forward across years — unique `(user_id, from_year, kind)` (migration `0001`) + `onConflictDoUpdate` so concurrent recalcs can't duplicate, IN-sum filtered to `kind='capital'` |
| `packages/web` | React 18 + Vite, Hebrew RTL, Tailwind v4 (logical properties only) + Radix + TanStack Router/Query; Dashboard (year list, Hebrew status chips, add-year capped at the current calendar year), tax-year detail (documents panel with upload + per-row review link), and **document review** (`/tax-years/$id/documents/$id`: file viewer w/ zoom, kind-specific forms, uncertain-field highlighting, extract/manual-entry/confirm) screens, styled; **Google Sign-In**: `/sign-in` screen (`@react-oauth/google`), `useAuth()` hook, router `beforeLoad` guard, header sign-out — see `docs/superpowers/plans/2026-07-06-google-sign-in.md`; **Plan 5**: calculation **worksheet panel** in the tax-year detail (taxpayer form → `POST /calculate`, full auditable breakdown — brackets, credit points, pension/charity credits, capital-gains offsets + carry-forward, surtax, totals, refund/owed headline, stale + carry-forward notices, audit stamp; validity owned by shared `CalculateRequestSchema`, form `noValidate` so the Hebrew error isn't swallowed by native input constraints), **Form 1301 filing view** (`/tax-years/$id/filing`: `form1301Fields` transcription table rendered generically with owner-verification warning + status-flow controls offering only legal transitions) |
| `infra/` | `docker-compose.yml`: db (postgres:17) + api (:3000) + web (:5173); web's Vite proxy targets `http://api:3000` via `VITE_API_PROXY_TARGET` (Compose service-name DNS) |
| `packages/tax-engine` | Pure TS engine (`calculate(input) → TaxReturnResult`, `ENGINE_VERSION`): IL 2024+2025 year data, **all constants owner-verified 2026-07-05** (`docs/superpowers/research/2026-07-05-tax-constants-verification.md` — zero corrections needed), modules for income-tax brackets, credit points, charity §46, capital gains w/ loss offset + carry-forward, pension §45א, surtax incl. 2025 2% capital add-on, informational NI reconciliation; `form1301Fields` map — **official codes owner-verified 2026-07-13** (`docs/superpowers/research/2026-07-12-form1301-codes-verification.md`): 158/042/045 confirmed, donations → 037 (RAW amount), securities withholding → 040, loss carry-forward out → 166; surtax/liability/refund are code-less named worksheet outputs (no main-form field). `ENGINE_VERSION` = `il-0.2.0` |

**⚠️ Auth changes phase-1 scope.** The design spec (§1) originally listed
authentication as out of scope for phase 1 ("single-user, running locally,
no auth needed"). Google Sign-In was added 2026-07-06 on explicit owner
request — the app is still effectively single-user (one allowed email via
`OWNER_GOOGLE_EMAIL`), this is a real identity check replacing the old
auto-created-default-user trick, not multi-user support. Before restarting
the live containers on this code: `GOOGLE_CLIENT_ID` (Google Cloud Console
OAuth client), `OWNER_GOOGLE_EMAIL`, and `SESSION_SECRET` (`openssl rand
-hex 32`) must be set in `packages/api/.env` (+ `VITE_GOOGLE_CLIENT_ID` in
`packages/web/.env`) or every route becomes unreachable with no way to sign
in — see `.env.example`.

## What the website still needs (build order)

Each phase gets a written plan in `docs/superpowers/plans/` before code (spec §10):

1. ~~**Plan 2 — tax-engine core**~~ DONE 2026-07-04, constants verified
   2026-07-05. Left open on purpose: children/degree/oleh credit-point
   tables (reviewer enters verified totals via `additionalCreditPoints`
   until their own plan — draft source-annotated tables already researched
   in the verification report above), §47 deductions, 15% non-linked-interest
   cases.
2. ~~**Plan 3 — document pipeline**~~ DONE 2026-07-05.
3. ~~**Plan 4 — UI screens**~~ DONE 2026-07-06 incl. the document review
   screen (`docs/superpowers/plans/2026-07-06-document-review-screen.md`):
   source file (`GET /documents/:id/file`, RFC 5987 Hebrew-filename safe)
   beside a kind-specific extracted-fields form, uncertain fields
   highlighted, extract / manual-entry / confirm per status, client-side
   validation via the shared Zod schemas, duplicate-box-code and
   blank/overflow money guards (reviewer-agent findings, all fixed).
4. **Google Sign-In** DONE 2026-07-06 (see current-state table) — not a
   numbered spec plan, added mid-stream on owner request.
5. ~~**Plan 5 — filing & lifecycle**~~ DONE 2026-07-13
   (`docs/superpowers/plans/2026-07-07-calculation-and-filing.md`): calculate
   endpoint + append-only snapshots, worksheet panel, Form 1301 filing view,
   year status flow draft→in_review→ready_to_file→filed→amended, loss
   carry-forward across years (unique-constrained + upsert to survive
   concurrent recalcs), backup script. **Form 1301 field codes owner-verified**
   against the official 2024/2025 forms
   (`docs/superpowers/research/2026-07-12-form1301-codes-verification.md`):
   donations → field 037 (RAW amount; Authority applies §46 rate/ceilings),
   securities withholding → 040 (042 salary-only), loss carry-forward out →
   166; ENGINE_VERSION → il-0.2.0.

## Non-negotiable conventions

- **Money is integer agorot** (`Agorot` brand from `@taxreturns/shared`). Never
  binary floats. DB money columns are `bigint`.
- **Zod schemas in `packages/shared` are the single source of truth** — API
  validation, extraction structured-output, and UI forms all derive from them.
- **UI is Hebrew RTL first**: every user-visible string goes through i18next
  (`resources.he.translation` in `src/i18n.ts`); CSS logical properties only
  (`ms-`/`me-`, never `ml-`/`mr-`); official Tax Authority terminology and box
  codes as labels.
- **TDD**: failing test → run it → implement → pass → commit. The tax engine
  especially: it fails loudly (typed errors), never silently defaults a number.
- **The engine's only input is `confirmed_data`** (what the user approved),
  never raw `extracted_fields`. Calculations are append-only snapshots stamped
  with `engineVersion`.
- **Tax-law constants must cite official sources** in comments; the owner
  verifies them. Do not invent or "remember" bracket values without a source
  annotation.
- Conventional commits (`feat(scope): ...`); ESM everywhere; TS strict; Vitest.
  Root `pnpm test` and `pnpm typecheck` must pass before every commit.

## Environment gotchas (this dev container)

- You share the **host** Docker daemon. App containers are **siblings**:
  reach their published ports via `host.docker.internal` (e.g.
  `postgresql://tax:tax@host.docker.internal:5432/taxreturns` — already in
  `packages/api/.env`), NOT `localhost`.
- **Never run `docker compose up` for the api/web services from inside this
  container** — the `..:/app` bind resolves to a container-only path and mounts
  empty. Compose up/recreate runs on the Windows host; ask the owner. (Plain
  `docker compose exec db psql ...` is fine from here.)
- `node_modules` dirs and `.pnpm-store` are Linux-native named volumes overlaid
  on the Windows bind mount — do not delete them; without them module loading
  is 8–15s. If a root-owned file appears in them (containers write as root),
  `sudo chown` it.
- Vite's dev server rejects the `host.docker.internal` Host header; check it
  with `curl -H "Host: localhost:5173" http://host.docker.internal:5173`.
- `.env` files are git-ignored (`packages/api/.env`, `packages/web/.env`);
  `.env.example` at repo root and in `packages/web/` are the templates.
  Secrets: `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_ID`/`VITE_GOOGLE_CLIENT_ID`,
  `OWNER_GOOGLE_EMAIL`, `SESSION_SECRET`. Each package's `dotenv`/Vite env
  loading resolves `.env` relative to that package's own directory (pnpm
  `--filter` sets cwd there), not the repo root — the root `.env.example`
  is a template to copy from, not a file either package reads directly.
- Superpowers plugin is installed: use brainstorming → writing-plans →
  TDD/executing-plans for new feature work; plans live in
  `docs/superpowers/plans/`, specs in `docs/superpowers/specs/`.
