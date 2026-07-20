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

## Current state (stored taxpayer profile complete, 2026-07-16; engine at il-0.7.1)

All green (root `pnpm test`: shared 89, tax-engine 223, api 124, web 114 — clean
typecheck; engine branch coverage 99.2%, ≥95% gate). The calculation loop is
closed end-to-end: confirmed data → `calculate()` → append-only snapshot →
worksheet panel + Form 1301 filing view → year status flow. Note: the api
integration suite needs the compose `db` container up (all three services
carry `restart: unless-stopped` as of 2026-07-16 — but if the Docker daemon
itself was restarted with the stack stopped, every `pipeline.test.ts` run
fails at DB setup until the owner brings it up on the host).

| Package | What exists |
|---|---|
| `packages/shared` | Branded `Agorot` money module; `Form106Schema`/`Form867Schema`/`CharityReceiptSchema` (Zod, `documentSchemas` map); `AuthUserSchema`; `CalculateRequestSchema` incl. optional structured `taxpayer.children`/`aliyah`/`degrees` (**structural shape only** — enums/ints/domain bounds; all legal validation stays in the engine, whose Hebrew 400s surface in the UI; absent fields stay absent as keys so the engine sees `undefined`) |
| `packages/api` | Fastify 5, `buildApp(deps?)` with injectable `db`/`storage`/`anthropic`/`googleVerifier`; Drizzle schema, all 8 tables migrated; **Google Sign-In**: `POST /auth/google` (ID-token verify via `google-auth-library`, single-owner-email allowlist), `GET /auth/me`, `POST /auth/logout`, `@fastify/secure-session` cookie, global fail-closed auth-gate `preHandler` (only `GET /health` and `POST /auth/google` are public) — see `docs/superpowers/plans/2026-07-06-google-sign-in.md`; document pipeline: `Storage`/`LocalDiskStorage`, multipart upload, Claude-vision extraction (`ExtractionClient` injectable), `pending→extracted→confirmed|failed`, manual-entry fallback — see `docs/superpowers/plans/2026-07-04-document-pipeline.md`; **Plan 5 filing/lifecycle**: `POST /tax-years/:id/calculate` (maps confirmed data → engine, append-only `calculations` snapshot stamped `ENGINE_VERSION`, engine errors → 400 Hebrew, `metadata.excludedDonations`), `GET /tax-years/:id/calculation` (+`stale`), `PATCH /tax-years/:id/status` (server-enforced legal-transition map, `filedAt` on filing), `refundEstimateAgorot` in `GET /tax-years`; loss carry-forward across years — unique `(user_id, from_year, kind)` (migration `0001`) + `onConflictDoUpdate` so concurrent recalcs can't duplicate, IN-sum filtered to `kind='capital'`; **taxpayer profile (2026-07-16,** `docs/superpowers/plans/2026-07-14-taxpayer-profile.md`**)**: `taxpayer_profiles` (migration `0002`, one jsonb row per user, unique `user_id` upsert) + `GET`/`PUT /profile` — a PRE-FILL convenience store only, **never read by the calculate route** (isolation test-enforced); payload validated on write by shared `TaxpayerProfileSchema` (strict; children by `yearOfBirth`, per-year fields rejected); **`GET /tax-years/:id/confirmed-data` (2026-07-16)** — the data panel's read-only projection via the SAME `mapConfirmedData` + carry-forward IN-sum the calculate route uses (document-derived fields only); **per-document deletion (2026-07-19,** `docs/superpowers/plans/2026-07-17-document-deletion.md`**)**: `DELETE /documents/:id` — cascade helper (`documents/cascade.ts`) shared with the tax-year delete, Hebrew 404 via the user-scoped join, 409 on a `filed` year, `tax_years.data_revised_at` (migration `0003`) set when confirmed rows are removed so the calculation `stale` flag flips on deletion too, document-scoped intruder sweep added to `pipeline.test.ts` |
| `packages/web` | React 18 + Vite, Hebrew RTL, Tailwind v4 (logical properties only) + Radix + TanStack Router/Query; Dashboard (year list, Hebrew status chips, add-year capped at the current calendar year), tax-year detail (documents panel with upload + per-row review link), and **document review** (`/tax-years/$id/documents/$id`: file viewer w/ zoom, kind-specific forms, uncertain-field highlighting, extract/manual-entry/confirm) screens, styled; **Google Sign-In**: `/sign-in` screen (`@react-oauth/google`), `useAuth()` hook, router `beforeLoad` guard, header sign-out — see `docs/superpowers/plans/2026-07-06-google-sign-in.md`; **Plan 5**: calculation **worksheet panel** in the tax-year detail (taxpayer form → `POST /calculate`, full auditable breakdown — brackets, credit points, pension/charity credits, capital-gains offsets + carry-forward, surtax, totals, refund/owed headline, stale + carry-forward notices, audit stamp; validity owned by shared `CalculateRequestSchema`, form `noValidate` so the Hebrew error isn't swallowed by native input constraints; **credit-points wiring 2026-07-14**: dynamic children rows / aliyah section / degrees rows in the taxpayer form, breakdown rows render the engine's Hebrew `label` (i18n reason as fallback, unique keys), and engine fail-loud 400s show their server Hebrew message in the form — e.g. children without a declared parentContext), **Form 1301 filing view** (`/tax-years/$id/filing`: `form1301Fields` transcription table rendered generically with owner-verification warning + status-flow controls offering only legal transitions); **taxpayer-profile pre-fill (2026-07-16)**: worksheet form pre-fills from `GET /profile` via pure `lib/taxpayer-profile.ts` mapping (derived `ageInTaxYear = taxYear − yearOfBirth`, out-of-range children omitted + Hebrew notice, fail-safe: fetch error/unparseable payload → empty form), explicit post-calculate "שמור לפרופיל" button (`PUT /profile` with inverted arithmetic; pre-fill state frozen at mount so edits/saves can't be clobbered or mislabelled); **confirmed-data panel (2026-07-16,** `docs/superpowers/plans/2026-07-16-confirmed-data-panel.md`**)**: the spec-§6 data panel is real (was a placeholder) — confirmed values grouped שכר/תרומות/שוק ההון from `GET /confirmed-data` (per-employer 158/042/045 rows, §46-excluded-receipts note, per-broker rows + carry-forward-in), read-only; corrections stay on the review screen; **per-document delete (2026-07-19)**: trash-icon + Radix AlertDialog per documents-panel row (`DeleteDocumentDialog`, shared `TrashIcon`; server Hebrew 409/404 renders inside the open dialog; success invalidates the documents/confirmed-data/calculation queries) |
| `infra/` | `docker-compose.yml`: db (postgres:17) + api (:3000) + web (:5173); web's Vite proxy targets `http://api:3000` via `VITE_API_PROXY_TARGET` (Compose service-name DNS) |
| `packages/tax-engine` | Pure TS engine (`calculate(input) → TaxReturnResult`, `ENGINE_VERSION`): IL 2024+2025 year data, **all constants owner-verified 2026-07-05** (`docs/superpowers/research/2026-07-05-tax-constants-verification.md` — zero corrections needed), modules for income-tax brackets, credit points, charity §46, capital gains w/ loss offset + carry-forward, pension §45א, 15% non-linked interest §125ג(ג)(1) (il-0.3.0; Form 1301 fields 078/043), surtax incl. 2025 2% capital add-on, informational NI reconciliation; `form1301Fields` map — **official codes owner-verified 2026-07-13** (`docs/superpowers/research/2026-07-12-form1301-codes-verification.md`): 158/042/045 confirmed, donations → 037 (RAW amount), securities withholding → 040, loss carry-forward out → 166; surtax/liability/refund are code-less named worksheet outputs (no main-form field); **structured credit points** (accumulator in integer twelfths of a point): children §40 all ages 0-18 via `taxpayer.children`, oleh §35 `pre2022`/`from2022` monthly schedules via `taxpayer.aliyah` (il-0.4.0, `docs/superpowers/plans/2026-07-13-credit-points.md`), degrees §40ג–§40ה bachelor/master/vocational claim windows via `taxpayer.degrees` — 2023+ fixed min(studyYears,cap), 2014-2022 elective year, internship deferral, §7(ב)/(ג) exclusivity; medicine/direct-track PhD + pre-2014 stay on `additionalCreditPoints` (il-0.5.0, `docs/superpowers/plans/2026-07-14-degree-credit-points.md`); **parent allocation §66(ג)/§40(ב) (il-0.6.0, 2026-07-14)**: `children[].role` replaced by filer-level `taxpayer.parentContext` (six regimes) + per-child context (`maintenanceShare`, טופס 116ד deferral flags); **enablement (il-0.7.0, 2026-07-15,** `docs/superpowers/plans/2026-07-15-parent-allocation-enablement.md`**)** consumed the ס"ח 3184 addendum (`docs/superpowers/research/2026-07-14-sah3184-parent-allocation-addendum.md`, enacted-law-verbatim): 6-17 band = 2 custodial / 1 other pts, father Schedule B all ages (`singleFatherOfToddler` → `singleFather`), הורה-יחיד stacks the §40(ב)(1א) column per §40(ב)(1ב), קצבה settled as **verified statutory 0** (NII-paid); still gated: the §40(ב)(2) multi-child fraction (owner ruling) + its rounding convention; structured inputs **wired end-to-end 2026-07-14** (`docs/superpowers/plans/2026-07-14-credit-points-wiring.md`): shared Zod → API pass-through (type-drift-guarded, snapshot stores the full input) → worksheet form (incl. regime picker) + labelled breakdown; **il-0.7.1 (2026-07-16)**: the §40(ב)(1א) attach-to-the-mother proviso row surfaces at 0 points (`surfaceWhenZero` — no-black-box nit closed; totals unchanged). `ENGINE_VERSION` = `il-0.7.1` |

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
   2026-07-05. The items it left open have since landed in follow-on
   increments: 15% non-linked interest (il-0.3.0), children+oleh credit
   points (il-0.4.0), degrees §40ג–§40ה (il-0.5.0) — see the tax-engine row
   and item 6 below. Still open: §47 deductions (plan written,
   `docs/superpowers/plans/2026-07-13-section47-deductions.md`).
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
6. ~~**Credit-points increments — children+oleh (il-0.4.0) and degrees
   (il-0.5.0)**~~ DONE 2026-07-14
   (`docs/superpowers/plans/2026-07-13-credit-points.md`,
   `docs/superpowers/plans/2026-07-14-degree-credit-points.md`): structured
   `children`/`aliyah`/`degrees` engine inputs, all counts read from the
   primary-source research reports; every not-yet-verified rule (6-17 child
   band, clock-pausing, pre-2022 cohort boundary) ships disabled/loud with
   `additionalCreditPoints` as the reviewer fallback.
7. ~~**Credit-points downstream wiring**~~ DONE 2026-07-14
   (`docs/superpowers/plans/2026-07-14-credit-points-wiring.md`): shared Zod
   sub-schemas (structural only — the engine keeps sole ownership of legal
   rules), API pass-through proven by type-drift assertions + route tests
   (snapshot stores the full input), worksheet breakdown hardening (engine
   labels, unique keys, server Hebrew errors) and children/aliyah/degrees
   form sections. No engine change; `ENGINE_VERSION` stays `il-0.5.0`.
   **Still ahead:** §47 deductions (plan written, deferred pending owner
   scope call).
8. ~~**Parent allocation (il-0.6.0)**~~ DONE 2026-07-14
   (`docs/superpowers/plans/2026-07-13-parent-allocation.md` + its
   implementation-reconciliation section): regime-aware child-point
   allocation end-to-end (engine rules module → shared Zod `parentContext`
   → api tests → worksheet regime picker). Disabled-loud pending owner
   sign-off: father Schedule B, mother 6-17 band, §40(ב)(2) multi-child
   fraction; קצבה §66(ג)(3) ships 0+TODO. **The ס"ח 3184 addendum
   (2026-07-14, primary: the enacted law read verbatim) closes most of
   those** — father 0-5 bands + 1 pt 6-17, mother 6-17 = 2 pts, קצבה = 0
   permanent — and flags one new question (הורה יחיד stacks both parents'
   columns per the ITA instruction; current `singleParent` under-grants).
9. ~~**Parent-allocation enablement (il-0.7.0)**~~ DONE 2026-07-15
   (`docs/superpowers/plans/2026-07-15-parent-allocation-enablement.md`):
   consumed the ס"ח 3184 addendum — 6-17 band (2/1 pts), father Schedule B
   all ages 0-17 (`singleFather` rename, mother-claims proviso kept),
   הורה-יחיד §40(ב)(1ב) column stacking (fixes the under-grant), קצבה
   relabelled as verified statutory 0. §40(ב)(1ב) was re-read verbatim from
   the consolidated text before coding. Still gated: §40(ב)(2) multi-child
   fraction + rounding (owner rulings, not research gaps). Owner-eye items:
   ס"ח 3048 רשומות-verbatim (login-walled; effect confirmed 3 ways) and the
   0-5 stacking scope for הורה יחיד (statutory cross-reference is all-ages;
   the ITA tables shown only for 6-17).
10. ~~**Stored taxpayer profile**~~ DONE 2026-07-16
    (`docs/superpowers/plans/2026-07-14-taxpayer-profile.md`): shared strict
    `TaxpayerProfileSchema` → `taxpayer_profiles` + `GET`/`PUT /profile`
    (migration `0002`) → worksheet pre-fill with derived ages + explicit
    save-to-profile. Pre-fill convenience ONLY — no server-side merge into
    calculations (test-enforced). Reviewer pass applied (year-resolution
    race, frozen pre-fill notice, loud blank-aliyah save). **Owner-decide
    items live in the plan** (auto-save nudge, date-of-birth precision,
    DELETE /profile retention, maintenanceShare storage); the browser-level
    E2E pass awaits a stack restart on the host (api container was down;
    contract covered by real-Postgres integration tests). **Next engine
    step:** none scheduled — §47 deductions are **deferred by owner scope
    call (2026-07-16)**: no qualifying income on the actual return (single
    employer, fully-insured, no independent fund), so every §47/§17(5א)
    amount is 0. The plan is fully build-ready if the income profile ever
    changes (rates, ceilings AND ordering all primary-confirmed — see
    `2026-07-16-section47-ordering-addendum.md`: surtax post-§47, §45א cap
    pre-§47, §47(ג) anti-double-dip).

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
