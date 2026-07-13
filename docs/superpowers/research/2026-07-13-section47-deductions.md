# §47 pension **deductions** (ניכויים) — IL 2024 & 2025

Date: 2026-07-13 · Author: tax-law-analyst agent · Status: research report (no code changed)

Scope: the **deduction** side of pension/provident tax relief — ניכוי לפי
סעיף 47 לפקודה — as distinct from the §45א **credit** (זיכוי) the engine
already implements (`modules/pension.ts`). Covers eligible contribution types,
rates, income ceilings (תקרות) and caps for tax years 2024 and 2025, and the
employee-vs-self-employed / מבוטח-vs-לא-מבוטח interaction. Amounts shown in
NIS; the agorot value an engine would store is ×100 (noted per row).

**Bottom line up front:** the four *ceiling* figures that a §47 module needs
are CONFIRMED against the primary Tax Authority booklet for both years. The
*rates* that turn those ceilings into caps (11% deduction, 5.5% complementary
credit, the §47(ב1) "ניכוי נוסף") are **NOT printed in any gov.il source I
could reach** — they come from the ordinance text plus licensed-firm tables,
so they are marked NEEDS-OWNER-VERIFICATION. Do not hard-code a rate from this
report without the owner checking §47(ב)/(ב1) of the ordinance.

## Primary / authoritative sources used

| ID | Source |
|---|---|
| **booklet-2025** | רשות המסים, לוח עזר לחישוב מס הכנסה ממשכורת ושכר עבודה, ינואר 2025, פרק ג §ב "קופות גמל וקרנות השתלמות" (p. 9) and פרק א §§5-6 — <https://www.gov.il/BlobFolder/generalpage/income-tax-monthly-deductions-booklet/he/generalInformation_income-tax-monthly-deductions-booklet_monthly-deductions-booklet-2025.pdf> |
| **booklet-2024** | Same series, ינואר 2024, same section — <https://www.gov.il/BlobFolder/generalpage/income-tax-monthly-deductions-booklet/he/generalInformation_income-tax-monthly-deductions-booklet_monthly-deductions-booklet-2024.pdf> |
| **rashut-benefits** | רשות המסים explainer PDF "סעיף 45א וסעיף 47 לפקודת מס הכנסה – הטבות מס לשכירים ולעצמאים" (gov.il, general — 2022 figures, used only for the ניכוי/זיכוי *concept*, not amounts) — <https://www.gov.il/BlobFolder/generalpage/pensions-forms/he/files_pensions-forms_tax-benefits-fund-independent.pdf> |
| kolzchut | הטבות במס הכנסה בגין הפקדות עצמאיות לביטוח פנסיוני — <https://www.kolzchut.org.il/he/הטבות_במס_הכנסה_בגין_הפקדות_עצמאיות_לביטוח_פנסיוני> ; זיכוי ממס הכנסה בגין הפרשות לביטוח פנסיוני — <https://www.kolzchut.org.il/he/זיכוי_ממס_הכנסה_בגין_הפרשות_לביטוח_פנסיוני> (secondary) |
| as-invest-2025 / -2024 | as-invest (licensed pension/investment firm), "תקרות וניכויים" tables נכון לשנת 2025 / 2024 — <https://www.as-invest.co.il/media/54fdewrx/תקרות-וסכומים-2025.pdf> ; <https://www.as-invest.co.il/media/gbflsnkd/תקרות-וסכומים-2024.pdf> (corroboration only) |

Freeze note: unlike the brackets/credit-point/surtax constants, the §47
pension ceilings are indexed to the **average wage**, not to §120ב CPI, so the
2024-2027 freeze law (חוק ההתייעלות הכלכלית) is **not** what keeps them equal.
They are equal 2024 = 2025 for a different reason: the "שכר ממוצע לעניין
גביית דמי ביטוח" was itself frozen at **12,536 ₪/mo** from Jan 2024
(booklet-2025 פרק א §5, and the "עמית מוטב" note §6 which pins §47(א)(7) to
12,536). Owner should not assume this equality survives into 2026 — verify the
average-wage figure each year.

---

## 1. Concept — ניכוי (§47) vs זיכוי (§45א)

| Aspect | ניכוי §47 (deduction) | זיכוי §45א (credit) — already in engine |
|---|---|---|
| What it reduces | **taxable income**, *before* the brackets | **tax**, *after* the brackets |
| Worth to taxpayer | contribution × marginal rate (10-47%) | contribution × 35% flat (`creditRateBp` 3500) |
| Who | **עמית עצמאי only** (self-employment income / "הכנסה נוספת"); a *salaried* employee gets it only for independent contributions against **שכר לא מבוטח** | עמית שכיר, עמית עצמאי, and life-insurance |
| Engine today | **not modelled** | `computePensionCredit` — 35% of box-045 contributions, capped at 7% of work income up to 116,400 ₪/yr |

Source for the concept and the "§47 = deduction reducing the tax bracket,
§45א = 35% credit after full tax": rashut-benefits (gov.il) — "סעיף 47 … ניכוי
מס משמעותו הורדת הסכום המנוכה מהמשכורת החייבת במס … ניכוי מקטין את מדרגת המס
שלכם"; "סעיף 45א … מעניק 35% זיכוי מס הכנסה … אין שינוי במדרגת המס שלכם".
Corroborated by kolzchut and the booklet's own §47/§45א election note (below).

**Election rule (matters for any implementation).** booklet-2025 פרק א §6:
the taxpayer may choose, in the annual return, to take the §47 deduction and
§45א credit either **as an "עמית מוטב" or as a non-"עמית מוטב", whichever is
more beneficial** ("לבחור … לקבל את הניכוי לפי סעיף 47 והזיכוי לפי סעיף 45א
כ'עמית מוטב' או כנישום שאינו 'עמית מוטב' … בהתאם לאפשרות המטיבה עמו"). A §47
module must therefore compute both branches and keep the better one — CONFIRMED.

---

## 2. Ceilings — CONFIRMED against the primary booklet (both years)

These are printed verbatim in booklet-2024 and booklet-2025 פרק ג §ב and are
**identical across the two years**. Monthly figures as printed; annual = ×12;
agorot = annual ×100.

| Constant | Booklet label | 2024 & 2025 value | Annual | Agorot (annual) | Source | Verdict |
|---|---|---|---|---|---|---|
| §47(א)(1)(1) הכנסה מזכה — work income only | "תקרת הכנסה מזכה 47(א)(1)(1) - רק מהכנסת עבודה" | 9,700 ₪/mo | 116,400 ₪ | 11,640,000 | booklet-2025 p.9; booklet-2024 p.9 | CONFIRMED |
| §47(א)(1)(2) הכנסה מזכה — not from work income | "תקרת הכנסה מזכה 47(א)(1)(2) - לא מהכנסת עבודה" | 13,700 ₪/mo | 164,400 ₪ | 16,440,000 | ״ | CONFIRMED |
| §47(א) עמית עצמאי ceiling | "תקרת הכנסה לעמית עצמאי 47(א)" (2024: 47(א)(3)) | 9,700 ₪/mo | 116,400 ₪ | 11,640,000 | ״ | CONFIRMED |
| §47(א)(5) הכנסה נוספת ceiling | "תקרת הכנסה נוספת 47(א)(5)" | 24,250 ₪/mo | 291,000 ₪ | 29,100,000 | ״ | CONFIRMED |
| §47(א)(7) "עמית מוטב" qualifying-deposit threshold | "עמית מוטב 47(א)(7)" (16% × avg wage 12,536) | — | 24,069 ₪/yr | 2,406,900 | booklet-2025 p.9 + פרק א §6; booklet-2024 p.9 | CONFIRMED |
| §45א(ד) / §45א(ה)(1) insurance+tagmulim credit ceiling | "תקרת הסכום לזיכוי בעד דמי ביטוח ותגמולים 45א(ד)/(ה)(1)" | 189 ₪/mo | 2,268 ₪ | 226,800 | ״ | CONFIRMED |
| §45א(ה)(2) ceiling | "תקרת הסכום לזיכוי … 45א(ה)(2)" | 19,400 ₪/mo | 232,800 ₪ | 23,280,000 | ״ | CONFIRMED |

Cross-checks: 9,700 ₪/mo → 116,400 ₪/yr matches the engine's existing
`pension45a.qualifyingIncomeCeilingAgorot` (11,640,000) and the 2026-07-05
report §1.5. The 232,800 ₪ figure the industry tables use as the self-employed
"עמית מוטב הכנסה מזכה" base (see §3) is exactly **§45א(ה)(2) 19,400 ₪/mo ×12** —
noted because it is *not* separately printed as a §47 line.

### קרן השתלמות (related deduction, but **§17(5א), not §47**)

The task lists קרן השתלמות "where relevant". A self-employed person's keren
hishtalmut contribution is deductible under **§17(5א)** (a business-expense
deduction), not §47 — but it belongs on the same "deductions before brackets"
step, so it is captured here.

| Constant | 2024 | 2025 | Source | Verdict |
|---|---|---|---|---|
| §17(5א) תקרת הכנסה קובעת (self-employed) | 293,397 ₪/yr | 293,397 ₪/yr | booklet-2024 & -2025 p.9 "תקרת הכנסה קובעת בקרן השתלמות לעצמאיים 17(5א)" | CONFIRMED |
| §9(16א)/(16ב) הפקדה מוטבת (gains-exempt cap) | 20,520 ₪/yr | 20,566 ₪/yr | booklet p.9 "הפקדה מוטבת 9(16א) ו-9(16ב)" | CONFIRMED — **note: NOT equal across years** (20,520 → 20,566) |
| §17(5א) deduction rate = 4.5% of הכנסה קובעת → max | 13,203 ₪ (4.5%×293,397) | 13,203 ₪ | as-invest-2024/-2025 (rate is statutory §17(5א); **not** in booklet) | NEEDS-OWNER-VERIFICATION (rate) |

The 20,520≠20,566 row is a useful reminder that not *every* pension figure is
frozen — the deduction-relevant ceilings (§2 table) happen to be, this one is not.

---

## 3. Rates and caps — NEEDS-OWNER-VERIFICATION (not in any gov.il source reached)

The booklet gives ceilings but never prints the **percentage** applied to them.
The figures below are consistent across the licensed-firm tables (as-invest
2024 = 2025, identical) and the ordinance's known structure, but I could not
confirm them against a gov.il primary source. Treat every rate here as
provisional until the owner reads §47(ב)/(ב1) and §45א(ד) of the ordinance.

### 3.1 Self-employed (עמית עצמאי) who is an "עמית מוטב"

| Item | Rate | Base | Cap (2024 & 2025) | Agorot | Source | Verdict |
|---|---|---|---|---|---|---|
| §47(ב) **deduction** | 11% | 232,800 ₪ הכנסה מזכה (מוטב) | 25,608 ₪ | 2,560,800 | as-invest-2025/-2024 ("סכום מירבי להטבת המס ניכוי לפי סעיף 47 עבור עמית מוטב 11% מהכנסה שנתית מזכה — 25,608 ₪"); kolzchut | NEEDS-OWNER-VERIFICATION |
| §45א **complementary credit** | 5.5% | 232,800 ₪ | 12,804 ₪ contribution → credit 35%×12,804 = **4,481.40 ₪** | contribution 1,280,400 | as-invest ("סכום הפקדה מירבי … זיכוי בשיעור 35% לסעיף 45א בגובה 5.5% מהכנסה מזכה — 12,804 ₪") | NEEDS-OWNER-VERIFICATION |
| Combined benefit ceiling | 16.5% | = 11% + 5.5% | — | — | as-invest; kolzchut; eyalmen | NEEDS-OWNER-VERIFICATION |

Ambiguity to flag for the owner: the **deduction base** for the מוטב branch is
shown as 232,800 ₪ (= §45א(ה)(2) ×12), giving 11%→25,608. But the booklet's own
"§47(א)(1)(2) לא מהכנסת עבודה" ceiling is only 164,400 ₪ (11%→18,084). Which
ceiling governs the §47(ב) deduction for a self-employed מוטב — 164,400 or
232,800 — is precisely the point the ordinance text must settle. The industry
tables use 232,800; the booklet does not label it as a §47 figure.

### 3.2 "ניכוי נוסף" — additional deduction, §47(ב1) (conflicting sources)

For a taxpayer with **"הכנסה נוספת"** (income not covered by an employer
pension) there is an additional deduction. Sources disagree on the number:

- kolzchut / rashut-benefits: an extra **0.5%** of income (cap ~1,164 ₪),
  taken as a 35% **credit**, conditional on not having claimed the אכ"ע
  (disability-insurance) benefit under §32(14) — this is the "0.5%" that turns
  the 5% credit into 5.5%.
- CPA corroboration (miralmalka, search index): an additional **7%** *deduction*
  on הכנסה שאינה מבוטחת (uninsured income), on top of the 11%.

These describe two different mechanisms (a 0.5% *credit* top-up vs. a 7%
*deduction* on הכנסה נוספת) and I could reconcile neither against §47(ב1)
directly. **UNRESOLVED** — the owner must read §47(ב1) before either is coded.

### 3.3 Salaried employee — §47 deduction against **שכר לא מבוטח**

The engine's population is Form-106 salary earners, so this is the case that
could actually fire. An employee may take a §47 deduction for **independent**
contributions against salary components the employer does **not** insure
("שכר לא מבוטח"). Key gate:

| Rule | Value (2024 & 2025) | Source | Verdict |
|---|---|---|---|
| If the employer-**insured** salary exceeds this, **no** §47 deduction for independent contributions against uninsured salary | 24,250 ₪/mo (= §47(א)(5) הכנסה נוספת ceiling) | as-invest-2025/-2024 ("מי ששכרו המבוטח ע״י המעביד עולה על הכנסה זו, אינו זכאי לניכוי לפי סעיף 47 עבור הפקדה באופן עצמאי כנגד שכר לא מבוטח") — ceiling itself CONFIRMED in booklet §47(א)(5) | rule NEEDS-OWNER-VERIFICATION; ceiling CONFIRMED |

Mechanically: "הכנסה נוספת" ≈ min(uninsured income, 24,250 ₪/mo − insured
salary). When insured salary ≥ 24,250 ₪/mo the §47 deduction is 0. Note the
box-045 employee contributions the engine already reads are contributions on
**insured** salary → those go to the §45א **credit**, never to a §47 deduction.
So for a typical single-employer salaried filer with no independent fund, the
§47 deduction is **zero** and the engine's current output is already correct.

### 3.4 מבוטח vs לא מבוטח — summary of the interaction

| Income type | "insured"? | Employee's own contribution routed to | In engine? |
|---|---|---|---|
| הכנסת עבודה with employer pension (מבוטח) | yes | §45א **credit** (box 045) | yes — `computePensionCredit` |
| שכר לא מבוטח (uninsured salary components) | no | §47 **deduction** (subject to §47(א)(5) 24,250 ₪/mo gate) + §45א credit | no |
| הכנסה מעסק/משלח-יד (self-employed) | no | §47 **deduction** (11%) + §45א credit (5.5%) | no (no business-income input exists) |

---

## 4. Proposed engine shape (no code written)

Where a §47 step would sit in `calculate.ts` (current order: `workIncome →
computeIncomeTax(workIncome) → computeCapitalGains → credits(points/pension/
charity) → surtax → liability`):

1. **Deductions run *before* `computeIncomeTax`.** Today line ~66 calls
   `computeIncomeTax(workIncome, yearData)` on raw gross salary. A §47/§17(5א)
   deduction must produce a `taxableWorkIncome = workIncome − section47Deduction
   − section17_5aDeduction` and feed *that* to the brackets. Credits (§45א,
   points, charity) stay exactly where they are — *after* the brackets. This is
   the deduction-before-brackets / credit-after-brackets split the task calls out.
2. **New year-data block** `section47` alongside the existing `pension45a`:
   ```
   section47: {
     deductionRateBp,            // 1100 (11%) — NEEDS-OWNER-VERIFICATION
     motavCeilingAgorot,         // 23,280,000 (232,800) — base ambiguity, see §3.1
     nonMotavCeilingAgorot,      // 16,440,000 (164,400) — CONFIRMED ceiling
     additionalIncomeCeilingMonthlyAgorot, // 2,425,000 (24,250/mo) — CONFIRMED
     motavThresholdAnnualAgorot, // 2,406,900 (24,069) — CONFIRMED
   }
   ```
   Only the CONFIRMED ceilings should be filled from this report; the two `*RateBp`
   values stay `TODO(owner-verify)` until §47(ב) is read.
3. **New input fields** are required — the engine cannot compute a §47 deduction
   from `SalaryInput` alone. Minimum additions: self-employment/business income,
   independent (עמית-עצמאי / שכר-לא-מבוטח) contributions, and a per-salary
   "insured salary" figure to apply the 24,250 ₪/mo gate. Absent these, §47 = 0,
   which is already the engine's implicit (correct) result for pure-salary filers.
4. **Election branch (§1).** Compute the מוטב and non-מוטב variants and keep the
   result with the lower total tax — mirror the taxpayer-favourable choice the
   booklet grants. A single `PensionDeductionResult` should expose both branches
   for the audit worksheet, like every other module.
5. **Scope call for Phase 1.** For the current single-owner salaried case the
   §47 deduction is almost certainly 0 (single employer, fully-insured salary,
   no independent fund). Recommend the owner confirm whether any §47 deduction
   or self-employed קרן-השתלמות deduction actually applies to *his* return before
   this is built — it may be deferrable, exactly like the children/degree/oleh
   credit-point tables.

---

## 5. Verdict summary

- **CONFIRMED (primary gov.il booklet, both years):** §47(א)(1)(1)=9,700 ₪/mo
  (116,400/yr); §47(א)(1)(2)=13,700 ₪/mo (164,400/yr); §47(א) עמית עצמאי
  9,700 ₪/mo; §47(א)(5) הכנסה נוספת 24,250 ₪/mo (291,000/yr); §47(א)(7) עמית
  מוטב threshold 24,069 ₪/yr; §45א(ד)/(ה)(1)=189 ₪/mo, §45א(ה)(2)=19,400 ₪/mo
  (232,800/yr); §17(5א) הכנסה קובעת 293,397 ₪/yr. The ניכוי/זיכוי concept and
  the מוטב/non-מוטב **election** rule. 2024 = 2025 for all of these (average-wage
  freeze, *not* the §120ב freeze — verify separately for 2026).
- **CORRECTED:** none (no §47 constant exists in the engine yet to correct).
- **NEEDS-OWNER-VERIFICATION (rates/caps — no gov.il source reached):** §47(ב)
  deduction rate 11% → cap 25,608 ₪; §45א complementary 5.5% → 12,804 ₪
  contribution (4,481.40 ₪ credit); combined 16.5%; §17(5א) rate 4.5% →
  13,203 ₪; the salaried "insured-salary > 24,250 ₪/mo ⇒ no §47 deduction" gate;
  and which ceiling (164,400 vs 232,800) is the §47(ב) deduction base for a
  self-employed מוטב.
- **UNRESOLVED:** the §47(ב1) "ניכוי נוסף" — sources describe two incompatible
  mechanisms (0.5% credit top-up vs. 7% deduction on הכנסה נוספת); needs the
  ordinance text.
- **Note (not a §47 issue):** §9(16א)/(16ב) קרן-השתלמות הפקדה מוטבת is 20,520 ₪
  (2024) vs 20,566 ₪ (2025) — a rare pension figure that is **not** frozen.
