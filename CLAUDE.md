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

## Current state (foundation + tax-engine core, 2026-07-04)

All green (99 tests, clean typecheck; engine gated at ≥95% branch coverage):

| Package | What exists |
|---|---|
| `packages/shared` | Branded `Agorot` money module (`agorot`, `addAgorot`, `shekelsToAgorot`, `formatILS`); `Form106Schema` (Zod) — 3-digit box codes → integer agorot |
| `packages/api` | Fastify 5, `buildApp()` in `src/app.ts`, `GET /health`; Drizzle schema `src/db/schema.ts` with all 7 tables **migrated** (users, tax_years, documents, extracted_fields, confirmed_data, calculations, loss_carryforward); `getDb()` in `src/db/client.ts` |
| `packages/web` | React 18 + Vite, Hebrew RTL shell (`lang="he" dir="rtl"`), i18next initialized in `src/i18n.ts` (he only), placeholder dashboard |
| `infra/` | `docker-compose.yml`: db (postgres:17, :5432) + api (:3000) + web (:5173), localhost-bound; `infra/dev/` this dev container |
| `packages/tax-engine` | Pure TS engine (`calculate(input) → TaxReturnResult`, `ENGINE_VERSION`): IL 2024+2025 year data (frozen-law aware, every constant source-annotated — **owner verification of constants still pending**), modules for income-tax brackets, credit points (resident/gender + reviewer-entered extras), charity §46, capital gains w/ loss offset + carry-forward, pension §45א, surtax incl. 2025 2% capital add-on, informational NI reconciliation; `form1301Fields` map (official 1301 codes owner-verified in Plan 5). Plan: `docs/superpowers/plans/2026-07-04-tax-engine-core.md` |

## What the website still needs (build order)

Each phase gets a written plan in `docs/superpowers/plans/` before code (spec §10):

1. ~~**Plan 2 — tax-engine core**~~ DONE 2026-07-04 (see table above). Left
   open on purpose: children/degree/oleh credit-point tables (reviewer enters
   verified totals via `additionalCreditPoints` until their own plan), §47
   deductions, 15% non-linked-interest cases, and owner verification of every
   year-data constant.
2. **Plan 3 — document pipeline** (next): `Storage` interface (local disk first);
   `POST /documents` multipart upload; extraction via Claude API vision with the
   Zod schema as structured-output tool (map printed box codes, not layout);
   `Form867Schema` + `CharityReceiptSchema` in shared; statuses
   pending→extracted→confirmed|failed; manual-entry fallback; extraction is
   synchronous (no queue).
3. **Plan 4 — UI screens**: Tailwind (logical properties only) + Radix
   primitives + TanStack Router/Query; Dashboard (year status chips, deadlines,
   refund estimate); Tax-year detail (documents / data / calculation worksheet
   panels — every number traceable to source doc + rule + year constant);
   Document review (image ⇄ extracted fields side-by-side, uncertain fields
   highlighted).
4. **Plan 5 — filing & lifecycle**: Form 1301 field-map view; year status flow
   draft→in_review→ready_to_file→filed→amended; loss carry-forward across
   years; backup script (pg_dump + documents tar).

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
- `.env` files are git-ignored; `.env.example` is the template. The Anthropic
  API key is the only secret.
- Superpowers plugin is installed: use brainstorming → writing-plans →
  TDD/executing-plans for new feature work; plans live in
  `docs/superpowers/plans/`, specs in `docs/superpowers/specs/`.
