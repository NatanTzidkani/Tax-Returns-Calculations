# Stored Taxpayer Profile Plan — persist credit-point facts across tax years (pre-fill only)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This plan is a **planning document — no code is written by writing it.**

**This is the "stored taxpayer profile" the credit-points wiring plan deferred**
(`docs/superpowers/plans/2026-07-14-credit-points-wiring.md`, "Out of scope":
*"Persisting taxpayer profile data (children/degrees) across years — today the
worksheet form is per-request by design; a stored taxpayer profile is its own
future plan"*). Today the reviewer retypes every structured credit-point fact
(children, aliyah, degrees, and — once il-0.6.0 lands — the parent-allocation
context) into the worksheet taxpayer form for **every calculation of every tax
year**. Those facts barely change between years; retyping them is both tedious
and an error source (a mistyped degree year silently changes the refund).

**Goal:** After this plan, the reviewer can (1) press an explicit
**"שמור לפרופיל"** action after a successful calculation to persist the
taxpayer facts they just used; (2) open any tax year's worksheet and find the
taxpayer form **pre-filled** from the stored profile, with child ages
**derived** from stored birth years (`ageInTaxYear = taxYear − yearOfBirth`)
and a visible Hebrew notice that the pre-fill is a suggestion the reviewer
must confirm; and (3) edit anything before calculating — the calculation
request remains exactly what the form submits.

**No engine changes and no new tax-law constants.** `ENGINE_VERSION` is
untouched (whatever is current at implementation time — `il-0.5.0` today,
`il-0.6.0` after the parent-allocation increment). This plan is shared-schema
+ API storage + web pre-fill only.

---

## ⚠️ Prerequisite / sequencing (read before executing)

The parent-allocation increment
(`docs/superpowers/plans/2026-07-13-parent-allocation.md`, targeting
`il-0.6.0`) is **in flight right now**, and per its "Implementation
reconciliation" section it propagates through shared Zod, the api assertions,
and the worksheet form: `children[].role` is **removed** and replaced by a
filer-level `parentContext` (regime + flags) plus per-child context
(`maintenanceShare`, the טופס 116ד deferral flags). **This plan's shapes are
written against the post-il-0.6.0 taxpayer shape** (profile stores
`parentContext`, not the doomed `role` placeholder).

- **Execute this plan only after the il-0.6.0 wiring is merged.** If at
  implementation time `CalculateRequestSchema.taxpayer` still carries
  `children[].role`, STOP and reconcile with the owner rather than persisting
  a shape that is about to be deleted.
- Nothing in il-0.6.0 conflicts with this plan otherwise: the profile stores
  whatever regimes/flags the shared schema allows structurally; regimes the
  engine has gated (father Schedule B) still fail loudly at calculate time —
  the profile changes none of that.

---

## The one architectural rule this plan must not break

**The profile is a convenience store, NOT a data authority.**

- The engine's input discipline is unchanged (CLAUDE.md: "The engine's only
  input is `confirmed_data`" + the per-request reviewer-submitted taxpayer
  body). `POST /tax-years/:id/calculate` keeps consuming **only its request
  body**; it must **never** read the profile server-side. The `calculations`
  snapshot keeps storing the **full engine input** exactly as today, so
  auditability is unchanged: every number in a snapshot traces to what the
  reviewer actually submitted, not to a stored profile that may have changed
  since.
- **No silent server-side merging** of profile into calculations. Merging
  would put unreviewed, possibly-stale data (a child who aged out, a regime
  that changed after a divorce) into the money path with no reviewer in the
  loop. The profile's ONLY consumer is the web form's pre-fill, and the
  reviewer sees, can edit, and must explicitly submit everything.
- **Year-dependence is the hard problem — solve it by storing only
  year-independent facts:**
  - Children are stored as **`yearOfBirth`**, NOT `ageInTaxYear`. The age is
    derived at pre-fill time in the UI (`taxYear − yearOfBirth`) and flagged
    for reviewer confirmation. This derivation matches the currently-assumed
    "age the child *reaches during* the tax year" semantics — which is
    **still an open owner-verify item** in the base credit-points plan; the
    profile must not pretend to resolve it (see the owner section).
  - Aliyah facts (`aliyahYear`/`aliyahMonth`/`scheduleVariant`) and degree
    facts (`track`/`completionYear`/`studyYears`/`electedClaimYear`/
    `internship`) are already year-independent — stored as-is.
  - `gender` and `parentContext` are stored as-is **with the explicit note
    that the regime can change between years** (marriage, separation, a new
    בן-זוג-רשום designation). Pre-fill = suggestion; the reviewer edits.
  - **Deliberately NOT stored:** `additionalCreditPoints` (a per-year
    reviewer-verified total — the 6–17 fallback amount changes as children
    age), `nonLinkedInterest*` (per-year income), and the per-child
    טופס 116ד deferral flags (`deferBirthYearPoint` /
    `claimDeferredBirthYearPoint` — inherently single-year elections).
    Storing any of these would smuggle a year-dependent number across years.
- **Structural-only Zod, same as the wiring plan.** `TaxpayerProfileSchema`
  encodes field names, enums, integers, physically-absurd bounds — no legal
  rules. The one deliberate difference from `CalculateRequestSchema.taxpayer`
  is `yearOfBirth` (bounded ~1900–2100, absurdity only) instead of
  `ageInTaxYear` (0–18 statutory domain) — documented in the schema comment.
- **A broken/stale profile must never block a calculation.** The web pre-fill
  `safeParse`s the stored payload; on failure it skips pre-fill (empty form,
  as today) rather than erroring the worksheet.

## Grounding — surfaces this plan touches (read these first)

| Surface | File | What changes |
|---|---|---|
| Shared schema | `packages/shared/src/calculation.ts` (or a sibling `taxpayer-profile.ts`, exported from `src/index.ts`) | + `TaxpayerProfileSchema` (structural only; reuses `AliyahInputSchema`/`DegreeInputSchema`/the il-0.6.0 parent-context schema) |
| DB schema | `packages/api/src/db/schema.ts` | + `taxpayer_profiles` table (uuid pk, **unique** `user_id` FK, `jsonb payload`, `updated_at`); migration `0002_*` via `pnpm --filter api db:generate` |
| API routes | new `packages/api/src/routes/profile.ts`, registered in `packages/api/src/app.ts` beside the existing four route plugins | `GET /profile`, `PUT /profile` — auth-gated for free by the global fail-closed `preHandler`; Hebrew `{ message }` 400/404 bodies like `routes/calculations.ts` |
| Upsert pattern | `packages/api/src/routes/*` + `loss_carryforward` unique + `onConflictDoUpdate` precedent | reuse: unique `user_id` + `onConflictDoUpdate` so a double-submit converges to one row |
| Web api client | `packages/web/src/api/client.ts` | + `getTaxpayerProfile()` (404 → `null`, mirroring `getCalculation`/`getMe`), `saveTaxpayerProfile()` |
| Worksheet | `packages/web/src/components/WorksheetPanel.tsx` (`TaxpayerForm`) | + profile query, pre-fill via initial state, pre-fill notice, post-calculate "save to profile" action; `TaxpayerForm` gains the tax-year **number** (needed for the age derivation) threaded from the tax-year detail route through `WorksheetPanel` |
| Pre-fill mapping | new `packages/web/src/lib/taxpayer-profile.ts` | pure `profileToTaxpayerFormState(profile, taxYear)` + `formStateToProfile(state, taxYear)` — unit-testable both directions |
| i18n | `packages/web/src/i18n.ts` | new Hebrew strings (pre-fill notice, aged-out-children note, save button, saved/failed lines) |

## Architecture decisions

1. **One `jsonb payload` column validated by the shared Zod schema, not
   normalized columns.** Matches the house pattern (`extracted_fields`,
   `confirmed_data`, `calculations` all store shared-schema-validated jsonb).
   The profile shape will evolve with the taxpayer shape (il-0.6.0 is doing
   exactly that mid-flight); a jsonb payload + write-time Zod validation
   evolves without a migration per field. Read path is fail-safe (web
   `safeParse`, skip pre-fill on mismatch).
2. **One profile per user, keyed by `user_id`.** Phase 1 is single-user (the
   `users` table already exists and every route is user-scoped via
   `requireUserId`), but the unique-`user_id` key means multi-user later is
   zero schema change. No per-tax-year profile rows: the whole point is that
   these facts span years; per-year data already lives in documents and
   snapshots.
3. **Explicit "save to profile" after a successful calculate — NOT
   auto-save.** Auto-saving every submitted form would silently persist
   typos, what-if experiments (the worksheet is exactly where the reviewer
   plays with hypotheticals), and half-filled forms. An explicit action after
   a *successful* calculation means the persisted facts are ones the reviewer
   just saw produce a sane, engine-validated result — the closest thing to
   "reviewer-attested" a convenience store can be. (Owner may still prefer a
   nudge — see the owner section.)
4. **The age derivation lives in the web pre-fill, in a pure exported
   function.** `profileToTaxpayerFormState(profile, taxYear)` derives
   `ageInTaxYear = taxYear − yearOfBirth` per child; children whose derived
   age falls outside 0–18 (aged out / not yet born for that year) are
   **omitted from the pre-fill** with a Hebrew note saying so — a display
   convenience, not a legal rule (0–18 is already the structural domain of
   `ChildInputSchema`). The inverse `formStateToProfile` computes
   `yearOfBirth = taxYear − ageInTaxYear` on save. Both directions are unit
   tested, including the round-trip.

## Concrete shapes

### `packages/shared` — `TaxpayerProfileSchema` (structural only)

```
/** Stored taxpayer profile — YEAR-INDEPENDENT facts only, used solely to
 *  PRE-FILL the worksheet taxpayer form. Never merged server-side into a
 *  calculation: the engine consumes the per-request reviewer-submitted body
 *  and snapshots store that full input (plan:
 *  docs/superpowers/plans/2026-07-14-taxpayer-profile.md).
 *  Deliberate difference from CalculateRequestSchema.taxpayer: children carry
 *  yearOfBirth (year-independent), NOT ageInTaxYear — the UI derives
 *  ageInTaxYear = taxYear - yearOfBirth at pre-fill time, flagged for
 *  reviewer confirmation. additionalCreditPoints, nonLinkedInterest*, and the
 *  טופס 116ד deferral flags are per-year by nature and are NOT stored. */
export const TaxpayerProfileSchema = z.object({
  gender: z.enum(['male', 'female']),
  isIsraeliResident: z.boolean().default(true),
  children: z
    .array(
      z.object({
        /** Calendar birth year (absurdity bounds only — not a legal rule). */
        yearOfBirth: z.number().int().min(1900).max(2100),
        /** §40(ב)(2) share — semi-stable, stored as a suggestion (owner note). */
        maintenanceShare: z.number().min(0).max(1).optional(),
      }),
    )
    .optional(),
  /** il-0.6.0 filer-level allocation context — reuse the shared schema the
   *  parent-allocation wiring adds (regime enum + flags). Regime can change
   *  between years; pre-fill is a suggestion the reviewer edits. */
  parentContext: ParentContextSchema.optional(),
  aliyah: AliyahInputSchema.optional(),      // already year-independent
  degrees: z.array(DegreeInputSchema).optional(), // already year-independent
});
export type TaxpayerProfile = z.infer<typeof TaxpayerProfileSchema>;
```

Absent optional sections stay **absent as keys** (same convention as
`CalculateRequestSchema` — pre-fill must produce `undefined`, never `[]`).

### `packages/api/src/db/schema.ts` — new table

```
export const taxpayerProfiles = pgTable('taxpayer_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Unique: exactly one profile per user (phase 1 = the owner); the key is
  // what makes PUT an idempotent upsert (onConflictDoUpdate on user_id,
  // mirroring the loss_carryforward concurrency pattern).
  userId: uuid('user_id').notNull().references(() => users.id).unique(),
  /** TaxpayerProfileSchema-validated jsonb (validated on WRITE; readers
   *  safeParse and treat a mismatch as "no profile" — fail-safe). */
  payload: jsonb('payload').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

Migration `0002_*` generated with `pnpm --filter api db:generate` (never
hand-written SQL). Note: `DELETE /tax-years/:id` cascade is untouched — the
profile is user-level, not year-level, and deliberately survives year
deletion.

### `packages/api/src/routes/profile.ts` — routes (auth-gated by the global preHandler)

- `GET /profile` → 200 `{ payload, updatedAt }` for the requester's row;
  **404 Hebrew** (`'טרם נשמר פרופיל נישום'`) when none — the web client maps
  404 → `null` exactly like `getCalculation`.
- `PUT /profile` → body through `TaxpayerProfileSchema.safeParse`; failure →
  **400 Hebrew** message (house style, like `MSG.invalidCalculateBody`);
  success → upsert (`onConflictDoUpdate` on `user_id`, `updatedAt: new Date()`)
  → 200 `{ payload, updatedAt }`. **This route never touches `calculations`,
  and `POST /calculate` never touches this table** — enforced by tests.

### `packages/web` — pre-fill + save

- `client.ts`: `getTaxpayerProfile(): Promise<{ payload: TaxpayerProfile; updatedAt: string } | null>`
  (404 → `null`), `saveTaxpayerProfile(payload: TaxpayerProfile)`.
- `lib/taxpayer-profile.ts` (new, pure):
  - `profileToTaxpayerFormState(profile, taxYear)` → the `TaxpayerForm`
    initial-state slice: derived child ages as strings, aged-out children
    omitted (returned separately as a count for the notice), aliyah/degrees/
    parent-context mapped 1:1.
  - `formStateToProfile(state, taxYear)` → `TaxpayerProfile`
    (`yearOfBirth = taxYear − Number(age)`), omitting empty sections and the
    non-stored per-year fields.
- `WorksheetPanel` / `TaxpayerForm`:
  - `WorksheetPanel` gains a `year: number` prop (threaded from the tax-year
    detail route, which already loads the year) and a
    `useQuery(['taxpayer-profile'])`. The form renders once the profile query
    settles (error/mismatch → `null` → empty form, never a blocked panel) and
    receives `initialTaxpayer` so pre-fill happens via `useState`
    initializers — no effect juggling, no clobbering of reviewer edits.
  - When pre-filled: an **info notice** (Hebrew) — the form was pre-filled
    from the stored profile, child ages were derived from birth years for
    this tax year, and everything must be confirmed before calculating; plus
    the aged-out-children note when applicable.
  - After a **successful** calculate: a "שמור לפרופיל" secondary button
    appears; clicking it PUTs `formStateToProfile(currentState, year)` and
    shows a saved/failed line (`ApiError.message` verbatim on failure,
    consistent with the calculate error surface).

## TDD step sequence (failing test → run red → implement → green → commit)

Per CLAUDE.md: failing test first, run it red, implement, green, commit. Root
`pnpm test` + `pnpm typecheck` green before every commit; api integration
tests need the compose `db` container up (no restart policy — check it before
blaming the code). Phases A (shared) and B (api) are sequential (B imports
A's schema); C (web) needs A and B's route contract.

### Phase A — shared profile schema (`packages/shared`)

- [ ] Failing shared tests: `TaxpayerProfileSchema` accepts a full profile
      (gender, children with `yearOfBirth` (+ optional `maintenanceShare`),
      `parentContext`, aliyah, degrees) and a minimal one (gender only,
      `isIsraeliResident` defaulting true); rejects `ageInTaxYear` on a child
      (the deliberate schema difference), non-integer / out-of-bounds
      `yearOfBirth`, `maintenanceShare` outside [0,1], unknown enum values;
      absent sections do **not** appear as keys in the parsed output.
- [ ] Implement `TaxpayerProfileSchema` (+ inferred type) reusing
      `AliyahInputSchema` / `DegreeInputSchema` / the il-0.6.0 parent-context
      schema; export from `packages/shared/src/index.ts`. Comment block states
      the convenience-store rule and the yearOfBirth-vs-ageInTaxYear
      difference (see concrete shape above).
- [ ] Green; commit
      `feat(shared): TaxpayerProfileSchema — year-independent taxpayer facts for worksheet pre-fill`.

### Phase B — table, migration, routes (`packages/api`)

- [ ] Add `taxpayerProfiles` to `src/db/schema.ts`; run
      `pnpm --filter api db:generate` → migration `0002_*`; apply with
      `pnpm --filter api db:migrate` against the compose db.
- [ ] Failing api integration tests (new `test/taxpayer-profile.test.ts`,
      using `buildApp(deps)` + `signInAndGetCookie`/`authedInjector` from
      `test/helpers/auth.ts`): `GET /profile` with no row → **404 Hebrew**;
      `PUT` a valid profile → 200 and `GET` returns it; second `PUT` →
      **updates the same row** (assert exactly one row for the user — the
      upsert converges); invalid body (child with `ageInTaxYear`, month 13)
      → **400 Hebrew** and nothing stored; unauthenticated `GET`/`PUT` →
      401 (global fail-closed gate — assert, don't assume); **calculate
      isolation**: with a stored profile present, `POST /tax-years/:id/calculate`
      with a bare taxpayer body produces a snapshot whose stored
      `input.taxpayer` contains **no profile-derived fields** (proves no
      server-side merge), and `PUT /profile` creates no `calculations` row.
- [ ] Implement `src/routes/profile.ts` (route shapes above; Hebrew `MSG`
      map; user-scoped queries via `requireUserId`; upsert via
      `onConflictDoUpdate` targeting the `user_id` unique); register in
      `src/app.ts`.
- [ ] Green; commit
      `feat(api): taxpayer_profiles table + auth-gated GET/PUT /profile (pre-fill store, no calculate coupling)`.

### Phase C — web pre-fill + explicit save (`packages/web`)

- [ ] Failing unit tests for `lib/taxpayer-profile.ts`:
      `profileToTaxpayerFormState` derives `ageInTaxYear = taxYear −
      yearOfBirth` (child born 2020 → age "5" for tax year 2025), omits
      aged-out (yearOfBirth 2000 for 2025) and not-yet-born children with the
      right omitted-count, maps aliyah/degrees/parentContext 1:1, and its
      output — submitted through the existing form mapping — **parses under
      `CalculateRequestSchema`** (the two schemas' deliberate difference is
      bridged correctly); `formStateToProfile` inverts (`yearOfBirth =
      taxYear − age`), drops per-year fields (`additionalCreditPoints`,
      interest, deferral flags), omits empty sections as keys, and its output
      parses under `TaxpayerProfileSchema`; round-trip
      profile → state → profile is stable for in-range children.
- [ ] Implement the pure mapping module. Green; commit
      `feat(web): taxpayer profile ↔ worksheet form state mapping with derived ages`.
- [ ] Failing component tests (`WorksheetPanel.test.tsx`, mocking the api
      client as the existing tests do): with a stored profile, the form
      mounts pre-filled (gender select, child row with the derived age,
      degree rows) and shows the **pre-fill notice** (and the aged-out note
      when applicable); with no profile (client returns `null`) the form is
      empty and no notice renders; a profile fetch **error** still renders a
      usable empty form (convenience must not block); an unparseable stored
      payload (client returns garbage) → pre-fill silently skipped; the
      reviewer edits a pre-filled value and the submitted calculate body
      carries the **edited** value; the "save to profile" button is absent
      before calculating and after a failed calculate, appears after a
      successful one, PUTs the `formStateToProfile` payload (assert
      `yearOfBirth` arithmetic), and shows the Hebrew saved line / the
      server's `ApiError.message` on failure.
- [ ] Implement: profile `useQuery` in `WorksheetPanel`, `year` prop threaded
      from the tax-year detail route, `initialTaxpayer` into `TaxpayerForm`
      state initializers, notices, save button + mutation, all new strings in
      `i18n.ts` (Hebrew RTL, logical properties only). `noValidate` and the
      shared-Zod submit gate are untouched.
- [ ] Green; commit
      `feat(web): pre-fill worksheet taxpayer form from stored profile + explicit save-to-profile action`.

### Phase D — verify, review, docs

- [ ] End-to-end verify against the running dev stack: calculate with typed
      facts → save to profile → reload → form pre-filled with derived ages +
      notice → open a *different* tax year → ages differ by the year delta →
      edit → calculate → snapshot's stored input matches the edited form
      (spot-check the `calculations` row via `docker compose exec db psql`).
- [ ] Independent reviewer pass on the full branch diff; apply findings.
- [ ] Update CLAUDE.md (api row: `taxpayer_profiles` + `/profile` routes,
      8th table; web row: profile pre-fill + save action; "What the website
      still needs": mark the stored-profile item done). Commit
      `docs: note stored taxpayer profile in CLAUDE.md`.
- [ ] Merge to master after root `pnpm test` + `pnpm typecheck` green.

---

## ⚠️ Owner should decide (not silently resolved by this plan)

- [ ] **Explicit save vs auto-save.** This plan ships an explicit
      post-calculate "save to profile" action (rationale in the architecture
      decisions: no persisted typos/what-ifs; persisted facts have passed an
      engine run). If you'd rather be nudged ("the form differs from your
      profile — update it?") or auto-save on every successful calculate, say
      so — it's a small web-only change, but it weakens the
      "reviewer-attested" property.
- [ ] **Birthday-vs-year precision on the derived age.** The pre-fill derives
      `ageInTaxYear = taxYear − yearOfBirth`, which equals "the age the child
      reaches during the tax year" for any birth date in that year — but that
      semantics is itself **still an open owner-verify item** in the base
      credit-points plan (and the parent-allocation checklist repeats it,
      incl. the age-0/18 boundaries the 116ד deferral keys on). The profile
      does NOT resolve it; it inherits whatever the engine's semantics turn
      out to be. Decide: (a) is the pre-fill notice's "confirm the derived
      ages" wording enough, or do you want a stronger per-child warning; and
      (b) should the profile store a full date of birth instead of a year
      (more precision if the semantics ever need the month, at the cost of
      storing more personal data the engine cannot currently consume)?
- [ ] **Retention / deletion.** The profile stores personal data (children's
      birth years, marital regime) in a user-level row that deliberately
      survives tax-year deletion and has no delete surface in this plan.
      Decide whether to add `DELETE /profile` (trivial follow-up), and
      whether the Plan-5 backup script should include the new table (it
      backs up the db wholesale today — confirm).
- [ ] **Does `maintenanceShare` belong in the profile?** It's stored as an
      optional per-child suggestion because retyping fractions is exactly the
      burden this plan removes — but unlike a birth year it can genuinely
      change annually (maintenance arrangements shift). Say the word and it
      joins the not-stored list.

## Out of scope / deferred (explicitly not built here)

- **Any server-side merge of profile into calculations** — permanently out,
  not deferred (see the architectural rule).
- **Engine changes** — none; no new inputs, no `ENGINE_VERSION` bump.
- **Spouse / second-filer profiles and the two-filer election optimiser** —
  single profile per user; multi-filer modelling is its own future plan.
- **Profile history / versioning** — one mutable row. The audit trail for
  what a calculation actually used is (and remains) the append-only
  `calculations.input` snapshot, not the profile.
- **Per-year profile overrides** (e.g. "in 2024 the regime was X") — the
  worksheet form *is* the per-year override.
- **Extraction sources for profile facts** — no document carries them; all
  fields stay reviewer-attested.
- **Storing per-year values** (`additionalCreditPoints`, non-linked interest,
  116ד deferral flags) — excluded by design, see the architectural rule.
