# Tax-Engine Core Implementation Plan (Plan 2 of 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A pure-TypeScript `packages/tax-engine` exposing
`calculate(input: TaxYearInput): TaxReturnResult` for Israeli tax years
2024–2025: progressive income tax, credit points, charity credit (§46),
capital gains with loss offset + carry-forward, pension credit (§45א),
surtax (מס יסף), an informational national-insurance reconciliation, and a
`form1301Fields` output map. No I/O, deterministic, typed errors, every
intermediate value exposed.

**Architecture:** Year data (constants, each annotated with an official
source URL) lives in `src/jurisdictions/il/years/<year>.ts` and is the only
per-year artifact. Rule modules in `src/jurisdictions/il/modules/` are pure
functions `(input slice, yearData) → section result`. `calculate()`
orchestrates: income aggregation → gross tax → credits (ordered) → capital
gains tax → surtax → total vs. withheld → refund. Money is integer **agorot**
end-to-end (`Agorot` from `@taxreturns/shared`); percentages are integer
**basis points** applied with explicit rounding helpers in `core/money.ts`.

**Tech Stack:** TypeScript 5 strict ESM, Vitest 3 (+ `@vitest/coverage-v8`
with branch-coverage gate), `@taxreturns/shared` (workspace). No runtime deps
beyond `shared`.

**Spec:** `docs/superpowers/specs/2026-07-03-tax-returns-app-design.md` §3, §8, §9.
CLAUDE.md build-order item "Plan 2 — tax-engine core".

## Verified year constants (2025 = 2024 by freeze law)

The Economic Efficiency Law (Amendments) 2025 (הקפאת עדכוני מס ומס יסף),
published 26 Dec 2024, froze all §120ב-indexed amounts for 2025–2027 at their
2024 values, and added a **2% surtax on capital-source income** above the
§121ב threshold from 2025. Primary source used throughout (owner must verify
per CLAUDE.md):

- **[booklet-2025]** Israel Tax Authority, לוח עזר לחישוב מס הכנסה ממשכורת
  ינואר 2025: <https://www.gov.il/BlobFolder/generalpage/income-tax-monthly-deductions-booklet/he/generalInformation_income-tax-monthly-deductions-booklet_monthly-deductions-booklet-2025.pdf>
- **[btl-rates]** ביטוח לאומי, שיעורי דמי ביטוח לעובדים שכירים:
  <https://www.btl.gov.il/Insurance/Rates/Pages/לעובדים שכירים.aspx>

| Constant (annual, NIS) | 2024 & 2025 | Source |
|---|---|---|
| Bracket 10% up to | 84,120 | [booklet-2025] p.מדרגות |
| Bracket 14% up to | 120,720 | [booklet-2025] |
| Bracket 20% up to | 193,800 | [booklet-2025] |
| Bracket 31% up to | 269,280 | [booklet-2025] |
| Bracket 35% up to | 560,280 | [booklet-2025] |
| Above → 47% | — | [booklet-2025] |
| Credit point (נקודת זיכוי) | 2,904 (242/mo) | [booklet-2025] §33א |
| Surtax (מס יסף §121ב) threshold | 721,560 | [booklet-2025] |
| Surtax rate | 3% (+2% on capital-source part, **2025 only**) | [booklet-2025] |
| Charity §46(א) minimum | 207 | [booklet-2025] |
| Charity §46(א) ceiling | lower of 10,354,816 or 30% of taxable income | [booklet-2025] + kolzchut §46 page |
| Charity credit rate (individual) | 35% | פקודת מס הכנסה §46(א) |
| Pension §45א qualifying-income ceiling (work income) | 116,400 (9,700/mo) | [booklet-2025] §47(א)(1)(1) |
| Pension §45א credit rate / contribution cap | 35% / 7% of qualifying income | פקודה §45א (owner-verify) |
| Real capital-gains rate (individual, §91(ב)) | 25% | פקודה §91(ב)(1) (owner-verify) |
| NI+health employee reduced rate (2025) | 1.04% + 3.23% | [btl-rates] |
| NI+health employee full rate (2025) | 7% + 5.17% (health 5% in Jan-2025) | [btl-rates] |
| NI reduced-band top / ceiling (monthly) | 2024: 7,522 / 49,030 · 2025: **owner-verify** | [btl-rates] shows 2026; module is informational-only |

2024 credit-point/bracket values equal 2025 (freeze is *from* 2024 values);
2024 NI reduced rate was 0.40% and health 3.10%/5.00%.

## Global Constraints

- Money: integer agorot only; rates as integer basis points; every rounding
  is `Math.round` at a named helper — no float arithmetic on amounts (spec §2).
- The engine **fails loudly** (spec §9): `UnknownTaxYearError`,
  `InvalidTaxInputError` (with a `field` path), never a silent default.
- Every constant in a year file carries a `// source:` URL comment.
- Every intermediate value appears in `TaxReturnResult` (spec §3).
- Strict TDD per task: failing test → implement → green → commit.
- Coverage gate: ≥95% branches on `src/**` via vitest `coverage.thresholds`.
- `ENGINE_VERSION` exported; bump on any rule/data change (starts `il-0.1.0`).

---

### Task 1: Package skeleton + core money helpers + typed errors

**Files:** `packages/tax-engine/{package.json,tsconfig.json,vitest.config.ts}`,
`src/core/{money.ts,errors.ts}`, `test/core/money.test.ts`.

**Produces:** `percentBp(amount: Agorot, bp: number): Agorot` (round-half-up,
validates bp is a non-negative safe integer); `minAgorot`/`maxAgorot`/`subAgorot`;
`TaxEngineError` base + `UnknownTaxYearError` + `InvalidTaxInputError`.
Root `pnpm test`/`typecheck` include the new package.

- [ ] Failing tests: percentBp exact (25% of 100 ₪), rounding (35% of 207 ₪ →
      round), bp validation throws, error classes carry `.year`/`.field`.
- [ ] Implement; green; commit `feat(tax-engine): package skeleton, money helpers, typed errors`.

### Task 2: Core types + IL year-data files + year selector

**Files:** `src/core/types.ts`, `src/jurisdictions/il/years/{2024,2025}.ts`,
`src/jurisdictions/il/index.ts` (`getIlYearData(year)`), tests.

**Produces:** `TaxYearInput` (taxpayer, salaries[], donations[],
capitalGains{entries[], lossCarryforwardIn}, pension inference from salaries),
`TaxReturnResult` (all section results + `form1301Fields` +
`lossCarryforwardOut` + `engineVersion`), `IlYearData` interface; both year
files with sourced constants; selector throws `UnknownTaxYearError` for 2023/2026.

- [ ] Failing tests: year selector returns 2024/2025 data, throws otherwise;
      year files satisfy `IlYearData`; bracket boundaries strictly increasing.
- [ ] Implement; green; commit `feat(tax-engine): core types and IL 2024/2025 year data with sourced constants`.

### Task 3: income-tax module (brackets + marginal breakdown)

`computeIncomeTax(taxableAgorot, yearData)` → per-bracket rows
(`{fromAgorot,toAgorot,rateBp,taxedAmountAgorot,taxAgorot}`) + total.
Tests: 0, boundary exact (84,120 ₪ → 8,412 ₪), mid-bracket, top bracket,
negative input throws. Commit `feat(tax-engine): IL income-tax brackets module`.

### Task 4: credit-points module

`computeCreditPoints({isIsraeliResident, gender, additionalPoints}, yearData)`
→ `{points, valueAgorot, breakdown[]}`. Resident 2.25, +0.5 female,
`additionalPoints` escape hatch (children/other rules land in a later plan
with their own verified table — refuse negatives). Quarter-point precision
(points stored ×4 as integers to stay float-free). Non-resident → 0 base.
Commit `feat(tax-engine): credit points module (resident, gender)`.

### Task 5: charity module (§46)

`computeCharityCredit(donations, taxableIncomeAgorot, yearData)` →
`{eligibleAgorot, creditAgorot, carryforwardOutAgorot, floorNotMetAgorot?}`.
Below 207 ₪ total → 0 credit; ceiling = min(10,354,816 ₪, 30% of taxable);
excess reported as carry-forward-out (3-year window tracked by DB, not engine).
Commit `feat(tax-engine): charity credit module (section 46)`.

### Task 6: capital-gains module (867 aggregation, offsets, carry-forward)

`computeCapitalGains({entries, lossCarryforwardInAgorot}, yearData)` →
aggregation across brokers, same-year loss offset (losses net against gains,
then against same-year interest/dividend-from-securities income),
prior-year carry-forward consumed against remaining net gains,
tax = 25% of remaining, `lossCarryforwardOutAgorot`, withheld compared at
result level. Property: carryforwardOut > 0 ⟹ tax = 0.
Commit `feat(tax-engine): capital gains with loss offset and carry-forward`.

### Task 7: pension module (§45א)

`computePensionCredit(salaries, yearData)`: credited contribution =
min(Σ employee pension contributions, 7% × min(Σ work income, 116,400 ₪));
credit = 35% of that. Exposes both caps in the result.
Commit `feat(tax-engine): pension credit module (section 45a)`.

### Task 8: national-insurance module (informational)

`reconcileNationalInsurance(salaries, yearData)` → expected employee
NI+health vs. actually withheld (Form 106), flagged `informational: true`,
never feeds the refund. 2025 uses verified rates; band boundaries carry
owner-verify annotations. Commit `feat(tax-engine): informational NI reconciliation`.

### Task 9: calculate() orchestrator + form1301Fields + ENGINE_VERSION

Order: aggregate income → income tax → credits (credit points → pension →
charity; credits cannot push tax below 0 — unused reported) → capital-gains
tax → surtax (3% over threshold; 2025 also +2% on capital part) → total
liability vs. total withheld → `refundAgorot` (positive = refund).
`form1301Fields`: canonical field map (codes annotated owner-verify against
the printed 1301). Input validated with loud typed errors (year mismatch,
negative amounts, non-integer money).
Commit `feat(tax-engine): calculate orchestrator with form 1301 field map`.

### Task 10: golden-file + property tests + coverage gate

- Golden scenarios (owner's real returns to be added later; synthetic ones
  now): single-employer salary-only refund; salary+donations;
  salary+capital-loss carry-forward; high earner with surtax (2024 vs 2025
  2% capital difference).
- Properties (fast-check NOT added — hand-rolled grid sweeps keep deps zero):
  refund ≤ total withheld when only withholding credits exist; income tax
  monotonic non-decreasing in income; marginal rate non-decreasing.
- Turn on `coverage.thresholds.branches ≥ 95` for `src/**`; wire
  `test:coverage` script.
Commit `test(tax-engine): golden scenarios, invariant sweeps, coverage gate`.

### Task 11: Full-suite verification

Root `pnpm test` + `pnpm typecheck` green; tag nothing (tag comes when the
API consumes the engine in Plan 3). Update CLAUDE.md current-state table.
Commit `docs: mark tax-engine core complete in CLAUDE.md`.
