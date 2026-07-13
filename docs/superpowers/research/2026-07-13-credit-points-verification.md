# Credit-points verification — IL 2024 & 2025 (children / degree / oleh)

Date: 2026-07-13 · Author: tax-law-analyst agent · Status: research report (no code changed)

Scope: the three credit-point (נקודות זיכוי) categories that the engine does
**not** compute today and that the reviewer enters by hand through
`TaxpayerInput.additionalCreditPoints` (units of 0.25 point):

1. Children (ילדים) by age band, year-of-birth rule, mother/father allocation.
2. Academic degree / vocational certificate (§40ג) — points, number of years,
   and which tax years may be claimed.
3. New immigrant / returning resident (עולה חדש) — graduated month schedule.

This report **supersedes and deepens** section 2 of
`docs/superpowers/research/2026-07-05-tax-constants-verification.md` (the
first-pass draft). Figures below are credit **points** unless a NIS value is
given. Point value 2024 & 2025 = **2,904 ₪/yr = 242 ₪/mo** (frozen; confirmed
in the 2026-07-05 report against the Tax Authority Jan-2024 / Jan-2025 booklets,
פרק ג §א). The engine stores that value as `creditPointValueAgorot = 290_400`
(agorot). Nothing here is an engine constant yet, so the "engine value" column
reads *manual* — these tables are candidates for a future automation plan and
every number needs the owner's primary-source sign-off before it lands in code.

## Sources used

| ID | Source | Tier |
|---|---|---|
| **kz-under6** | כל-זכות, "נקודות זיכוי ממס הכנסה להורה לפעוט (מתחת לגיל 6)" — <https://www.kolzchut.org.il/he/נקודות_זיכוי_ממס_הכנסה_להורה_לפעוט_(מתחת_לגיל_6)> | secondary |
| **kz-6to17** | כל-זכות, "נקודות זיכוי ממס הכנסה להורים לילדים בגיל 17-6" — <https://www.kolzchut.org.il/he/נקודות_זיכוי_ממס_הכנסה_להורים_לילדים_בגיל_17-6> | secondary |
| **kz-under18** | כל-זכות, "נקודות זיכוי ממס הכנסה להורה לילד עד גיל 18" (consolidated table) — <https://www.kolzchut.org.il/he/נקודות_זיכוי_ממס_הכנסה_להורה_לילד_עד_גיל_18> | secondary |
| **kz-single** | כל-זכות, "הורה אחד" — <https://www.kolzchut.org.il/he/נקודות_זיכוי_ממס_הכנסה_ל%22הורה_אחד%22_עבור_גידול_ילדיו> | secondary |
| **kz-divorced** | כל-זכות, "הורה גרוש או פרוד" — <https://www.kolzchut.org.il/he/נקודות_זיכוי_ממס_הכנסה_להורה_גרוש_או_פרוד_עבור_גידול_ילדיו> | secondary |
| **gov-2024law** | רשות המסים / כנסת, "אושר לקריאה שנייה ושלישית: תוספת נקודות זיכוי..." (חוק סיוע להורים לילדים עד גיל שלוש, 5 Mar 2024) — <https://www.gov.il/he/pages/sa050324-2> (returns HTTP 403 to the fetcher; cited from the search index — **owner must open directly**) | primary (unverified fetch) |
| **kz-ba** | כל-זכות, "בגין תואר ראשון" — <https://www.kolzchut.org.il/he/נקודות_זיכוי_ממס_הכנסה_בגין_תואר_ראשון> | secondary |
| **kz-ma** | כל-זכות, "בגין תואר שני" — <https://www.kolzchut.org.il/he/נקודות_זיכוי_ממס_הכנסה_בגין_תואר_שני> | secondary |
| **kz-voc** | כל-זכות, "בגין לימודי מקצוע" — <https://www.kolzchut.org.il/he/נקודות_זיכוי_ממס_הכנסה_בגין_לימודי_מקצוע> | secondary |
| **kz-phd** | כל-זכות, "תואר שלישי במסלול ישיר" — <https://www.kolzchut.org.il/he/נקודות_זיכוי_ממס_הכנסה_בגין_תואר_שלישי_במסלול_ישיר> | secondary |
| **kz-med** | כל-זכות, "תואר ברפואה או ברפואת שיניים" — <https://www.kolzchut.org.il/he/נקודות_זיכוי_ממס_הכנסה_בגין_תואר_ברפואה_או_ברפואת_שיניים> | secondary |
| **form119** | רשות המסים, טופס 119 — בקשה להטבה במס לזכאים לתואר אקדמי/תעודת מקצוע (2024) — <https://www.gov.il/BlobFolder/service/itc119/he/Service_Pages_Income_tax_annual-report-2024_itc119-2024.pdf> | primary |
| **kz-oleh** | כל-זכות, "נקודות זיכוי ממס הכנסה לעולה חדש" — <https://www.kolzchut.org.il/he/נקודות_זיכוי_ממס_הכנסה_לעולה_חדש> | secondary |

Statutory anchors: §40 + §66(ג) (children/allocation), §40ג (degrees/vocational),
§35 (oleh) of פקודת מס הכנסה. **The primary ordinance text was not read line by
line for this report** — all point counts below rest on כל-זכות (secondary) plus
the Tax Authority Form 119 (primary, degrees only). Treat every figure as
"needs owner verification against the ordinance" unless marked otherwise.

---

## 1. Children (ילדים) — 2024 & 2025

Legal changes, both retroactive to 1 Jan 2024 and enacted as permanent law:
- **חוק סיוע להורים לילדים עד גיל שלוש (תיקוני חקיקה), התשפ"ד-2024** — added
  points for the very young ages (birth +1, ages 1-2 +2, age 3 +1 per the
  reform), and
- extension of the previously-temporary "extra point for ages 6-12" to the full
  **6-17** band from 2024 on (kz-6to17; for 2022-2023 the extra point covered
  only ages 6-12). Source: gov-2024law, kz-under6, kz-6to17.

### 1.1 Points per eligible parent by the age the child reaches during the tax year

| Child age in tax year | Engine | Points — mother / custodial | Points — father / other parent | Source | Verdict |
|---|---|---|---|---|---|
| Born this year | manual | 2.5 | 2.5 | kz-under6, kz-under18 | CONFIRMED (secondary) |
| 1 | manual | 4.5 | 4.5 | kz-under6, kz-under18 | CONFIRMED (secondary) |
| 2 | manual | 4.5 | 4.5 | kz-under6, kz-under18 | CONFIRMED (secondary) |
| 3 | manual | 3.5 | 3.5 | kz-under6, kz-under18 | CONFIRMED (secondary) |
| 4 | manual | 2.5 | 2.5 | kz-under6, kz-under18 | CONFIRMED (secondary) |
| 5 | manual | 2.5 | 2.5 | kz-under6, kz-under18 | CONFIRMED (secondary) |
| 6-17 | manual | 2 | 1 | kz-6to17, kz-under18 | CONFIRMED (secondary) |
| 18 | manual | 0.5 | 0 | kz-under18 | CONFIRMED (secondary) |

Both years 2024 and 2025 use the same table (point *value* frozen; the point
*counts* above are statutory, not indexed, so the freeze law is irrelevant to
them). 2023 differed (birth 1.5 / ages 1-2 2.5 / age 3 2.5 / 6-12 only) — out of
scope unless we ever compute 2023.

### 1.2 Mother-vs-father allocation — **UNRESOLVED, owner must verify §40/§66(ג)**

The two כל-זכות pages frame the split differently and I could not reconcile them
against the primary text:

- **kz-under6** lists the young-child points as available to *each* parent, with
  a conditioning note: the mother receives them if she receives the child
  allowance (קצבת ילדים), the father if he does not — i.e. the couple does not
  get the points twice; they attach to one parent per the allowance/custody test
  (with the other parent able to claim in the reverse case).
- **kz-under18** (consolidated) states "ההטבה ניתנת רק לאחד ההורים" ("the
  benefit goes to one parent only"): for a married/cohabiting couple → the
  mother; for separated/divorced → the custodial parent / the one receiving the
  child allowance.
- For **ages 6-17** the split is asymmetric and clearer: custodial/allowance
  parent gets **2**, the other parent gets **1** (kz-6to17).

What is safe to state: the *per-child point counts* in §1.1 are well-attested;
**which parent claims them** depends on custody / child-allowance receipt / a
§66(ג) election between spouses, and the "birth year" point can be split across
two years by filing **טופס 116ד** in both years (kz-under18). Special regimes —
**הורה יחיד** (single parent, other parent absent: may receive both allocations,
kz-single) and **גרוש/פרוד** including a parent paying/receiving מזונות
(kz-divorced) — change the allocation further. Recommend the engine keep taking
a per-parent *total* for children (reviewer-entered) until these allocation
rules are verified against §40 and §66(ג) and the divorced/single-parent pages.

### 1.3 Age-band mechanics to verify

- Age is the age the child **reaches during** the tax year (ה"שנת המס שבה
  ימלאו לו X"), not age at year-start — CONFIRMED phrasing in kz-under6/kz-6to17,
  but confirm the boundary handling for a child turning 6 or 18 mid-year.
- The 6-17 addition historically attached to יגיעה-אישית income; confirm whether
  any income-source restriction still applies for 2024-2025.

---

## 2. Academic degree / vocational certificate (§40ג) — 2024 & 2025

Benefit is claimed in the tax years **after** the year studies were completed,
via **טופס 119** (form119). One benefit per level; the year(s) in which it may
be claimed depend on the completion year. Point *counts* are statutory (not
indexed); the same table applies to 2024 and 2025.

### 2.1 Bachelor's (תואר ראשון) — §40ג(ב)

| Completion year | Engine | Points | Number of tax years | Which years claimable | Source | Verdict |
|---|---|---|---|---|---|---|
| 2014-2022 | manual | 1 | 1 year only | year after completion **or** the year after that (taxpayer's choice) | kz-ba, form119 | CONFIRMED (secondary + Form 119) |
| 2023 onward | manual | 1 per year | up to 3 (= number of study years, capped at 3) | consecutive tax years after the completion year | kz-ba | CONFIRMED (secondary) |

### 2.2 Master's (תואר שני) — §40ג(ב)

| Completion year | Engine | Points | Number of tax years | Which years claimable | Source | Verdict |
|---|---|---|---|---|---|---|
| 2014-2022 | manual | 0.5 | 1 year only | year after completion **or** the year after (choice) | kz-ma | CONFIRMED (secondary) |
| 2023 onward | manual | 0.5 per year | 2 | the two tax years after the completion year | kz-ma | CONFIRMED (secondary) |

### 2.3 Vocational studies / certificate (לימודי מקצוע / תעודת מקצוע) — §40ג

| Completion year | Engine | Points | Number of tax years | Source | Verdict |
|---|---|---|---|---|---|
| 2014-2022 | manual | 1 | 1 year (year after, or the next — choice) | kz-voc | CONFIRMED (secondary) |
| 2023 onward | manual | 1 per year | up to 3 (= study years, cap 3) | kz-voc | CONFIRMED (secondary) |

Eligibility conditions (kz-voc): studies of at least **1,700 hours** recognized
by an academic institution; a professional certificate recognized by a
government body (הנדסאי / טכנאי / חשמלאי / תעודת הוראה, etc.); **cannot** be
combined with a bachelor's/master's credit for the same studies. Verify the
1,700-hour threshold and the recognized-certificate list against §40ג /
regulations before coding.

### 2.4 Timing nuances and out-of-scope tracks — flag

- **Internship professions (התמחות)** — law, accountancy, etc.: the start of the
  benefit period may be **deferred** to the tax year after the internship ends
  (kz-ba, form119). Needs owner verification of the exact deferral rule.
- **Direct-track doctorate (תואר שלישי במסלול ישיר)**: roughly 1 pt/yr for the
  first 3 years then 0.5 pt/yr for 2 years — **UNRESOLVED**, verify against
  kz-phd and §40ג before use.
- **Medicine / dentistry (רפואה / רפואת שיניים)**: its own multi-year schedule
  (kz-med) — **UNRESOLVED / out of scope** for a first automation pass.
- Confirm whether the year(s) of eligibility are fixed by law or elective for
  2023+ completions (the "choice" only clearly applies to the 2014-2022 cohort).

---

## 3. New immigrant / returning resident (עולה חדש) — §35

Graduated schedule counted in **months from the month oleh status was granted**.
The clock can be **paused** (not consumed) for periods abroad, full-time study,
or army service — the oleh may ask to exclude those months (kz-oleh); confirm the
exact list of pausing events against §35. Applies to all taxable income; claimed
via טופס 101 / annual return.

### 3.1 Schedule (points per month), with derived totals

| Aliyah date | Engine | Month bands → points/month | Total points | Total months | Source | Verdict |
|---|---|---|---|---|---|---|
| Before 1.1.2022 | manual | mo 1-18: ¼ · mo 19-30: ⅙ · mo 31-42: 1/12 | **7.5** | 42 | kz-oleh | CONFIRMED (secondary); total is derived |
| From 1.1.2022 | manual | mo 1-12: 1/12 · mo 13-30: ¼ · mo 31-42: ⅙ · mo 43-54: 1/12 | **8.5** | 54 | kz-oleh | CONFIRMED (secondary); total is derived |

Total arithmetic (load-bearing — a fetched summary of kz-oleh mis-stated the
totals as 3.5 / 4.5; the correct sums are):
- Pre-2022: ¼×18 (4.5) + ⅙×12 (2) + 1/12×12 (1) = **7.5 points over 42 months**.
- 2022+: 1/12×12 (1) + ¼×18 (4.5) + ⅙×12 (2) + 1/12×12 (1) = **8.5 points over
  54 months**.

Per full tax year the points are apportioned by how many qualifying months fall
in that year (e.g. an oleh who arrives mid-year gets a fractional first-year
figure). The monthly rates — not the annual totals — are what the engine would
need.

### 3.2 UNRESOLVED for the 2022+ schedule

The 54-month schedule was introduced as a **הוראת שעה** in the 2021-2022
arrangements legislation. כל-זכות presents it as in force for 2024-2025 olim, but
**its statutory sunset / renewal status must be verified against the current text
of §35** before coding — do not assume permanence. (Note the freeze law does not
touch §35 point *counts*; only the point *value* is frozen.)

Returning residents (**תושב חוזר / תושב חוזר ותיק**) have their own, different
regime not covered here — flag as separate research if the app needs it.

---

## 4. Verdict summary

- **CONFIRMED (secondary — כל-זכות, plus Form 119 for degrees):** the per-child
  point counts by age band (§1.1); the degree/vocational point counts and
  claim-year rules for the 2014-2022 and 2023+ cohorts (§2.1-2.3); the oleh
  monthly-rate schedules and their 7.5 / 8.5 totals (§3.1). Point value
  2,904 ₪/yr for both years (prior report, booklets — primary).
- **CORRECTED:** the oleh totals — a fetched summary said 3.5 / 4.5; correct
  totals are **7.5 / 8.5** (matches the 2026-07-05 draft).
- **UNRESOLVED / owner must verify against the ordinance:**
  1. Mother-vs-father allocation of child points, incl. single-parent, divorced,
     and מזונות cases, and the §66(ג) spousal election (§1.2) — two כל-זכות
     framings conflict.
  2. Whether the 2023+ degree claim years are fixed or elective, and the
     internship (התמחות) deferral rule (§2.4).
  3. Direct-track PhD and medicine/dentistry schedules (§2.4).
  4. The 1,700-hour and recognized-certificate conditions for vocational (§2.3).
  5. The current §35 status (permanent vs הוראת שעה sunset) of the 54-month
     oleh schedule (§3.2) and the exact list of clock-pausing events.
- **No primary ordinance text (§40 / §40ג / §35) was read for this report** —
  all non-Form-119 figures are secondary. Owner should confirm at least §1.1,
  §2, §3.1 against the ordinance or the Tax Authority before automation.

---

## 5. Proposed engine shape (no code written)

Current structure: `computeCreditPoints(taxpayer, yearData)` in
`packages/tax-engine/src/jurisdictions/il/modules/credit-points.ts` works in
integer **quarter-point** units and only knows `resident` (2.25) + `female`
(0.5) + a reviewer-supplied `additionalCreditPoints` (0.25 steps). Point value
lives in `IlYearData.creditPointValueAgorot`. `TaxpayerInput` (core/types.ts)
carries only `isIsraeliResident`, `gender`, `additionalCreditPoints`.

Because the three tables are **statutory point counts, not indexed money**, they
belong in a jurisdiction-level rules module (shared across years), *not* in the
per-year `IlYearData` files — keep `years/*.ts` for indexed amounts only. A
possible slot-in that preserves the quarter-point integer discipline and the
`CreditPointsBreakdownRow` audit trail:

- Extend `TaxpayerInput` with optional structured inputs, each convertible to
  quarter-points, all still overridable by the existing `additionalCreditPoints`
  escape hatch (keep it — it's the reviewer's fallback for the UNRESOLVED cases):
  - `children?: Array<{ ageInTaxYear: number; role: 'custodial' | 'other' }>`
  - `degrees?: Array<{ level: 'bachelor'|'master'|'vocational'; completionYear: number; claimYearIndex: number }>`
  - `aliyah?: { statusGrantedYearMonth: string; scheduleVariant: 'pre2022'|'from2022' }`
- Add pure lookup helpers beside the module, e.g. `childPointsForAge(age, role)`
  → quarters, `degreePointsForYear(level, completionYear, claimYearIndex)`, and
  `olehPointsForMonths(variant, monthsElapsedInYear)` → quarters. All return
  integer quarter-points so `computeCreditPoints` stays integer.
- New `CreditPointsBreakdownRow.reason` values (`'child'|'degree'|'oleh'`) with a
  per-row label so the worksheet panel shows *why* each point was granted —
  matches the "fully auditable, no black-box" rule.
- Guardrails consistent with the engine's fail-loud convention: reject an
  `ageInTaxYear` outside 0-18 for a child row, a `claimYearIndex` beyond the
  degree's allowed window, and any non-quarter-resolvable sum.

Given the open §1.2 allocation and §3.2 sunset questions, a safe first
increment is **only the parts with no live legal ambiguity**: the child age→point
table (§1.1) *with the reviewer still choosing each child's `role`*, and the oleh
`pre2022`/`from2022` monthly schedules — leaving degrees and the parent-allocation
automation until the owner clears the UNRESOLVED items. `additionalCreditPoints`
stays as the catch-all for everything not yet modelled.
