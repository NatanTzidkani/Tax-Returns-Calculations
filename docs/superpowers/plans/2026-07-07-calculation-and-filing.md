# Calculation Wiring + Filing & Lifecycle Plan (Plan 5, incl. the calculate bridge)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the loop the spec's data flow promises (§2): confirmed data →
`calculate()` → auditable worksheet → Form 1301 field map → filed. Concretely:
a calculate endpoint + append-only snapshots, refund estimates on the
dashboard, the full worksheet panel, the Form 1301 filing view, the year
status flow, capital-loss carry-forward across years, and the backup script.

**Contract (both agents build against THIS, not against each other's code):**

New/changed API endpoints — all behind the existing auth gate, all errors
Hebrew `{message}`:

1. `POST /tax-years/:id/calculate` — body validated by shared
   `CalculateRequestSchema`: `{ taxpayer: { gender: 'male'|'female',
   isIsraeliResident?: boolean (default true), additionalCreditPoints?:
   number (≥0, multiple of 0.25, default 0) } }`. Server maps the year's
   confirmed data (latest `confirmed_data` row per document) into the
   engine's `TaxYearInput`, reads carry-forward in (below), calls
   `calculate()` from `@taxreturns/tax-engine`, inserts an APPEND-ONLY
   `calculations` row `{taxYearId, engineVersion: ENGINE_VERSION, input,
   result}`, and upserts the year's `loss_carryforward` row (below).
   Responses: 200 with the full calculation row; 404 unknown tax year; 400
   invalid body; 400 with the engine's message when the engine throws
   (`UnknownTaxYearError` for e.g. year 2023 — engine supports only
   2024/2025 — or `InvalidTaxInputError`). Calculating with zero confirmed
   documents is LEGAL (a zero return) — no special case.
2. `GET /tax-years/:id/calculation` — latest calculation row for the year
   plus `stale: boolean` (true when any `confirmed_data` row belonging to
   the year's documents is newer than the calculation's `createdAt`). 404
   (Hebrew) when the year exists but has no calculation yet; 404 for an
   unknown year.
3. `PATCH /tax-years/:id/status` — body `{ status }` validated by shared
   `TaxYearStatusUpdateSchema`. Legal transitions (map, enforced
   server-side, 400 Hebrew naming the current status on violation):
   `draft→[in_review]`, `in_review→[draft, ready_to_file]`,
   `ready_to_file→[in_review, filed]`, `filed→[amended]`,
   `amended→[in_review]`. Transitioning to `filed` sets `filedAt=now()`;
   any transition away from `filed` leaves `filedAt` as-is (history).
   Returns the updated row.
4. `GET /tax-years` — each row now carries `refundEstimateAgorot:
   number|null` = the latest calculation's `result.refundAgorot` (null when
   no calculation). The web type already has this optional field; it becomes
   real.

Engine input mapping (backend module `src/calculation/map-confirmed-data.ts`),
using ONLY box codes documented in this repo
(`packages/shared/src/documents/form106.ts`):
- `form106` payload → `SalaryInput`: `grossSalaryAgorot` = box `158` (missing
  box → 0), `taxWithheldAgorot` = box `042`, `pensionEmployeeContributionAgorot`
  = box `045`, `employerName` from the payload. `niEmployeeWithheldAgorot`
  stays undefined (no documented box).
- `form867` payload → `BrokerEntryInput`: fields map 1:1 by name
  (`realGainsAgorot→realGainAgorot`, `realLossesAgorot→realLossAgorot`,
  `interestDividendAgorot`, `taxWithheldAgorot`), `brokerName` through.
- `charity_receipt` payload → `DonationInput`: `institutionName`,
  `amountAgorot`. Receipts with `hasSection46Approval: false` are EXCLUDED
  from the engine input (no §46 credit without the approval) — but count
  them and surface `excludedDonations: n` in the calculate response's
  metadata so the UI can say so.
- Kind `other` documents are ignored.
- `year` = the tax year's `year`; `taxpayer` from the request body.

Loss carry-forward (phase-1 semantics, deliberately simple):
- Carry-forward IN for year Y = sum over `loss_carryforward` rows of this
  user with `fromYear < Y` and `consumedByYear IS NULL` of `amountAgorot`.
- After each calculation for year Y: delete this user's existing
  `loss_carryforward` row(s) with `fromYear = Y`, and insert one fresh row
  `{userId, fromYear: Y, amountAgorot: result.lossCarryforwardOutAgorot,
  kind: 'capital'}` when that amount is > 0. (The carry-forward table
  mirrors the LATEST calculation per year; `calculations` keeps full
  history. `consumedByYear` stays unused in phase 1 — documented limitation:
  recalculating year Y does not auto-invalidate an already-calculated later
  year; the later year shows `stale: false` but should be recalculated —
  the UI notes this on the worksheet when carry-forward-in ≠ 0.)

Shared package additions (backend agent owns these; frontend imports them):
- `CalculateRequestSchema` + `TaxYearStatusUpdateSchema` (+ inferred types)
  in `packages/shared/src/calculation.ts`, exported from the index.
- `packages/api` and `packages/web` both add `@taxreturns/tax-engine`
  (workspace:*) as a dependency — api calls it, web imports its RESULT TYPES
  (`TaxReturnResult`, `BracketRow`, …) for rendering. Pure-TS package,
  no runtime cost concerns. Frontend: if the shared schemas aren't in your
  worktree yet (parallel build), use a temporary local type + TODO comment
  like the auth round did, and say so in your report.

Frontend screens (frontend agent):
- **Worksheet panel** (replaces the calculation placeholder in
  TaxYearDetail): a small taxpayer form (gender select, optional
  additional-credit-points input with a helper note that children/degree
  points are entered here as a verified total for now) + a "חישוב" button →
  `POST /calculate`, then render the full worksheet from the result:
  income-tax bracket rows (from/to/rate/tax via `formatILS`), credit points
  breakdown, pension + charity credits (incl. applied ceilings), capital
  gains offsets + carry-forward in/out, surtax, totals, and the headline
  `refundAgorot` (positive = refund, styled green; negative = balance owed,
  red). Show `engineVersion` + `createdAt` as the audit stamp, the `stale`
  flag as an amber notice with a recalculate nudge, and the
  carry-forward-later-years note above when `lossCarryforwardOutAgorot > 0`.
- **Dashboard**: `refundEstimateAgorot` now arrives from the API — no
  change needed beyond removing any assumption it's always null; verify the
  existing `formatILS` cell just works.
- **Filing view** (new route `/tax-years/$taxYearId/filing`, auth-guarded):
  renders `result.form1301Fields` from the latest calculation as a
  transcription table (code | value via `formatILS` for agorot fields), an
  owner-verification warning note (1301 codes are owner-verified in this
  plan's review, לא להגיש בלי בדיקה), and the status-flow controls: current
  status chip + buttons for each legal next transition (PATCH status),
  with 'filed' showing `filedAt` after. Link to it from the tax-year detail
  header. Status transitions invalidate the tax-years + detail queries.
- Everything Hebrew/i18next/logical-properties/dark-mode per house rules;
  component tests per screen incl. one asserting the exact POST /calculate
  body shape and one asserting an illegal-transition button simply isn't
  rendered (the UI only offers legal next steps).

Backup script (orchestrator, not the agents): `scripts/backup.sh` — dated
`backups/<timestamp>/` with `pg_dump` (via `docker compose exec -T db`) and
a tar of the documents dir; README note.

Verification: reviewer-agent pass on the merged diff (engine-input mapping
is money-critical), then full root suite + typecheck, CLAUDE.md update.

## Task split

- [x] **backend-dev** (worktree): shared schemas, tax-engine dep, mapping
      module (TDD — unit tests for the mapper incl. missing boxes → 0,
      §46-unapproved exclusion), the four endpoints + integration tests on
      the existing real-Postgres pattern (calculate happy path incl.
      snapshot append-only on recalc, carry-forward in/out across two years,
      stale flag flips when a doc is re-confirmed, status transition matrix
      incl. filedAt, refund estimate in GET /tax-years), commit. DONE.
- [x] **frontend-dev** (worktree): worksheet panel, filing view, status
      controls, dashboard verification, i18n keys, component tests, commit.
      DONE (two parallel worktrees, hand-merged; Dashboard already rendered
      refundEstimateAgorot null-safely so no change was needed there).
- [x] **orchestrator**: backup script + README; merge branches;
      **reviewer** agent on the diff; fix findings; full suite; CLAUDE.md.
      DONE.

## Outcome (2026-07-13)

All Plan 5 scope landed and green (root `pnpm test`: shared 42, tax-engine
83, api 92, web 55 = 272; typecheck clean; engine branch coverage 98.82% ≥
95% gate). Notable decisions and fixes beyond the original contract:

- **Form 1301 codes owner-verified** against the official 2024/2025 forms +
  da-2024 guide (`docs/superpowers/research/2026-07-12-form1301-codes-verification.md`).
  Corrections applied to the engine map: donations now emit official field
  **037** as the RAW donated amount (the assessing system applies the §46
  rate/ceilings — do NOT pre-apply); securities withholding moved to **040**
  (**042** stays salary-only); unoffset capital losses carry out on **166**.
  `capitalTaxableGain`/`capitalTax`/`surtax`/`totalLiability`/`refund` stay
  code-less named worksheet outputs (confirmed to have no main-form field —
  securities detail lives on נספח ג/טופס 1322; surtax/liability/refund are
  computed by the Authority in assessment). ENGINE_VERSION → `il-0.2.0`.
- **Carry-forward hardening** (reviewer findings): unique
  `(user_id, from_year, kind)` constraint (migration `0001`) + `onConflictDoUpdate`
  so a concurrent double-submit of /calculate can't duplicate a loss row and
  double-count it into later years; carry-forward-IN sum now filters
  `kind='capital'`.
- **Worksheet form `noValidate`**: native number-input step/min constraint
  validation was silently blocking submit for step-invalid credit-point
  entries before the localized Hebrew Zod error could show — the shared
  `CalculateRequestSchema` now solely owns validity.
- Baseline flake root-caused: the host Docker daemon had restarted and left
  the compose `db`/`api`/`web` containers exited (no restart policy) — not a
  code regression. **Recommend** adding `restart: unless-stopped` to the
  compose `db` service so a host reboot doesn't silently take the stack down.
