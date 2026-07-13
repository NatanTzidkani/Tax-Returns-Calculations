# Non-linked interest taxed at 15% (§125ג) — rule research, tax years 2024 & 2025

Date: 2026-07-13 · Author: tax-law-analyst agent · Status: research report (no code changed)

Scope: the Israeli income-tax treatment of **interest income of an individual**
— the 15% rate on interest from a non-index-linked asset (ריבית על נכס שאינו
צמוד למדד) versus the 25% rate on real interest from an index-linked/foreign-
currency-linked asset — for 2024 and 2025; the marginal-rate cap ("לא יעלה על");
how this differs from the securities capital-gains path the engine already
implements (Form 867); and the Form 1301 / Form 867 field codes. Ends with a
proposed engine shape. **The engine does NOT implement any 15% interest branch
today** (deferred in Plan 2, see CLAUDE.md and the `capital-gains.ts` header).

Engine stores integer **agorot** (₪ × 100); this report is in NIS/percent.

## Primary sources used

| ID | Source |
|---|---|
| **1301-2024** | רשות המסים, טופס 1301 לשנת המס 2024 (מעודכן 2.2025). I downloaded the PDF and extracted it with `pdftotext -layout`; the interest fields are on p. 2 part ה (items 13-23) and the withholding field on p. 4 item 82. <https://www.gov.il/BlobFolder/service/reporting-and-payment-2024-annual-tax-report-for-individuals/he/Service_Pages_Income_tax_annual-report-2024_1301-2024.pdf> |
| **1301-2025** | רשות המסים, טופס 1301 לשנת המס 2025 (מעודכן 1.2026) — same interest field codes verified by extraction (078/126/142/157/043 identical to 2024). <https://www.gov.il/BlobFolder/service/reporting-and-payment-2025-annual-tax-report-for-individuals/he/Service_Pages_Income_tax_annual-report-2026_itc1301-2025.pdf> |
| **da-2024** | רשות המסים, דע זכויותיך וחובותיך — מדריך למילוי דוח יחיד לשנת 2024 (interest items 21-23, withholding items 82-83). <https://www.gov.il/BlobFolder/generalpage/income-tax-guide-knowyourright/he/Guides_IncomeTax_da-2024.pdf> |
| **hilan-ז** | חילן — reproduction of פקודת מס הכנסה חלק ז' (שיעורי המס), incl. §125ב, §125ג. Secondary (licensed payroll/CPA firm) but reproduces the statute verbatim. <https://www.hilan.co.il/מרכז-ידע/חקיקה/דיני-מיסים/פקודת-מס-הכנסה-נוסח-חדש-תשכא-1961/חלק-ז-שיעורי-המס/> |
| **nikuy-2005** | תקנות מס הכנסה (ניכוי מריבית, מדיבידנד ומרווחים מסוימים), תשס"ו-2005 (withholding-at-source regulations, 15%/25%). <https://www.nevo.co.il/law_html/law01/999_549.htm> |
| **hozer-10-2025** | רשות המסים, חוזר מס הכנסה 10/2025 — קיזוז הפסדי הון (27 Nov 2025); §92(א)(4) offset targets. <https://www.gov.il/BlobFolder/policy/professional-directives-271125-1/he/IncomeTax_professional-directives-271125-1.pdf> |
| discount / mercantile / bshcpa / kolzchut | Bank + CPA + kolzchut, secondary corroboration of rates and the marginal-rate cap, cited inline |

> **Source-quality caveat for the owner.** The two *rates* (15% / 25%) and the
> *cap phrasing* are printed verbatim on the official gov.il **Form 1301**
> (a primary source I extracted myself) — "מס בשיעור של 15%" for deposits and
> "מס בשיעור שלא יעלה על 25%" — and cross-linked on the form to §§125ד,ה. The
> **statutory subsection lettering** (§125ג(ב)/(ג)/(ד)) is taken from hilan's
> reproduction + web-search of the ordinance text, not from a gov.il statute
> PDF I parsed line-by-line. Treat the subsection letters as HIGH-confidence
> secondary; treat the numeric rates and the Form 1301 codes as CONFIRMED
> primary. There are no §120ב-indexed amounts here, so the freeze law does not
> touch any figure in this report — the 15%/25% rates are fixed statutory
> percentages, identical in 2024 and 2025.

---

## 1. Rate rules — source-annotated table

| Rule | Rate | When it applies | Governing section | Source | Verdict |
|---|---|---|---|---|---|
| Interest on a **non-index-linked** asset (ריבית על נכס שאינו צמוד למדד, or linked only in part / not linked to maturity) — e.g. a plain-shekel bank deposit or savings plan | **15%** | Individual, not business income, not a substantial shareholder, not from a related party (see row "normal rates" below). Amendment 147 (2006 reform) raised this from the old 10% to 15% | **§125ג(ג)(1)** | hilan-ז; 1301-2024 item 21 ("ריבית על פקדונות ותוכניות חיסכון – מס בשיעור של 15%"); nikuy-2005 (bank withholds 15% on non-linked); discount/mercantile/bshcpa | CONFIRMED (rate primary; subsection secondary) |
| Interest on an **index-linked or foreign-currency-linked** asset — the **real** interest portion | **25%** ("שלא יעלה על 25%") | Same individual conditions. The inflation/linkage differentials on **principal** are exempt (only real interest is taxed) | **§125ג(ב)** | hilan-ז; 1301-2024 item 23 ("...שלא יעלה על 25%"); discount/mercantile ("הפרשי הצמדה... פטורים ממס") | CONFIRMED (rate primary; subsection secondary) |
| Linkage differentials on **principal** of a linked deposit (הפרשי הצמדה על הקרן) | **Exempt** | Individual, deposit not part of a business | §9(13) (owner-verify exact section) | discount, mercantile ("הפרשי ההצמדה... יהיו פטורים ממס") | NEEDS-OWNER-VERIFY (exact exemption section) |
| **Normal marginal rates** instead of the fixed 15%/25% | up to **47%** (min 31% non-personal-exertion for under-60s, §121(ב)) | Interest is business income / recorded in books; **or** taxpayer is a substantial shareholder (בעל מניות מהותי) in the payer; **or** interest paid by a related party/employer; **or** an expense/linkage deduction was claimed on the interest — the §125ג(ד) carve-outs | **§125ג(ד)** | hilan-ז ("(ד) יחולו שיעורים רגילים אם..."); bshcpa | CONFIRMED (secondary) — out of engine scope |
| **Dividend** (for contrast; already handled at 25% by the engine's interest+dividend bucket) | **25%** (30% substantial shareholder) | Individual | **§125ב(1)/(2)** | hilan-ז; 1301-2024 item 17 (field 141) | CONFIRMED |

Legislative anchor for both fixed rates: **"על אף האמור בסעיפים 121 ו-126"** —
§125ג overrides the ordinary §121 bracket table, which is exactly why interest
gets a flat rate instead of feeding the salary brackets.

## 2. The marginal-rate cap ("לא יעלה על")

The 25% (and, per the statute, the 15%) are worded as ceilings — the tax
**"שלא יעלה על"** that percentage — and the interest is deemed the **top slice**
of the individual's income (§125ג(ב): the interest is "השלב הגבוה ביותר בסולם
הכנסתו החייבת"). Net effect: interest is taxed at the **lower of** the fixed
rate and the taxpayer's actual marginal rate on that top slice.

| Point | Detail | Source | Verdict |
|---|---|---|---|
| Cap direction | Tax = min(fixed rate, marginal rate on interest as top income slice) | bshcpa ("taxed at whichever is lower"); form wording "שלא יעלה על" | CONFIRMED |
| Who is capped **below** 15%/25% in practice | Only where the marginal rate is lower than the fixed rate. For a person **under 60**, non-personal-exertion income carries a **minimum 31%** bracket (§121(ב)) — so the 15%/25% cap **always binds** and they pay the flat rate. Someone **60+** (or with no other income) can drop into the 10%/14%… brackets and pay **less** than 15% | bshcpa ("Exception for age 60+"); §121(ב) | CONFIRMED (relevant only for 60+ / low-income) |
| 15% line wording nuance | Form 1301 prints the **deposit 15% line (item 21) as "מס בשיעור של 15%"** (fixed), but the 20%/25% deposit lines (items 22/23) as **"שלא יעלה על"**. Whether §125ג(ג) 15% is itself a "לא יעלה על" cap or a flat rate matters only for a 60+/low-income taxpayer | 1301-2024 items 21-23 | NEEDS-OWNER-VERIFY (edge case only) |

**Engine implication:** for the owner (salaried, presumed under 60, with
income above the 31% non-personal band), the cap always binds → a flat 15% or
25% is correct. A `min(fixedRate, marginalRate)` refinement is only needed if
we ever model a 60+/low-income taxpayer; note it and defer.

## 3. How this differs from the securities capital-gains path (no double-handling)

The engine's `computeCapitalGains` (`modules/capital-gains.ts`) already carries
an `interestDividendAgorot` field **per broker (Form 867)** and taxes it at the
same `realGainRateBp = 25%`. That bucket is **securities** interest+dividend —
the Form 1301 **item 15 (field 157, ≤25%)** and **item 17 (field 141, dividend
25%)** path — and it doubles as a §92(א)(4) loss-offset target. A 15%
non-linked-interest branch is a **different bucket** and must not be merged into
it, for four reasons:

| Dimension | Engine's existing `interestDividendAgorot` (securities) | New 15% non-linked interest (deposits/savings) |
|---|---|---|
| Instrument | Interest+dividend from **ניירות ערך** / קופות גמל (Form 867) | Interest from **פקדונות ותוכניות חיסכון** — a non-linked asset, not a security |
| Rate | 25% (§125ב / §125ג(ב), ≤25% cap) | **15%** (§125ג(ג)) |
| Form 1301 income field | **157** (interest ≤25%) / **141** (dividend 25%) | **078** (deposit interest 15%) — separate line, part ה item 21 |
| Withholding field | **040** (securities withholding, Form 867) | **043** (ניכוי במקור מריבית, deposits — items 21-23) |
| §92 loss offset | **Yes** — current-year securities losses may net against it where the applicable rate ≤ 25% (§92(א)(4), hozer-10-2025 §3.3) | **Likely NO** — §92(א)(4) reaches interest/dividend *from securities*; a bank-deposit is not a נייר ערך. See flag below |

> **NEEDS-OWNER-VERIFY (offset eligibility).** Whether a current-year capital
> **loss** may offset 15% non-linked deposit interest turns on whether that
> interest is "ריבית... בשל ניירות ערך" under §92(א)(4). hozer-10-2025 frames the
> §92(א)(4) target as securities interest/dividend at rate ≤25%; a plain bank
> deposit is not a security, which points to **not** offsettable. If so, the new
> bucket must be excluded from the loss-offset waterfall. Do not wire it into
> `offsetVsInterestDividend` without confirming this — getting it wrong would
> silently over-absorb the owner's losses.

**Bottom line:** the securities path (Form 867 → fields 157/141/040, 25%,
offsettable) stays exactly as-is; the 15% branch is additive and independent.

## 4. Form 1301 & Form 867 field codes (verified against both year forms)

All codes below appear on **both** the 2024 and 2025 Form 1301 (I extracted
both PDFs; codes identical). Registered-spouse code first; the app is
single-user so those are the ones any future engine mapping would use. Part ה
= "הכנסות מריבית, מדיבידנד, השתכרות או רווח" (income lines); part טו =
withholding.

| Form 1301 line | Description | Rate | Field (registered / spouse-a / spouse-b) | Source |
|---|---|---|---|---|
| Item 21 | ריבית על פקדונות ותוכניות חיסכון — **מס בשיעור של 15%** (לפני פטורים מסעיפים 125ד,ה) | 15% | **078** / 217 / 317 | 1301-2024 & 1301-2025 p. 2 |
| Item 22 | ריבית על פקדונות ותוכניות חיסכון — שלא יעלה על 20% | 20% (legacy/transitional) | **126** / 226 / 326 | ״ |
| Item 23 | ריבית על פקדונות ותוכניות חיסכון — שלא יעלה על 25% | 25% | **142** / 242 / 342 | ״ |
| Item 15 | ריבית על ניירות ערך, ריבית מקופות גמל — שלא יעלה על 25% (**securities** interest — engine's existing bucket) | 25% | **157** / 257 / 357 | ״ |
| Item 13 | ריבית/רווחים מקופות גמל ודיבידנד ממפעל מאושר/מוטב — 15% | 15% | **060** / 211 / 311 | ״ |
| Item 82 | **ניכוי במקור מריבית** (from items 21, 22, 23 — deposits) | — | **043** | 1301-2024 & 1301-2025 p. 4; da-2024 item 82 |

Field **043** is the deposit-interest withholding code — distinct from **040**
(securities/Form-867 withholding), consistent with the note already in the
engine's `calculate.ts` comment and the form1301 codes report
(`docs/superpowers/research/2026-07-12-form1301-codes-verification.md` §3).

**Form 867** (broker annual): the 15%-taxed non-linked interest and its
withholding are reported by banks/brokers on the 867 in dedicated
non-linked-interest lines, feeding Form 1301 items 21/82 (fields 078/043). The
engine's Form-867 mapping today only consumes the securities gain/loss/
interest-dividend/withholding aggregates (→ `BrokerEntryInput`); a 15% branch
would add a new non-linked-interest aggregate + its 043 withholding. Exact 867
box numbers vary by issuer template and were **not** verified here —
NEEDS-OWNER-VERIFY if the extraction schema needs specific 867 boxes.

## 5. Surtax (מס יסף) interaction

15% non-linked interest is **capital-source income** for the §121ב surtax, so in
**2025** it is part of the base for the extra **2%** capital add-on above the
721,560 ₪ threshold (total 5% on the part above the threshold), and in both
years part of the base 3%. This mirrors how the engine already treats
`capitalTaxable` in `computeSurtax`. Source: booklet-2025 / surtax rows in
`docs/superpowers/research/2026-07-05-tax-constants-verification.md` §1.3.
Verdict: CONFIRMED — a 15% branch must flow into `capitalTaxableAgorot`.

---

## 6. Proposed engine shape (design only — no code written)

A 15%-interest branch slots into the **capital-income** side of `calculate.ts`,
parallel to `computeCapitalGains`, NOT inside it:

1. **Year data** (`IlYearData.capitalGains`, both year files): add
   `nonLinkedInterestRateBp: 1_500` next to `realGainRateBp: 2_500`, with a
   `// source: §125ג(ג); Form 1301 item 21 field 078; 15% in 2024 & 2025
   (no §120ב indexation, freeze-law-irrelevant)` comment. Keep 2500 unchanged.

2. **Input** (`core/types.ts`): a new bucket, kept **out** of `BrokerEntryInput`
   to avoid double-handling —
   ```
   nonLinkedInterest?: {
     amountAgorot: Agorot;        // 15% deposit/savings interest (Form 1301 field 078)
     taxWithheldAgorot: Agorot;   // deposit-interest withholding (field 043)
   }
   ```
   Rationale: different rate, different 1301/867 fields, and (pending
   owner-verify) different §92 offset eligibility from the securities bucket.

3. **Computation**: `tax = percentBp(amount, nonLinkedInterestRateBp)`. Do
   **not** route capital losses against it in v1 (see §3 offset flag) — treat
   it as its own taxable line. If owner later confirms non-offsettability, this
   is the correct final behaviour; if offsettable, add it as a lower-priority
   offset target after the 25% securities interest/dividend.
   *(Optional, 60+/low-income only, defer:* cap at
   `min(15%, marginalRateOnTopSlice)` per §125ג(ב) — not needed for the
   under-60 owner.)*

4. **Wire-up in `calculate.ts`**:
   - add its tax into `totalLiability`;
   - add its withholding into `totalWithheld`;
   - add its amount into `capitalTaxable` so **surtax** (base 3% + 2025 2%
     capital add-on) picks it up — §5;
   - it does **not** enter the salary bracket table (§125ג overrides §121).

5. **Form 1301 map** (`form1301Fields`): add `'078'` = interest amount and
   `'043'` = its withholding. These are real official codes (verified §4), so
   they belong as numeric keys, not named worksheet keys.

6. **Tests**: a return with only 15% non-linked interest (flat 15%, no bracket,
   no offset), one combining it with Form-867 securities (assert the two
   buckets stay separate and losses do NOT touch the deposit interest), and one
   crossing the surtax threshold in 2025 (assert the 2% capital add-on includes
   it).

This is additive: `computeCapitalGains`, the securities 25% path, the
loss-offset waterfall, and every existing test stay untouched.

---

## 7. Verdict summary

- **CONFIRMED (primary / official):** 15% rate on non-linked interest and 25% on
  linked/real interest; Form 1301 field codes 078 (15% deposit interest), 142
  (25% deposit interest), 157 (securities interest ≤25%), 043 (deposit
  withholding) vs 040 (securities withholding) — verified on both the 2024 and
  2025 official forms; the §125ג override of §121 (flat rate, not brackets); the
  "לא יעלה על" marginal-rate cap direction (lower of fixed and marginal); surtax
  treats it as capital-source income (2% 2025 add-on applies).
- **CONFIRMED (secondary):** subsection lettering §125ג(ב)/(ג)(1)/(ד) and the
  §125ג(ד) normal-rate carve-outs (business/substantial-shareholder/related-
  party) — from hilan's statute reproduction + search, not a parsed gov.il
  statute PDF.
- **NEEDS-OWNER-VERIFY:** (a) whether a current-year capital **loss** may offset
  15% non-linked deposit interest under §92(א)(4) — the design defaults to
  **no** (deposit ≠ security); (b) exact section for the הפרשי-הצמדה principal
  exemption (§9(13) assumed); (c) whether §125ג(ג) 15% is a flat rate or a
  "לא יעלה על" cap (matters only for a 60+/low-income taxpayer); (d) specific
  Form 867 box numbers for the non-linked-interest aggregate if the extraction
  schema needs them.
- **No freeze-law impact:** all figures here are fixed statutory percentages,
  identical 2024 and 2025.
</content>
</invoke>
