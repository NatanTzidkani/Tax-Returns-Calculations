# §47 Pension Deductions (ניכויים) — Implementation Plan (DEFERRABLE)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Do not start coding before the "Owner must verify before merge" checklist is signed off — the rate constants this plan needs are not in any gov.il primary source.**

**Status:** DEFERRED / not scheduled. This plan is written and reviewable, but
must not be implemented until (a) the owner verifies the flagged rates below and
(b) a real return actually needs a §47 deduction. See §0 "Why deferrable".

**Goal:** Add the §47 pension **deduction** (ניכוי) to the tax engine — the
relief that reduces *taxable income before the brackets* — as a first-class,
auditable step, alongside the §45א **credit** (זיכוי) the engine already
computes after the brackets. Also cover the self-employed קרן-השתלמות deduction
(§17(5א)), which sits on the same before-brackets step.

**Source of truth for every constant and every open question:**
`docs/superpowers/research/2026-07-13-section47-deductions.md` (the approved
research report — READ IT FIRST). This plan does not restate the source URLs;
they live in that report and must be copied into the engine's `// source:`
comments verbatim when the values are entered.

---

## 0. Why this is DEFERRABLE (read before scheduling)

For the Phase-1 owner case — a **single-employer salaried filer** whose salary
is fully insured by the employer pension and who has **no independent fund and
no business income** — the §47 deduction is **0** (report §3.3, §4.5). The
employee pension contributions the engine already reads (Form 106 box 045) are
contributions on *insured* salary, which route to the §45א **credit** the
engine already computes (`computePensionCredit`) — never to a §47 deduction. So:

- The engine's current output for the owner's return is **already correct**;
  building §47 changes nothing for him.
- §47 only fires when there is **business/self-employment income**, **שכר לא
  מבוטח** (uninsured salary the employee contributes against independently), or
  a **self-employed keren-hishtalmut** deposit — none of which the engine's
  inputs currently express.

Treat this exactly like the children/degree/oleh credit-point tables (CLAUDE.md
build order §1): researched and ready, deferred until a real return needs it.
**Before scheduling, confirm with the owner whether any §47 or self-employed
§17(5א) deduction applies to his actual return.** If not, leave deferred.

---

## 1. The distinction this plan implements: §47 deduction vs §45א credit

This is the single most important concept — getting the order wrong silently
mis-taxes the return.

| | ניכוי §47 (this plan — NEW) | זיכוי §45א (already in engine) |
|---|---|---|
| Acts on | **taxable income** | **the tax** |
| When, in `calculate.ts` | **BEFORE** the brackets (`computeIncomeTax`) | **AFTER** the brackets (subtracted from `incomeTax.totalAgorot`) |
| Worth to taxpayer | contribution × **marginal** rate (10–47%) | contribution × **35% flat** (`pension45a.creditRateBp` = 3500) |
| Engine today | not modelled → the new step | `computePensionCredit` in `modules/pension.ts` |

Concretely in the current `calculate.ts` (read 2026-07-13):

- **Line 65** builds `workIncome = addAgorot(...salaries.map(grossSalaryAgorot))`.
- **Line 66** immediately feeds raw `workIncome` to
  `computeIncomeTax(workIncome, yearData)`.
- **Lines 75–85** compute the credits (points, `computePensionCredit`, charity)
  and subtract them from the bracket tax *after* the fact (`creditsApplied =
  minAgorot(creditsTotal, incomeTax.totalAgorot)`).

The §47 deduction must be inserted **between line 65 and line 66**: reduce
`workIncome` (and, for business income, the base) by the deduction *first*, then
feed the reduced figure to `computeIncomeTax`. The credit machinery on lines
75–85 stays exactly where it is. This before-brackets / after-brackets split is
the whole point.

---

## 2. What changes (files & functions)

Nothing is implemented in this plan; this is the target shape.

### 2.1 New module — `jurisdictions/il/modules/pension-deduction.ts`

New pure function, mirroring `computePensionCredit`'s style (typed errors, no
silent defaults, exposes every intermediate for the worksheet):

```
computePensionDeduction(input, yearData) → PensionDeductionResult
```

It must compute **both** the "עמית מוטב" and non-"עמית מוטב" branches and keep
the taxpayer-favourable one (report §1 election rule, §4.4 — booklet-2025 פרק א
§6 lets the filer choose whichever is more beneficial in the annual return). The
result exposes both branches for the audit worksheet.

The self-employed keren-hishtalmut §17(5א) deduction (report §2 "קרן השתלמות")
belongs on the same before-brackets step; decide in TDD whether it is a field of
`PensionDeductionResult` or a sibling `computeKerenHishtalmutDeduction` — either
way both feed the same `taxableWorkIncome` reduction.

### 2.2 `calculate.ts` — insert the deduction before `computeIncomeTax`

- After line 65 (`workIncome`), compute
  `const pensionDeduction = computePensionDeduction(input, yearData);`
- Derive `const taxableWorkIncome = subAgorot(workIncome,
  pensionDeduction.totalDeductionAgorot);` (clamp at 0 — never negative).
- Change line 66 to `computeIncomeTax(taxableWorkIncome, yearData)`.
- Add `pensionDeduction` to the returned `TaxReturnResult` (worksheet needs it).
- **Ordering caution:** `computePensionCredit` (line 76) and the surtax base
  (`totalTaxable`, line 73) currently use the *raw* `workIncome`. Decide
  deliberately, in TDD, whether the §45א credit's 7%-of-qualifying-income cap and
  the §121ב surtax base use pre- or post-§47 income. The report does not settle
  this; flag it as an **owner-verify** point (§5) — surtax is on *taxable* income
  so it likely uses the post-deduction figure, but confirm against §121ב.

### 2.3 `core/types.ts` — new input fields (the engine currently lacks these)

The engine **cannot** compute a §47 deduction from `SalaryInput` alone
(report §4.3). Minimum additions:

- **`TaxpayerInput`** (or a new top-level `businessIncomeAgorot` on
  `TaxYearInput`): **self-employment / business income** (הכנסה מעסק/משלח-יד) —
  the base for the עמית עצמאי 11% deduction. Absent today.
- **Independent contributions** (עמית עצמאי / שכר-לא-מבוטח deposits the taxpayer
  made themselves) — a new input field; distinct from box-045 employee
  contributions, which are already read and belong to the §45א credit.
- **Per-salary "insured salary"** figure on `SalaryInput` — needed to apply the
  §47(א)(5) 24,250 ₪/mo gate (report §3.3): when employer-insured salary ≥
  24,250 ₪/mo, the §47 deduction against uninsured salary is 0. No Form 106 box
  for this is documented in the repo yet — the mapper (`map-confirmed-data.ts`)
  and possibly a shared schema field would need it. Flag whether it is even
  extractable from Form 106.

New result type `PensionDeductionResult` in `core/types.ts` and its wiring into
`TaxReturnResult` (like `PensionResult`).

### 2.4 Year data — new `section47` block in `years/2024.ts` (inherited by 2025)

Add alongside the existing `pension45a` block in `IlYearData`. **Only the
CONFIRMED ceilings from the report get real values; every RATE stays
`TODO(owner-verify)`** (report §4.2):

```
section47: {
  // CONFIRMED against primary booklet (report §2), agorot = annual ×100:
  workIncomeMezakaCeilingAgorot:      agorot(11_640_000), // §47(א)(1)(1) 116,400
  nonWorkIncomeMezakaCeilingAgorot:   agorot(16_440_000), // §47(א)(1)(2) 164,400
  atzmaiCeilingAgorot:                agorot(11_640_000), // §47(א) 116,400
  additionalIncomeCeilingMonthlyAgorot: agorot(2_425_000), // §47(א)(5) 24,250/mo
  motavThresholdAnnualAgorot:         agorot(2_406_900),  // §47(א)(7) 24,069
  kerenHishtalmutIncomeCeilingAgorot: agorot(29_339_700), // §17(5א) 293,397
  // NEEDS-OWNER-VERIFICATION — NOT in any gov.il source (report §3):
  deductionRateBp:              /* TODO(owner-verify) 1100 = 11% §47(ב) */,
  motavDeductionBaseAgorot:     /* TODO(owner-verify) 164,400 vs 232,800 — §3.1 */,
  complementaryCreditRateBp:    /* TODO(owner-verify) 550 = 5.5% §45א */,
  kerenHishtalmutRateBp:        /* TODO(owner-verify) 450 = 4.5% §17(5א) */,
  additionalDeductionBp:        /* TODO(owner-verify) §47(ב1) — UNRESOLVED, §3.2 */,
}
```

2025 inherits via the `...il2024` spread — **but note (report freeze section):**
these ceilings are frozen because the *average wage* (12,536 ₪/mo) was frozen,
**not** because of the §120ב CPI freeze law. Do not assume equality survives
into 2026; verify the average wage each year. Also §9(16א)/(16ב) קרן-השתלמות
הפקדה מוטבת is **NOT** frozen (20,520 in 2024 vs 20,566 in 2025) — if that
constant is ever added, it must be a real per-year value, not inherited.

### 2.5 Backend mapper + shared schema (only if inputs become real)

`packages/api/src/calculation/map-confirmed-data.ts` and the shared
`CalculateRequestSchema` would need the new business-income / independent-
contribution / insured-salary fields. Deferred with the rest.

### 2.6 Worksheet (frontend)

The worksheet panel gains a §47-deduction section (both election branches shown,
applied ceilings, the resulting `taxableWorkIncome`). Deferred; Hebrew/i18next/
logical-properties per house rules; add the terms ניכוי §47 / עמית מוטב.

---

## 3. TDD step sequence

Each step: failing test → run it → implement → pass → commit (conventional
`feat(tax-engine): ...`). Root `pnpm test` + `pnpm typecheck` green before each
commit. **Do not begin until §5 is signed off.**

- [ ] **Step 0 — owner-verify gate.** Confirm the §5 checklist is resolved and
      the rate constants are entered with real `// source:` comments. If any
      rate is still UNRESOLVED, stop — do not code a placeholder rate.
- [ ] **Step 1 — year data (CONFIRMED ceilings only).** Add the `section47`
      block to `IlYearData` (types) and `years/2024.ts` with the CONFIRMED
      ceilings and real source comments; rates left as owner-verified values
      from Step 0. Test: 2024 and 2025 expose the block, values equal, agorot
      correct. Commit.
- [ ] **Step 2 — input types.** Add `PensionDeductionResult`, the new input
      fields (business income, independent contributions, per-salary insured
      salary) to `core/types.ts`, all optional so existing tests/inputs still
      typecheck with §47 = 0. Test: existing `calculate` fixtures unchanged
      (regression: pure-salary filer's result is byte-identical). Commit.
- [ ] **Step 3 — module, salaried zero case first.** `computePensionDeduction`:
      the single-employer fully-insured filer → deduction 0 (the owner case).
      Test that first (it must match today's output). Commit.
- [ ] **Step 4 — §47(א)(5) 24,250 ₪/mo gate.** Insured salary ≥ ceiling ⇒ 0;
      below ⇒ deduction on min(uninsured, ceiling−insured). Test both sides of
      the gate. Commit.
- [ ] **Step 5 — self-employed 11% branch + מוטב/non-מוטב election.** Both
      branches computed, favourable one kept, ceilings applied. Test the
      election picks the lower total tax. Commit. **(Uses owner-verified rates.)**
- [ ] **Step 6 — §17(5א) keren-hishtalmut deduction.** 4.5% of הכנסה קובעת up
      to the ceiling. Commit. **(Owner-verified rate.)**
- [ ] **Step 7 — wire into `calculate.ts`.** Insert before `computeIncomeTax`
      (§2.2); resolve the surtax-base / §45א-cap pre-vs-post-deduction question
      per §5. Test end-to-end: a self-employed fixture's bracket tax drops by
      deduction × marginal rate; refund recomputed. Bump `ENGINE_VERSION`
      (il-0.3.0). Commit.
- [ ] **Step 8 — §47(ב1) "ניכוי נוסף".** Only if §5 resolved it. Otherwise leave
      a typed "not modelled" note and a test asserting it's absent. Commit.
- [ ] **Step 9 — worksheet + mapper + shared schema** (frontend/backend), if the
      new inputs are wired to real documents. Commit.

---

## 4. Verification

Reviewer-agent pass on the diff (money-critical: a mis-ordered deduction
mis-taxes every return). Full root suite + typecheck; engine branch coverage
≥ 95% gate. CLAUDE.md + the tax-engine table updated; `ENGINE_VERSION` bumped.

---

## 5. ⚠️ OWNER MUST VERIFY BEFORE MERGE

**None of these can be coded from the research report alone — they are not in any
gov.il primary source.** Matan must confirm each against the ordinance text
(פקודת מס הכנסה §47(ב)/(ב1), §45א(ד), §17(5א), §121ב) before the corresponding
TDD step runs. Do NOT hard-code a placeholder rate.

- [ ] **§47(ב) deduction RATE = 11% → cap 25,608 ₪** (report §3.1). Not in
      booklet; from licensed-firm tables only. Confirm 11% and the cap.
- [ ] **§47(ב) deduction BASE ambiguity: 164,400 ₪ vs 232,800 ₪** (report §3.1).
      The booklet's §47(א)(1)(2) "לא מהכנסת עבודה" ceiling is 164,400 (→11% =
      18,084); industry tables use 232,800 (= §45א(ה)(2) ×12 → 11% = 25,608).
      **Which ceiling governs the §47(ב) deduction base must be settled from the
      ordinance** — this changes the cap by ~7,500 ₪.
- [ ] **§45א complementary credit RATE = 5.5% → 12,804 ₪ contribution**
      (report §3.1). Confirm 5.5% and that it stacks to the 16.5% combined
      ceiling.
- [ ] **§17(5א) keren-hishtalmut RATE = 4.5% → 13,203 ₪** (report §2). Statutory
      rate not printed in the booklet.
- [ ] **§47(ב1) "ניכוי נוסף" mechanism — UNRESOLVED** (report §3.2). Sources give
      TWO incompatible mechanisms: a 0.5% *credit* top-up (kolzchut/rashut) vs a
      7% *deduction* on הכנסה שאינה מבוטחת (CPA corroboration). **Read §47(ב1)
      directly; do not code either until reconciled.** Step 8 stays a stub until
      then.
- [ ] **Salaried "insured salary > 24,250 ₪/mo ⇒ no §47 deduction" gate**
      (report §3.3). The ceiling itself is CONFIRMED; the *rule* wording is from
      industry tables only — confirm the mechanic.
- [ ] **Surtax base & §45א cap: pre- or post-§47 income?** (this plan §2.2). The
      report doesn't settle whether `computeSurtax`'s base and
      `computePensionCredit`'s 7%-of-qualifying-income cap use `workIncome`
      (raw) or `taxableWorkIncome` (post-deduction). Confirm against §121ב and
      §45א before Step 7.
- [ ] **Is the input even extractable?** Confirm whether "insured salary" and
      independent-contribution figures exist on Form 106 / the owner's documents
      before adding schema fields that can't be populated.

**CONFIRMED (safe to enter now, primary booklet, both years — report §2, §5):**
§47(א)(1)(1) 116,400 ₪; §47(א)(1)(2) 164,400 ₪; §47(א) עמית עצמאי 116,400 ₪;
§47(א)(5) 24,250 ₪/mo (291,000/yr); §47(א)(7) עמית מוטב threshold 24,069 ₪;
§45א(ד)/(ה)(1) 2,268 ₪, §45א(ה)(2) 232,800 ₪; §17(5א) הכנסה קובעת 293,397 ₪.
These are the ceilings only — every RATE applied to them is owner-verify.
