# §47 Pension Deductions (ניכויים) — Implementation Plan (DEFERRABLE)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Do not start coding before the "Owner must verify before merge" checklist is signed off.** _Update 2026-07-13: the rate constants are now primary-source **CONFIRMED** in `2026-07-13-section47-rates-addendum.md` (פקודת מס הכנסה read verbatim). The remaining gates in §5 are the scope call, the surtax/§45א ordering question, and input extractability — no longer the rates._

**Status:** DEFERRED / not scheduled. This plan is written and reviewable. The
rate constants are primary-source **CONFIRMED** (rates addendum), and the
surtax/§45א ordering question is **CLOSED 2026-07-16**
(`2026-07-16-section47-ordering-addendum.md`: surtax post-§47, §45א cap
pre-§47, plus the §47(ג) anti-double-dip requirement). The **only remaining
gate is the owner's scope call** — does a §47 / §17(5א) amount actually fire
for the real return? See §0 "Why deferrable".

**Goal:** Add the §47 pension **deduction** (ניכוי) to the tax engine — the
relief that reduces *taxable income before the brackets* — as a first-class,
auditable step, alongside the §45א **credit** (זיכוי) the engine already
computes after the brackets. Also cover the self-employed קרן-השתלמות deduction
(§17(5א)), which sits on the same before-brackets step.

**Source of truth for every constant and every open question:**
`docs/superpowers/research/2026-07-13-section47-deductions.md` (the approved
research report — READ IT FIRST for the ceilings and open questions). This plan
does not restate the source URLs; they live in that report and must be copied
into the engine's `// source:` comments verbatim when the values are entered.

**Rate constants — primary source:**
`docs/superpowers/research/2026-07-13-section47-rates-addendum.md` reached
פקודת מס הכנסה [נוסח חדש] itself (§§45א, 46, 47, 47א, 17(5א) read verbatim) and
**CONFIRMED every rate** the base report could only source from industry tables,
plus **corrected two section labels** and **resolved both ambiguities**. Where a
line below still reads `TODO(owner-verify)` for a *rate*, that is superseded —
use the addendum's confirmed value + section, with the addendum URL in the
`// source:` comment. (Corrections carried in: the 11% deduction is §47(**ב1**)(1),
not §47(ב); 232,800 ₪ is the §45א **credit** base, not the §47 deduction base.)

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

Add alongside the existing `pension45a` block in `IlYearData`. Ceilings are
CONFIRMED from the primary booklet (report §2); **rates are now CONFIRMED from
the primary ordinance** (rates addendum) — enter both with real `// source:`
comments (the addendum URL for rates, the report URLs for ceilings):

```
section47: {
  // CONFIRMED against primary booklet (report §2), agorot = annual ×100:
  workIncomeMezakaCeilingAgorot:        agorot(11_640_000), // §47(א)(1)(1) 116,400 — the עמית-עצמאי 11% base
  nonWorkIncomeMezakaCeilingAgorot:     agorot(16_440_000), // §47(א)(1)(2) 164,400 (NOT the deduction base — see note)
  atzmaiCeilingAgorot:                  agorot(11_640_000), // §47(א)(3) 116,400
  additionalIncomeCeilingMonthlyAgorot: agorot(2_425_000),  // §47(א)(5) 24,250/mo (291,000/yr = 2.5× work ceiling)
  motavThresholdAnnualAgorot:           agorot(2_406_900),  // §47(א)(7) 24,069
  kerenHishtalmutIncomeCeilingAgorot:   agorot(29_339_700), // §17(5א) 293,397
  // RATES — now CONFIRMED (primary) in 2026-07-13-section47-rates-addendum.md;
  // copy that URL + section into each // source: comment when entering them:
  deductionRateBp:                 1100, // 11%  §47(ב1)(1)  [NOT §47(ב)] — addendum §1
  additionalIncomeDeductionRateBp: 700,  // 7%   §47(ב1)(2) base rate      — addendum §1
  additionalDeductionBp:           400,  // +4%  §47(ב1)(2) "ניכוי נוסף" on portion >12% — addendum §5
  complementaryCreditRateBp:       550,  // 5.5% = 5% §45א(ה)(2)(ב)(1) + 0.5% §45א(ו) — addendum §4
  kerenHishtalmutRateBp:           450,  // 4.5% §17(5א)                  — addendum §6
  pensionCreditRateBp:             3500, // 35%  §45א(ב) (already engine pension45a) — addendum §4.1
}
// Deduction BASE — ambiguity RESOLVED (addendum §1, §8): the §47(ב1) deduction
// does NOT use one 232,800 ₪ ceiling. It stacks TWO 116,400 work-income
// ceilings — 11%×116,400 (§47(ב1)(1)) + up to 11%×116,400 (§47(ב1)(2) on הכנסה
// נוספת) = the 25,608 ₪ cap. 232,800 (=2×116,400) is the §45א CREDIT base
// (§45א(ה)(2)(ב)(1)), not a §47 deduction base; 164,400 (§47(א)(1)(2)) is the
// non-work-income branch. So there is no `motavDeductionBaseAgorot` field —
// the base is `workIncomeMezakaCeilingAgorot` applied twice.
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

- [ ] **Step 0 — owner-verify gate.** The *rates* are now primary-confirmed
      (rates addendum) — enter them with the addendum's `// source:` comments.
      Confirm the residual §5 items instead: the **scope call** (does §47 fire
      for the actual return) and the **surtax/§45א pre-vs-post-§47 ordering**
      (§2.2). If the ordering is still unsettled, stop before Step 7.
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
- [ ] **Step 8 — §47(ב1) "ניכוי נוסף".** RESOLVED (rates addendum §5): it is the
      **+4% deduction** (§47(ב1)(2)) on the portion of contributions exceeding
      12% of הכנסה נוספת, on top of the 7% base — implement it, no longer a stub.
      (The unrelated 0.5% is a §45א(ו) *credit*, handled in the credit path, not
      here.) Commit.
- [ ] **Step 9 — worksheet + mapper + shared schema** (frontend/backend), if the
      new inputs are wired to real documents. Commit.

---

## 4. Verification

Reviewer-agent pass on the diff (money-critical: a mis-ordered deduction
mis-taxes every return). Full root suite + typecheck; engine branch coverage
≥ 95% gate. CLAUDE.md + the tax-engine table updated; `ENGINE_VERSION` bumped.

---

## 5. ⚠️ OWNER MUST VERIFY BEFORE MERGE

**Update 2026-07-13 — the RATES are now primary-source CONFIRMED** in
`docs/superpowers/research/2026-07-13-section47-rates-addendum.md` (פקודת מס
הכנסה read verbatim). The "verify the rate" items are therefore **closed**
(struck through below). What remains for Matan is a **scope call**, one open
**ordering** question, per-year **ceiling** re-verification, and **input
extractability**. Still: do NOT hard-code a placeholder — copy the addendum's
confirmed value + section into each `// source:` comment.

**Closed by the rates addendum (no longer owner-verify):**

- [x] ~~§47 deduction RATE 11% → cap 25,608 ₪~~ → **CONFIRMED** §47(**ב1**)(1)
      (addendum §1). Note the corrected section: 11% is §47(ב1)(1), not §47(ב).
- [x] ~~§47 deduction BASE ambiguity 164,400 vs 232,800~~ → **RESOLVED**
      (addendum §1/§8): the deduction base is the **116,400 work ceiling stacked
      twice** (= 25,608 cap); **232,800 is the §45א *credit* base**, and 164,400
      is the non-work-income branch — neither is the §47 deduction base.
- [x] ~~§45א complementary credit RATE 5.5%~~ → **CONFIRMED** = 5%
      (§45א(ה)(2)(ב)(1)) + 0.5% (§45א(ו)) (addendum §4).
- [x] ~~§17(5א) keren-hishtalmut RATE 4.5%~~ → **CONFIRMED** (addendum §6).
- [x] ~~§47(ב1) "ניכוי נוסף" mechanism UNRESOLVED~~ → **RESOLVED** (addendum §5):
      it is the **+4% deduction** (§47(ב1)(2)); the 7% is its base rate; the
      0.5% is a separate §45א(ו) *credit*. Step 8 is implementable, not a stub.
- [x] ~~Salaried insured-salary gate~~ → **CONFIRMED** mechanism (addendum §3):
      built into §47(ב)(2)(ב) "בניכוי הכנסתו המבוטחת" up to 2.5× the work ceiling
      (291,000/yr) — not a separate rule.

**Still genuinely open (must be settled before the relevant TDD step):**

- [x] ~~**Surtax base & §45א cap: pre- or post-§47 income?**~~ → **CLOSED
      2026-07-16** (`docs/superpowers/research/2026-07-16-section47-ordering-addendum.md`):
      surtax base = **post-§47** (§121ב(ה)→§1 "לאחר הניכויים"); the §45א cap's
      הכנסה מזכה = **pre-§47 explicitly** (§47(א)(1) "לפני הניכוי על פי סעיף
      זה", adopted by §45א(ג)) — `computePensionCredit` keeps raw income.
      **New requirement the addendum surfaced:** §47(ג)/(ב2) exclusivity — a
      shekel deducted under §47 must not also earn the §45א 35% credit (and
      (ב)-vs-(ב1) sums are mutually exclusive); fold into Steps 7-8 and the
      מוטב/non-מוטב election comparison (compare total tax incl. the credit
      each branch leaves available).
- [x] **Scope:** ~~does any §47 / self-employed §17(5א) deduction fire for
      Matan's actual return?~~ → **ANSWERED by the owner 2026-07-16: no** —
      single employer, fully-insured salary, no עמית-עצמאי fund, no business
      income; every §47/§17(5א) amount is 0 for the current return. **The plan
      stays DEFERRED by owner decision** — revisit only if the income profile
      changes (self-employment, uninsured salary, independent deposits, or a
      self-employed keren-hishtalmut).
- [ ] **Input extractability:** *half-closed 2026-07-16* (ordering addendum §4):
      `Form106Schema` is a generic 3-digit-box→agorot map, so **no schema change
      is needed** — extraction already carries any box present. Owner-side
      remainder: identify which box code (if any) on the real Form 106 shows
      הכנסה מבוטחת, and whether independent עמית-עצמאי deposits appear on any
      document (else they become a reviewer-entered field like
      `nonLinkedInterest*`).
- [ ] **Per-year indexed ₪ ceilings** (116,400 / 164,400 / 232,800 / 291,000 /
      293,397) — re-verify each year; they track the average wage / §120ב, not
      the now-confirmed rates.

**CONFIRMED — safe to enter now (primary booklet ceilings §2 + primary ordinance
rates, both years):** ceilings §47(א)(1)(1) 116,400 ₪; §47(א)(1)(2) 164,400 ₪;
§47(א)(3) עמית עצמאי 116,400 ₪; §47(א)(5) 24,250 ₪/mo (291,000/yr); §47(א)(7)
24,069 ₪; §45א(ה)(2) 232,800 ₪ (credit base); §17(5א) 293,397 ₪. **Rates**
(addendum): 11% §47(ב1)(1), 7%+4% §47(ב1)(2), 5.5% §45א(ה)/(ו), 4.5% §17(5א),
35% §45א(ב). The one non-constant still to settle before wiring is the
pre-/post-§47 ordering above.
