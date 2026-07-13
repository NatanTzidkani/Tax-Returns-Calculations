# Credit-Points Automation Plan — Safe First Increment (children + oleh)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This plan is a **planning document — no code is written by writing it.**

**Goal:** Teach the tax-engine to compute two credit-point (נקודות זיכוי)
categories it currently leaves to the reviewer: **children by age band**
(§40 age→point table) and the **new-immigrant / עולה חדש graduated monthly
schedule** (§35), for tax years 2024 and 2025. Everything else — academic
degrees (§40ג) and the mother-vs-father parent-allocation logic — is
**explicitly deferred** (see "Out of scope / deferred"). The existing
`additionalCreditPoints` reviewer escape hatch stays untouched as the fallback
for everything not yet modelled.

**Source of truth for every point count in this plan:**
`docs/superpowers/research/2026-07-13-credit-points-verification.md` (the
approved research report). That report carries the primary/secondary source
URLs (כל-זכות pages, Form 119, gov.il reform law) per line; the engine's
`// source:` comments cite the report, and the report cites the URLs. **Do not
copy point counts from anywhere else and do not "remember" them** — read them
from the report tables (§1.1 for children, §3.1 for oleh).

**Why this is the safe increment (report §5, §4):** the per-child *counts*
(§1.1) and the oleh *monthly rates and 7.5 / 8.5 totals* (§3.1) are the
report's CONFIRMED figures with no live legal ambiguity in the numbers
themselves. The parts the report marks UNRESOLVED — *which* parent claims a
child's points (§1.2) and the §40ג degree tracks (§2) — are deferred so that
zero engine automation rests on an unresolved legal question. The one residual
UNRESOLVED item that touches even this reduced scope (the §35 הוראת-שעה sunset
of the 54-month schedule and the clock-pausing events) is carried in the
"Owner must verify before merge" checklist and is worked around by keeping the
reviewer in control of the inputs (explicit `scheduleVariant`, explicit
qualifying months, no automated pausing).

**Spec / house rules:** `docs/superpowers/specs/2026-07-03-tax-returns-app-design.md`
§3, §9; CLAUDE.md ("Tax-law constants must cite official sources"; engine
"fails loudly, never silently defaults a number"; money is integer agorot).
Follows the Plan-2 tax-engine architecture: **statutory (non-indexed) tables
live in a jurisdiction-level rules module shared across years; the per-year
`years/*.ts` files stay for §120ב-indexed money only.**

---

## Architecture decision: where the tables live, and the internal point unit

**Rules module, not year data.** Child age→point counts and the oleh monthly
schedule are *statutory point counts*, not indexed money — they are identical
for 2024 and 2025 and are unaffected by the freeze law (which freezes only the
point *value*, 2,904 ₪/yr = `creditPointValueAgorot: agorot(290_400)`, already
owner-verified 2026-07-05). They therefore go in a **new
`src/jurisdictions/il/rules/` directory** (sibling to `modules/` and
`years/`), file `credit-points-tables.ts`, exporting frozen tables plus pure
lookup helpers. The per-year files under `years/` are NOT touched.

**Internal unit becomes twelfths of a point.** The module today accumulates in
integer **quarter-points** (2.25 pts = 9 quarters) so arithmetic stays
float-free. The oleh schedule uses per-month rates of ¼, ⅙ and 1/12 point —
⅙ and 1/12 are **not** representable in quarters. The least common
denominator of {4, 6, 12} is **12**, and 0.25 = 3/12, so switching the
module's internal accumulator to **integer twelfths of a point** keeps every
input integer:

| Rate | Twelfths |
|---|---|
| resident 2.25 pt | 27 |
| female 0.5 pt | 6 |
| oleh ¼ pt/mo | 3 |
| oleh ⅙ pt/mo | 2 |
| oleh 1/12 pt/mo | 1 |
| child counts (all multiples of 0.5) | multiples of 6 |
| `additionalCreditPoints` (0.25 steps) | multiples of 3 |

`valueAgorot = agorot(Math.round(totalTwelfths * yearData.creditPointValueAgorot / 12))`.
`points = totalTwelfths / 12` for the result. All child/oleh helper outputs are
integer twelfths; a non-twelfth-resolvable sum is a loud `InvalidTaxInputError`
(fail-loud convention). This is the one internal refactor; the public
`CreditPointsResult` shape (`points`, `valueAgorot`, `breakdown`) is unchanged
except for two new `breakdown.reason` values and an optional row label.

---

## Confirmed point counts to encode (from the report — do not alter)

### Children — points **per eligible parent**, by the age the child reaches during the tax year (report §1.1, CONFIRMED secondary)

The engine takes each child's `role` from the reviewer (`'custodial' | 'other'`)
and does **not** decide who is custodial (that allocation is deferred, §1.2).
For the young ages both roles get the same count; only ages 6-17 and 18 differ.

| Age in tax year | custodial | other | Twelfths (custodial / other) |
|---|---|---|---|
| Born this year (0) | 2.5 | 2.5 | 30 / 30 |
| 1 | 4.5 | 4.5 | 54 / 54 |
| 2 | 4.5 | 4.5 | 54 / 54 |
| 3 | 3.5 | 3.5 | 42 / 42 |
| 4 | 2.5 | 2.5 | 30 / 30 |
| 5 | 2.5 | 2.5 | 30 / 30 |
| 6–17 | 2 | 1 | 24 / 12 |
| 18 | 0.5 | 0 | 6 / 0 |

Same table for 2024 and 2025 (report §1.1). Ages outside 0–18 → not eligible;
the helper **throws** `InvalidTaxInputError` on an out-of-range age (fail-loud).

### Oleh §35 — points **per month**, counted from the month status was granted (report §3.1, CONFIRMED secondary; totals derived)

| Variant | Month bands → rate/month | Total | Months |
|---|---|---|---|
| `pre2022` (aliyah before 1.1.2022) | mo 1–18: ¼ · mo 19–30: ⅙ · mo 31–42: 1/12 | **7.5** | 42 |
| `from2022` (aliyah from 1.1.2022) | mo 1–12: 1/12 · mo 13–30: ¼ · mo 31–42: ⅙ · mo 43–54: 1/12 | **8.5** | 54 |

Load-bearing arithmetic the tests must assert (report §3.1 corrects a bad
fetched summary that said 3.5 / 4.5):
- `pre2022`: ¼×18 + ⅙×12 + 1/12×12 = 4.5 + 2 + 1 = **7.5** over 42 months.
- `from2022`: 1/12×12 + ¼×18 + ⅙×12 + 1/12×12 = 1 + 4.5 + 2 + 1 = **8.5** over 54 months.

Per tax year the points are **apportioned by how many qualifying months of the
schedule fall in that tax year** (report §3.1) — an oleh who arrives mid-year
gets a fractional first-year figure. The engine computes this from the aliyah
year-month and the tax year; it does **not** implement clock-pausing (see
owner-verify checklist item 2) — the reviewer subtracts paused months by
adjusting the input or falls back to `additionalCreditPoints`.

---

## Engine shape (concrete, per the report §5)

### New file — `src/jurisdictions/il/rules/credit-points-tables.ts`
- `CHILD_POINT_TWELFTHS: Record<'custodial'|'other', Record<0..18, number>>`
  (or an age→[custodial,other] table), frozen, each block annotated
  `// source: docs/.../2026-07-13-credit-points-verification.md §1.1 (kz-under6/kz-6to17/kz-under18)`.
- `OLEH_SCHEDULES: Record<'pre2022'|'from2022', Array<{ throughMonth: number; twelfthsPerMonth: number }>>`
  annotated `// source: ...§3.1 (kz-oleh)`.
- Pure helper `childPointTwelfths(ageInTaxYear: number, role: 'custodial'|'other'): number`
  — returns integer twelfths; throws `InvalidTaxInputError('...ageInTaxYear', …)`
  for age < 0 or > 18.
- Pure helper `olehTwelfthsForTaxYear(variant, aliyahYear, aliyahMonth, taxYear): number`
  — for each calendar month `m` (1–12) of `taxYear`, compute the 1-based elapsed
  month index `((taxYear - aliyahYear) * 12) + (m - aliyahMonth) + 1`; if it
  falls in `1..totalMonths`, add that band's `twelfthsPerMonth`; sum and return.
  Throws on unknown `variant` or `aliyahMonth` outside 1–12.

### `src/core/types.ts`
- Extend `TaxpayerInput` with two **optional** structured inputs (additive —
  existing callers keep working):
  ```
  children?: Array<{ ageInTaxYear: number; role: 'custodial' | 'other' }>;
  aliyah?: { aliyahYear: number; aliyahMonth: number; scheduleVariant: 'pre2022' | 'from2022' };
  ```
  `scheduleVariant` is an **explicit input** (reviewer/mapping supplies it), not
  derived from the date — deriving it would bake in the exact 1.1.2022 cutoff,
  which the owner-verify checklist (item 3) has not cleared.
- Extend `CreditPointsBreakdownRow`: widen `reason` to
  `'resident' | 'female' | 'additional' | 'child' | 'oleh'` and add optional
  `label?: string` (e.g. `"ילד בן 2 (הורה משמורן)"`, `"עולה חדש — 8 חודשים בשנת המס"`)
  so the worksheet panel shows *why* each point was granted (no black-box rule).
  `'degree'` is intentionally NOT added yet (deferred).

### `src/jurisdictions/il/modules/credit-points.ts`
- Refactor the accumulator from quarters to **twelfths** (see architecture
  note). Keep resident (27), female (6), and the `additionalCreditPoints`
  guard (still a non-negative multiple of 0.25 → multiple of 3 twelfths).
- For each `taxpayer.children` row: `childPointTwelfths(age, role)`, push a
  `{ reason: 'child', points, label }` breakdown row. Guardrail: eligibility
  (age band) enforced by the helper.
- For `taxpayer.aliyah`: `olehTwelfthsForTaxYear(variant, aliyahYear, aliyahMonth, yearData.year)`,
  push one `{ reason: 'oleh', points, label }` row (points may be a
  non-quarter fraction like 8/12 — that is fine, it renders as a decimal;
  only the *sum* must be twelfth-integer, which it is by construction).
- Final `valueAgorot` from total twelfths as above. Non-resident base stays 0.

### `src/calculate.ts`
- No new orchestration — `computeCreditPoints(input.taxpayer, yearData)` already
  receives the whole `TaxpayerInput` and the year (for `yearData.year`). Bump
  `ENGINE_VERSION` `il-0.2.0` → **`il-0.3.0`** (new inputs + rule → new stamped
  snapshots; the comment block records the change).

**Downstream, NOT in this plan (note only):** because the two new
`TaxpayerInput` fields are optional, the engine change is backward-compatible —
the API `CalculateRequestSchema` / `map-confirmed-data` and the web worksheet
form continue to send only `gender` / `isIsraeliResident` /
`additionalCreditPoints` and keep working unchanged. Wiring the structured
`children` / `aliyah` inputs through shared Zod schemas, the API, and a UI form
is a **separate future plan**; until then the reviewer still enters a verified
total via `additionalCreditPoints` in the existing UI.

---

## TDD step sequence (failing test → implement → green → commit)

Per CLAUDE.md: write the failing test, run it red, implement, run it green,
then commit. Root `pnpm test` + `pnpm typecheck` must stay green; the engine's
≥95% branch-coverage gate applies to the new code.

### Task 1 — child age→point table + helper (rules module)
**Files:** `src/jurisdictions/il/rules/credit-points-tables.ts` (new),
`test/jurisdictions/il/credit-points-tables.test.ts` (new).
- [ ] Failing tests for `childPointTwelfths`: every §1.1 row for both roles
      (age 0→30, 1→54, 2→54, 3→42, 4→30, 5→30, 6–17 custodial→24 / other→12,
      18 custodial→6 / other→0); age −1 and 19 throw `InvalidTaxInputError`.
- [ ] Implement the frozen `CHILD_POINT_TWELFTHS` table + helper with
      `// source:` comments citing the report §1.1.
- [ ] Green; commit `feat(tax-engine): child age→credit-point table (section 40)`.

### Task 2 — oleh §35 monthly schedules + helper
**Files:** same rules module + test file (extend).
- [ ] Failing tests for `olehTwelfthsForTaxYear`: a full 42-/54-month sweep
      (aliyah in January, sum across the schedule years) totals **7.5** for
      `pre2022` and **8.5** for `from2022` (assert in twelfths: 90 and 102);
      a mid-year aliyah apportions the first year correctly (e.g. `pre2022`,
      aliyah 2024-07 → months 1–6 of the schedule fall in 2024 = ¼×6 = 18
      twelfths); a tax year entirely past the window → 0; unknown variant and
      `aliyahMonth` 0/13 throw.
- [ ] Implement `OLEH_SCHEDULES` + helper with `// source:` comments citing
      report §3.1.
- [ ] Green; commit `feat(tax-engine): oleh section-35 monthly credit-point schedules`.

### Task 3 — wire children + oleh into `computeCreditPoints` (twelfths refactor)
**Files:** `src/core/types.ts`, `src/jurisdictions/il/modules/credit-points.ts`,
`test/jurisdictions/il/credit-points.test.ts` (extend; existing cases must
still pass unchanged).
- [ ] Failing tests: resident man + one child age 2 → 2.25 + 4.5 = 6.75 pts;
      resident woman + child age 6 role `'other'` → 2.75 + 1 = 3.75; resident
      man + `aliyah` (from2022, full first year 1/12×12 = 1 pt) → 3.25;
      combined resident + child + oleh + `additionalCreditPoints: 0.25` yields
      a twelfth-integer `valueAgorot` (assert exact agorot); breakdown contains
      the `'child'` and `'oleh'` rows with labels; a child age 19 propagates the
      loud throw.
- [ ] Extend `TaxpayerInput` and `CreditPointsBreakdownRow`; refactor the
      accumulator to twelfths; consume the two helpers.
- [ ] Green; commit `feat(tax-engine): compute child and oleh credit points from structured input`.

### Task 4 — end-to-end golden scenario + ENGINE_VERSION bump
**Files:** `src/calculate.ts`, `test/calculate.test.ts` (extend).
- [ ] Failing golden test: a full `calculate()` for 2025 with a salary, two
      children (ages 2 and 8) and an `aliyah`, asserting `creditPoints.points`,
      `creditPoints.valueAgorot`, and the resulting `refundAgorot`.
- [ ] Bump `ENGINE_VERSION` to `il-0.3.0` (update the comment block).
- [ ] Green; run full root `pnpm test` + `pnpm typecheck`; confirm engine
      branch coverage ≥ 95%. Commit
      `feat(tax-engine): child/oleh credit points end-to-end (il-0.3.0)`.

### Task 5 — docs
- [ ] Update the CLAUDE.md tax-engine current-state row (credit points now
      compute children §1.1 + oleh §35; degrees and parent-allocation still
      deferred; `additionalCreditPoints` remains the reviewer fallback; new
      `ENGINE_VERSION`). Commit `docs: note child/oleh credit points in CLAUDE.md`.

---

## Owner must verify before merge (carries the report's UNRESOLVED items that touch this scope)

These are legal questions the research report could not resolve from
primary sources. They gate merge because the engine would otherwise encode an
unverified rule. Items 1–3 touch the in-scope **oleh** work; 4–5 touch the
in-scope **children** work; 6–7 are the general provenance caveats.

1. **§35 sunset / permanence of the `from2022` 54-month schedule** (report
   §3.2). It was introduced as a **הוראת שעה** in the 2021–2022 arrangements
   law; כל-זכות presents it as in force for 2024–2025 olim, but its statutory
   sunset/renewal must be confirmed against the *current* text of §35 before we
   ship the `from2022` variant. If it lapsed, that variant must not compute.
2. **Exact clock-pausing events** (report §3.1/§3.2). The engine in this
   increment does **not** implement pausing (periods abroad, full-time study,
   army service that the oleh may exclude). Confirm the exact list against §35;
   until then document that the reviewer must reduce qualifying months manually
   or use `additionalCreditPoints`.
3. **The 1.1.2022 boundary** (report §3.1). Confirm which schedule applies to an
   oleh whose status was granted around 1.1.2022, and whether `scheduleVariant`
   may safely be *derived* from the aliyah date (this plan keeps it an explicit
   input to avoid pre-committing to the cutoff).
4. **Child age semantics** (report §1.3). Confirm "the age the child *reaches
   during* the tax year" (not age at year-start) and the boundary handling for a
   child turning 6 or 18 mid-year — the engine keys the table on `ageInTaxYear`
   and needs the owner's rule for the transcriber/mapper feeding it.
5. **6–17 income-source restriction** (report §1.3). The 6–17 addition
   historically attached to יגיעה-אישית (personal-exertion) income; confirm
   whether any income-source restriction still applies for 2024–2025.
6. **Primary-ordinance confirmation of the counts** (report §4). No primary
   ordinance text (§40, §35) was read for the report — the child §1.1 counts and
   the oleh §3.1 monthly rates rest on כל-זכות (secondary). Owner should confirm
   at least §1.1 and §3.1 against the ordinance or the Tax Authority.
7. **Point value** (report §5). 2,904 ₪/yr (`creditPointValueAgorot: 290_400`)
   is already owner-verified (2026-07-05) and frozen; the freeze law does not
   touch the statutory point *counts*. No action — noted for completeness.

---

## Out of scope / deferred (explicitly not built here)

Deferred because the research report leaves the governing legal question
UNRESOLVED and pending the owner's ordinance sign-off — building on it now would
put unverified automation into the money-critical path:

- **Mother-vs-father parent allocation** of child points, including single
  parent (הורה יחיד), divorced/separated (גרוש/פרוד), מזונות cases, the §66(ג)
  spousal election, and the טופס 116ד birth-year split across two years (report
  §1.2). *Reason:* two כל-זכות framings conflict and neither was reconciled
  against §40 / §66(ג). **In this plan the reviewer supplies each child's `role`
  explicitly** — the engine computes the per-child count for a given role but
  does not decide who is custodial or who receives the child allowance.
- **Academic degree / vocational certificate (§40ג)** — all of report §2:
  bachelor's, master's, vocational, the 2014-2022 vs 2023+ cohort claim-year
  rules, the internship (התמחות) deferral, direct-track PhD, and
  medicine/dentistry schedules (report §2.4 flags PhD and medicine as
  UNRESOLVED; the 2023+ fixed-vs-elective claim year and the 1,700-hour /
  recognized-certificate vocational conditions also need owner verification).
  *Reason:* claim-year mechanics and several tracks are UNRESOLVED (report
  §2.4, §4). Degrees stay entirely on `additionalCreditPoints` until their own
  plan. (`'degree'` is deliberately left out of the breakdown `reason` union.)
- **Returning residents** (תושב חוזר / תושב חוזר ותיק) — a separate §35 regime
  not researched (report §3 close). Out of scope; flag as separate research if
  needed.

`additionalCreditPoints` remains the catch-all reviewer input for every
category above and for any child/oleh edge case this increment does not model.
