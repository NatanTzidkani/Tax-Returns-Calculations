# Child-Point Parent Allocation Plan — §66(ג) / §40(ב) / §40א (follow-on increment)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This plan is a **planning document — no code is written by writing it.**

**This is a follow-on increment to
`docs/superpowers/plans/2026-07-13-credit-points.md`** (the "safe first
increment"). That base plan teaches the engine the child age→point table and
the oleh §35 schedule, switches the credit-points accumulator to **twelfths of
a point**, and adds an optional `children?: Array<{ ageInTaxYear; role }>`
input — but it **explicitly defers** the mother-vs-father allocation logic and
uses a placeholder `role: 'custodial' | 'other'` that the engine does not
reason about statutorily. **This plan lands the deferred item.** It requires the
base plan's Tasks 1–4 to be merged first (twelfths accumulator + child table +
`children` input + breakdown `label`).

**Goal:** Given the reviewer-supplied per-filer marital/custody context and the
filer's parental role, have the engine select the **correct statutory paragraph**
for each child and compute this filer's child credit-point count under it —
mother/אשה via **§66(ג)(4)** (full age 0–18 schedule against her own
יגיעה-אישית income), father/גבר via **§66(ג)(5)** (**פעוט only** — exact range
owner-verify), NII קצבה points to the **בן-זוג-רשום** only (**§66(ג)(3)**), and
the single-parent / separated / מזונות split under **§40(ב)(1),(1א),(1ב),(2)**
and **§40א**. It also models the **§66(ג)(1)/(1א)** separate-calculation election
flag and the **טופס 116ד** mother's birth-year one-point deferral.

**Hard boundary — the engine does NOT decide custody.** Who is custodial, who is
the בן-זוג-רשום, who receives the קצבה, who pays מזונות, and each parent's share
of כלכלה are **reviewer inputs**. The engine's job is only to map a
reviewer-declared context onto the right paragraph and produce a per-filer count.
This keeps the money-critical path free of any inference the app cannot audit.

---

## ⚠️ Implementation reconciliation (2026-07-14, added before execution)

This plan was written **before** the downstream wiring landed
(`docs/superpowers/plans/2026-07-14-credit-points-wiring.md`, merged
2026-07-14). Three statements below are therefore stale and are corrected
here — the rest of the plan stands:

1. **ENGINE_VERSION:** the base plan landed as `il-0.4.0` and degrees as
   `il-0.5.0`; this increment is **`il-0.6.0`**.
2. **"Downstream, NOT in this plan" is superseded.** `children` is no longer
   engine-only: the shared `CalculateRequestSchema`, the API type-drift
   assertions (`packages/api/test/credit-points-wiring.test.ts`), and the
   worksheet form all carry `children: [{ ageInTaxYear, role }]` today.
   Removing the `role` placeholder therefore propagates through **this**
   increment: shared Zod gains `parentContext` + the per-child context and
   drops `role`; the api assertions/tests update; the worksheet form replaces
   the per-child role select with a filer-level regime picker (+ conditional
   flags/fields) and adds i18n fallbacks for the new breakdown reasons. Same
   structural-only boundary as the wiring plan — no legal rule in Zod/UI.
3. **"Existing base-plan test cases stay green unchanged" is impossible** —
   they use `role`. They are updated to express the same numeric expectations
   through Schedule-A regimes (e.g. `role: 'custodial'` →
   `parentContext.regime: 'marriedRegisteredSpouse'`); the expected numbers
   themselves must not change.

The typo'd reason token in the breakdown list below (`'maintenanceMoveda' →
'maintenanceShare'`) is resolved as **`'maintenanceShare'`**.

---

## Source of truth for every allocation rule in this plan

`docs/superpowers/research/2026-07-13-credit-points-allocation-addendum.md`
(the **primary-source** allocation addendum) — §66(ג)(1),(1א),(3),(4),(5) and
§40(ב)(1),(1א),(1ב),(2),(3) and §40א transcribed **verbatim** from the פקודת
מס הכנסה [נוסח חדש] (pkuda-btl / pkuda-gov consolidated texts), plus the Tax
Authority's position on shared/same-sex custody (rmim-goldpro) and the טופס
116ד service page (gov-116d). Point **counts** come from
`docs/superpowers/research/2026-07-13-credit-points-counts-addendum.md` and the
base plan's §1.1 table. **Do not "remember" any count or rule — read it from
those reports; the engine's `// source:` comments cite the report, the report
cites the statute/URL.**

**Critical correction this plan carries** (allocation addendum §1, "Correction
flag", lines 65–69): the base plan's child table `other` column (age 6–17 → 1,
age 18 → 0) describes the **separated-parents** case (§40(ב)(2)), **NOT a married
father**. Under a married/cohabiting couple the father (§66(ג)(5)) gets
**nothing for ages 4–18**. This plan replaces the base plan's flat
`role: 'custodial' | 'other'` count-selector with a regime-aware selector so a
married father is never granted 6–17 or age-18 points.

---

## The statutory map this plan encodes (from the allocation addendum)

Each filer is computed independently (the engine is single-filer). The reviewer
declares a **regime** for the filer and, where the regime needs it, a
**role/paragraph** and per-child context. The engine then applies exactly one
child schedule per child plus any flat additions.

| Regime (reviewer input) | Governing paragraph(s) | This filer's child schedule | Flat additions |
|---|---|---|---|
| `marriedRegisteredSpouse` (the אשה / בן-זוג-רשום; §66(ג)(4) claimant) | §66(ג)(4) | **Schedule A** — full ages 0–18 (base plan §1.1 "custodial" column) against her יגיעה-אישית income | קצבה points §66(ג)(3) if `receivesChildAllowance` |
| `marriedOtherSpouse` (the גבר / other spouse; §66(ג)(5) claimant) | §66(ג)(5) | **Schedule B** — פעוט only (young children); **0 for ages above the פעוט cutoff** | — |
| `singleParent` (משפחה חד-הורית, sole custody) | §40(ב)(1),(1ב) | **Schedule A** (§40(ב)(1) build-up = the same full schedule) | **+1** point (§40(ב)(1ב)) |
| `singleFatherOfToddler` (אב לפעוט, חד-הורית) | §40(ב)(1א) | **Schedule B** (פעוט) — **but** if the toddler's resident mother is not entitled under (1), those points attach to **her** income, not his → engine must **refuse/zero** for this filer when `motherClaimsUnderSection1 === false` (reviewer declares) | — |
| `separatedEntitled` (הורים החיים בנפרד, the (1)-entitled parent) | §40(ב)(2) | **Schedule A** | **+1** point (§40(ב)(2)) |
| `separatedNonEntitled` (the other separated parent, split כלכלה) | §40(ב)(2) | **1 point × `maintenanceShare` per child** (fraction of a point pro-rata to share of maintenance costs) | — |
| any of the above + `divorcedPaysMaintenanceRemarried` | §40א | (unchanged child schedule) | **+1** point (§40א) |

Notes carried from the addendum:
- **§66(ג)(3) — קצבה points** go to the **בן-זוג-רשום only**. Route them to the
  filer with `receivesChildAllowance: true`; **flag the *count* as owner-verify**
  (whether post-2003-reform §40(א) קצבה points are still non-zero — the addendum
  treats them as a distinct NII-paid category, not the credit points above).
- **Schedule A / Schedule B are the base plan's §1.1 counts**, not re-derived
  here. Schedule A = the "custodial"/mother column; Schedule B = the married
  **father** פעוט column, whose **age range and per-age counts are owner-verify**
  (btl text: פעוט < 4, father ages 0–3; gov.il text: פעוט < 6, father ages 0–5
  + §66(ג)(5א) for 6–12 — the two consolidated texts disagree; resolve against
  post-2024 ס"ח 3184). **The engine must not ship Schedule B until the owner
  fixes the range** — see the checklist. Until then `marriedOtherSpouse` /
  `singleFatherOfToddler` route to `additionalCreditPoints` fallback (guard
  throws a clear "not yet modelled" error if the structured father input is
  supplied — fail-loud, never silently zero).

---

## Architecture decision: where the allocation logic lives

**A new pure rules helper beside the base plan's tables.** The base plan creates
`src/jurisdictions/il/rules/credit-points-tables.ts` (frozen count tables +
`childPointTwelfths(ageInTaxYear, role)` + oleh helper). This plan adds a sibling
**`src/jurisdictions/il/rules/child-allocation.ts`** holding the *regime → schedule*
mapping and the flat-addition rules. It is pure, integer-**twelfths** throughout
(reusing the base plan's unit and its `InvalidTaxInputError` fail-loud
convention), and it **consumes** `childPointTwelfths` rather than duplicating the
counts. Keeping allocation (which paragraph) separate from the count table (how
many points at an age) mirrors the addendum's own separation of "allocation
mechanism (primary-confirmed)" from "counts (partly owner-verify)".

The `computeCreditPoints` module in
`src/jurisdictions/il/modules/credit-points.ts` calls the allocation helper once
per child and pushes labelled breakdown rows. No new accumulator work — the base
plan already switched to twelfths.

---

## Input shape (extends the base plan's `children`, additive/optional)

The base plan's `children?: Array<{ ageInTaxYear: number; role: 'custodial' | 'other' }>`
is **superseded** by the structured model below. Because the base plan's field
is optional and this plan lands after it, the migration is: **remove the
placeholder `role`** and replace with `parentContext` (filer-level) +
per-child context. (The base plan explicitly frames `role` as a placeholder for
"the deferred allocation" — this is that allocation.)

### `src/core/types.ts` — filer-level context on `TaxpayerInput`

```
/** Marital/custody context for child credit-point allocation. Reviewer-supplied;
 *  the engine picks the statutory paragraph from `regime` — it never infers
 *  custody. Absent → no child points from structured input (additionalCreditPoints
 *  remains the fallback). source: 2026-07-13-credit-points-allocation-addendum.md */
parentContext?: {
  regime:
    | 'marriedRegisteredSpouse'   // §66(ג)(4) — full ages 0–18 (Schedule A)
    | 'marriedOtherSpouse'        // §66(ג)(5) — פעוט only (Schedule B)
    | 'singleParent'              // §40(ב)(1)+(1ב)
    | 'singleFatherOfToddler'     // §40(ב)(1א)
    | 'separatedEntitled'         // §40(ב)(2), the (1)-entitled parent
    | 'separatedNonEntitled';     // §40(ב)(2), split כלכלה
  /** §66(ג)(3): this filer is the בן-זוג-רשום receiving the NII קצבה. */
  receivesChildAllowance?: boolean;
  /** §40א: divorced, pays מזונות, remarried → +1 point. */
  divorcedPaysMaintenanceRemarried?: boolean;
  /** §66(ג)(1)/(1א): filer is being computed on a חישוב נפרד. Informational for
   *  the count (child points are per-parent, not a splittable pool — addendum §3);
   *  gates whether (4)/(5) apply and labels the worksheet. */
  separateCalculation?: boolean;
  /** §40(ב)(1א) guard: for singleFatherOfToddler, whether the toddler's resident
   *  mother is entitled under (1). false → father's פעוט points attach to HER
   *  income, so this filer gets 0 (engine refuses to grant them here). */
  motherClaimsUnderSection1?: boolean;
};
```

### `src/core/types.ts` — per-child context on `children[]`

```
children?: Array<{
  ageInTaxYear: number;
  /** §40(ב)(2) separatedNonEntitled: this parent's share of כלכלה, 0..1.
   *  The one point is granted × this fraction. Required in that regime; ignored
   *  otherwise (supplying it in another regime is a loud InvalidTaxInputError). */
  maintenanceShare?: number;
  /** טופס 116ד: mother defers this child's ONE birth-year point to next year.
   *  Only valid when age 0 and regime routes to §66(ג)(4)/§40(ב)(1) (mother).
   *  Loud throw if set for a §66(ג)(5) father — non-transferable. */
  deferBirthYearPoint?: boolean;
  /** טופס 116ד: this filer is CLAIMING a birth-year point deferred from the
   *  prior year for this child (age 1 in the claim year). Mother-only, same guard. */
  claimDeferredBirthYearPoint?: boolean;
}>;
```

### `src/core/types.ts` — breakdown reasons

Widen `CreditPointsBreakdownRow.reason` (the base plan already added `'child'`
and `'oleh'`) with allocation-specific reasons so the worksheet shows the
paragraph applied:
`... | 'childAllowance'   // §66(ג)(3)`
`    | 'singleParentBonus' // §40(ב)(1ב)`
`    | 'separatedBonus'    // §40(ב)(2) +1`
`    | 'maintenanceMoveda'  → 'maintenanceShare' // §40(ב)(2) fractional`
`    | 'section40aBonus'   // §40א`
`    | 'birthYearDeferral' // טופס 116ד (may be negative in the defer year)`
The per-child `'child'` rows keep the base plan's `label` (e.g.
`"ילד בן 2 (§66(ג)(4) — אם)"`, `"ילד בן 8 (§40(ב)(2) — הורה שאינו זכאי, 40% כלכלה)"`).

---

## Engine shape (concrete)

### New file — `src/jurisdictions/il/rules/child-allocation.ts`
- `type Regime = ...` (the six values above).
- Pure `allocateChildTwelfths(child, regime, { motherClaimsUnderSection1 }): { twelfths: number; label: string }`
  per child:
  - Schedule-A regimes (`marriedRegisteredSpouse`, `singleParent`,
    `separatedEntitled`) → `childPointTwelfths(age, 'custodial')` (base plan's
    full column).
  - Schedule-B regimes (`marriedOtherSpouse`, `singleFatherOfToddler`) → the
    father פעוט column. **Guard (owner-verify gate):** until the owner fixes the
    פעוט range, this branch throws `InvalidTaxInputError('parentContext.regime',
    'father §66(ג)(5) פעוט schedule not yet owner-verified — use additionalCreditPoints')`
    rather than emitting an unverified number (fail-loud). `singleFatherOfToddler`
    with `motherClaimsUnderSection1 === false` → 0 for this filer with an
    explanatory label (points belong to the mother's income).
  - `separatedNonEntitled` → `round(12 * maintenanceShare)` twelfths per child
    (one point × share), requiring `maintenanceShare ∈ [0,1]`; throw if absent or
    out of range. Non-twelfth results are rounded and the rounding is
    documented (fractional-point pro-rata is inherently non-twelfth; see the
    checklist "fractional maintenance points" item).
  - טופס 116ד: if `deferBirthYearPoint` and age 0 → subtract 12 twelfths and emit
    a `birthYearDeferral` row with negative points; if `claimDeferredBirthYearPoint`
    → add 12 twelfths. Guard: both are mother-only (Schedule-A / §66(ג)(4)
    regimes); loud throw for father regimes (non-transferable to a non-working
    husband — addendum §4).
- Pure `flatAdditionTwelfths(parentContext): Array<{ reason; twelfths; label }>`:
  `singleParent` → +12 (§40(ב)(1ב)); `separatedEntitled` → +12 (§40(ב)(2));
  `divorcedPaysMaintenanceRemarried` → +12 (§40א); `receivesChildAllowance` →
  §66(ג)(3) קצבה points (**count owner-verify — default 0 with a TODO label**
  until the owner confirms the current קצבה-point count; never guess).
- Every table/branch annotated `// source:
  docs/.../2026-07-13-credit-points-allocation-addendum.md §<n>` and the counts
  addendum for the numbers.

### `src/jurisdictions/il/modules/credit-points.ts`
- After the base plan's per-child loop, replace the placeholder `role` call with
  `allocateChildTwelfths(...)` using `taxpayer.parentContext.regime`; push one
  labelled `'child'` row per child.
- Add the `flatAdditionTwelfths(parentContext)` rows.
- Election handling: `separateCalculation` does **not** change the count
  (addendum §3 — child points are fixed per-parent, not a pool). It sets a label
  suffix and gates that §66(ג)(4)/(5) regimes are only claimed under a separate
  calc where the statute requires it; supplying a `marriedRegisteredSpouse` /
  `marriedOtherSpouse` regime records the election for the worksheet audit line.
  **Whether the engine should *optimise* the election (compute combined vs
  separate and pick the cheaper) is an explicit owner decision — see checklist;
  this plan does NOT automate it, it treats the election as a reviewer input.**
- Fail-loud everywhere: unknown regime, `maintenanceShare` supplied outside
  `separatedNonEntitled`, birth-year deferral on a father regime, structured
  child input with no `parentContext` → `InvalidTaxInputError`.

### `src/core/types.ts` / `src/calculate.ts`
- No new orchestration (`computeCreditPoints(input.taxpayer, yearData)` already
  receives the whole taxpayer + year). **Bump `ENGINE_VERSION`.** Note: the base
  credit-points plan targets `il-0.3.0`, but `il-0.3.0` is **already shipped** for
  the 15% non-linked-interest branch (`calculate.ts:22`). So the base plan must
  land as **`il-0.4.0`** and this follow-on as **`il-0.5.0`** — confirm the actual
  predecessor version at implementation time and pick the next free minor; record
  the change in the `ENGINE_VERSION` comment block.

**Downstream, NOT in this plan (note only):** `parentContext` / the richer
`children` context are optional and additive, so the API
`CalculateRequestSchema` / `map-confirmed-data` and the web worksheet form keep
working unchanged (they still send `additionalCreditPoints`). Wiring
`parentContext` through the shared Zod schemas, the API, and a reviewer UI
(regime picker, per-child custody/maintenance fields) is a **separate future
plan**. Until then the reviewer keeps entering a verified total via
`additionalCreditPoints`.

---

## TDD step sequence (failing test → run red → implement → green → commit)

Per CLAUDE.md: failing test first, run it red, implement, green, commit. Root
`pnpm test` + `pnpm typecheck` stay green; the engine ≥95% branch-coverage gate
applies to all new branches (there are many — each regime + each guard).
**Prerequisite: the base credit-points plan (twelfths accumulator, child table,
`children` input, breakdown `label`) is merged.**

### Task 1 — regime → child-schedule allocator (Schedule A + separated)
**Files:** `src/jurisdictions/il/rules/child-allocation.ts` (new),
`test/jurisdictions/il/child-allocation.test.ts` (new).
- [ ] Failing tests: `marriedRegisteredSpouse` / `singleParent` /
      `separatedEntitled` all yield Schedule-A twelfths for a spread of ages
      (reuse base-plan §1.1 rows: 2→54, 6→24, 18→6); `separatedNonEntitled` with
      `maintenanceShare: 0.4` and age 8 → `round(12*0.4)=5` twelfths;
      `maintenanceShare` absent in that regime **throws**; `maintenanceShare`
      supplied in a non-separated regime **throws**.
- [ ] Implement Schedule-A + separated branches with `// source:` comments.
- [ ] Green; commit `feat(tax-engine): §66(ג)(4)/§40(ב) Schedule-A child allocation`.

### Task 2 — flat additions (§40(ב)(1ב), §40(ב)(2), §40א, §66(ג)(3) stub)
**Files:** same rules file + test (extend).
- [ ] Failing tests: `singleParent` → +12; `separatedEntitled` → +12;
      `divorcedPaysMaintenanceRemarried` → +12 (stacks on the regime);
      `receivesChildAllowance` → the §66(ג)(3) row with the **owner-verify
      count** (assert the placeholder/0 + label until the owner sets it).
- [ ] Implement `flatAdditionTwelfths`.
- [ ] Green; commit `feat(tax-engine): single-parent/separated/§40א flat child-point additions`.

### Task 3 — טופס 116ד mother birth-year deferral + father-regime guards
**Files:** same rules file + test (extend).
- [ ] Failing tests: `deferBirthYearPoint` + age 0 + `marriedRegisteredSpouse`
      → net −12 twelfths that year with a `birthYearDeferral` row;
      `claimDeferredBirthYearPoint` + `marriedRegisteredSpouse` → +12; either flag
      on `marriedOtherSpouse` (father) **throws** (non-transferable);
      `singleFatherOfToddler` with `motherClaimsUnderSection1: false` → 0 for this
      filer with the explanatory label; the Schedule-B father branch **throws**
      "not yet owner-verified" while the פעוט range is open.
- [ ] Implement the deferral + father guards.
- [ ] Green; commit `feat(tax-engine): טופס 116ד birth-year deferral + §66(ג)(5) father guards`.

### Task 4 — wire allocation into `computeCreditPoints`
**Files:** `src/core/types.ts`, `src/jurisdictions/il/modules/credit-points.ts`,
`test/jurisdictions/il/credit-points.test.ts` (extend; base-plan cases stay green).
- [ ] Failing tests: resident woman, `marriedRegisteredSpouse`, two children
      (ages 2 and 8) → 2.75 base + Schedule-A(2)+Schedule-A(8) with correct
      labelled rows; `singleParent` adds the +1; `separateCalculation` sets the
      label but not the count; unknown regime + structured children with no
      `parentContext` **throw**.
- [ ] Extend `TaxpayerInput` (`parentContext`, richer `children`) and the
      breakdown `reason` union; consume the allocator + flat additions.
- [ ] Green; commit `feat(tax-engine): compute child-point allocation by §66(ג)/§40 regime`.

### Task 5 — end-to-end golden scenario + ENGINE_VERSION bump
**Files:** `src/calculate.ts`, `test/calculate.test.ts` (extend).
- [ ] Failing golden test: full `calculate()` for 2025, a salary + a
      `marriedRegisteredSpouse` mother with children ages 2 and 8, asserting
      `creditPoints.points`, `creditPoints.valueAgorot`, `refundAgorot`.
- [ ] Bump `ENGINE_VERSION` to the next free minor (see engine-shape note) and
      update the comment block.
- [ ] Green; full root `pnpm test` + `pnpm typecheck`; engine branch coverage
      ≥95%. Commit `feat(tax-engine): child-point parent allocation end-to-end`.

### Task 6 — docs
- [ ] Update the CLAUDE.md tax-engine current-state row (child points now
      allocate by §66(ג)/§40 regime; father Schedule-B and §66(ג)(3) count still
      gated owner-verify; `additionalCreditPoints` remains the fallback; new
      `ENGINE_VERSION`). Commit `docs: note child-point parent allocation in CLAUDE.md`.

---

## ⚠️ Owner must verify before merge

**These gate the merge — each would otherwise encode an unverified or
disputed rule into the money-critical path. The plan is built so every open
item fails loud or routes to `additionalCreditPoints` rather than guessing.**

- [ ] **Exact פעוט age range for the married father §66(ג)(5) schedule
      (Schedule B).** The two consolidated ordinance texts **disagree**:
      **btl** PDF → *"פעוט = ילד שטרם מלאו לו ארבע שנים"*, father ages **0–3**;
      **gov.il** PDF → *"פעוט = ילד שטרם מלאו לו שש שנים"* (§40(ב)(3), תיקון 260),
      father ages **0–5** plus §66(ג)(5א) for 6–12. Resolve against the
      **post-2024 ס"ח 3184** text. **Schedule B ships disabled (loud throw) until
      resolved** — the engine must not emit an unverified father count.
- [ ] **Mother's 6–17 band count (1 vs 2)** feeding Schedule A. Primary
      §66(ג)(4)(ד) gives the extra point only for **6–12** (textually frozen
      *"אשר בשנת 2022…"*); the full-6–17 "2" for 2024+ is **secondary (כל-זכות)
      only** (counts addendum §2). Confirm before the 13–17 rows are trusted.
- [ ] **Verbatim enacted ס"ח 3184 (§40/§66) text.** Every primary host (gov.il,
      nevo, Knesset bill page) 403'd/failed the fetcher; the reform *counts* are
      confirmed by the official announcement + arithmetic tie-out, but the exact
      amended **subparagraph wording/numbering** for §66(ג)(4)(ג)/(5)/(5א) is not
      yet read from רשומות. Owner opens ס"ח 3184 directly.
- [ ] **§66(ג)(3) קצבה-point count.** The addendum confirms the *routing*
      (בן-זוג-רשום only) but not a current **count**; whether post-2003 §40(א)
      קצבה credit points are still non-zero is unconfirmed. Ships as **0 +
      TODO label** until the owner sets the number — no guess.
- [ ] **טופס 116ד statutory anchor.** The deferral is confirmed as a **form**
      (gov-116d) and mother-only/non-transferable, but the **exact amending
      ordinance subsection** could not be pinned (addendum §4). Confirm the
      section for the `// source:` comment; the mechanic itself is safe to ship.
- [ ] **Automate the §66(ג)(1)/(1א) election, or leave it a reviewer choice?**
      This plan treats חישוב מאוחד-vs-נפרד as a **reviewer input** (`separateCalculation`)
      and does **not** compute both and pick the cheaper. Owner decides whether a
      later plan should add an optimiser (it interacts with the whole two-filer
      liability, not just credit points — likely its own increment).
- [ ] **Fractional maintenance points (§40(ב)(2)).** The statute grants "נקודת
      זיכוי אחת או חלק ממנה לפי חלקו בהוצאות הכלכלה" — a genuine fraction. The
      plan stores it as `round(12 × maintenanceshare)` twelfths; **confirm the
      rounding convention** (round vs floor vs exact-fraction) and whether the
      Authority expects a specific precision on Form 1301.
- [ ] **§40(ב)(2) fraction multiplicity (added 2026-07-14, reviewer finding).**
      The verbatim statute reads "נקודת זיכוי אחת או חלק ממנה" over "כלכלת
      ילדיהם" — the children **collectively**, a singular point — while this
      plan's engine-shape section encoded the fraction **per child** (a
      3-children × share-1.0 filer would get 3.0 points vs the plain reading's
      1.0). Shipped **gated loud**: more than one child row under
      `separatedNonEntitled` throws (`assertSeparatedNonEntitledMultiplicity`);
      a single row with the combined share expresses the singular reading
      exactly. Owner rules on per-child vs collective before the gate lifts.
- [ ] **Flag routing looseness (recorded 2026-07-14, reviewer nit — harmless
      today).** `receivesChildAllowance` (a §66 בן-זוג-רשום concept) and
      `separateCalculation` are accepted and honored under every regime,
      including `singleParent`/`separatedNonEntitled` where they are
      statutorily incoherent; currently 0-point placeholder / label-only, so
      no number is wrong, but tighten when the קצבה count goes live.
- [ ] **§40(ב)(1א) explanatory 0-row not surfaced (recorded 2026-07-14,
      reviewer nit).** The mother-claims-false father case returns its
      explanatory 0-row, but the module's no-zero-rows filter drops it, so
      the worksheet shows nothing for that child (the number is right; the
      "no black box" label never reaches the user). Needs a row-model flag
      (like the קצבה placeholder's deliberate push) in a future increment.
- [ ] **Same-sex / registered-parent mapping.** The engine keys allocation on the
      declared *role* (בן-זוג-רשום vs other spouse), not literal gender, per the
      Tax Authority position (rmim-goldpro, secondary). Confirm this framing is
      acceptable for the reviewer's cases.
- [ ] **Child age semantics** (carried from the base plan's checklist): confirm
      "the age the child *reaches during* the tax year" and birth-year (age 0) /
      adulthood (age 18) boundary handling that both the schedule and the 116ד
      deferral key on.

---

## Out of scope / deferred (explicitly not built here)

- **Deriving custody / registered-spouse / maintenance shares from documents.**
  All remain reviewer inputs; the engine only maps a declared context to a
  paragraph.
- **The two-filer combined-vs-separate election *optimiser*** (§66(ג)(1)/(1א)) —
  the engine records the reviewer's election but does not search for the cheaper
  computation; that touches whole-return liability across both spouses and needs
  its own plan.
- **Academic degrees (§40ג), oleh internals, returning residents** — untouched
  here (owned by the base plan / their own future plans).
- Anything the checklist leaves open ships **disabled and loud** (father
  Schedule B; §66(ג)(3) count), with `additionalCreditPoints` as the reviewer
  fallback for every case this increment does not yet model.
