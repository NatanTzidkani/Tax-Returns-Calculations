# Form 1301 field-code verification — engine `form1301Fields` map, tax years 2024 & 2025

Date: 2026-07-12 · Author: tax-law-analyst agent · Status: research report (no code changed)

Scope: every key the engine emits in `form1301Fields`
(`packages/tax-engine/src/calculate.ts`, lines 104-114) — three numeric codes
(`158`, `042`, `045`) and six named keys awaiting codes (`donationsEligible`,
`capitalTaxableGain`, `capitalTax`, `surtax`, `totalLiability`, `refund`) —
verified against the official Form 1301 (דין וחשבון על ההכנסות בארץ ובחו"ל,
טופס 1301) for 2024 and 2025 and the Tax Authority's official filling guide.

Engine stores integer **agorot** (₪ × 100); the printed 1301 is filled in
whole shekels — the filing view must divide by 100 (and the Tax Authority's
online system rounds to whole ₪).

## Primary sources used

| ID | Source |
|---|---|
| **1301-2024** | רשות המסים, טופס 1301 לשנת המס 2024 (מעודכן ל-2.2025) — <https://www.gov.il/BlobFolder/service/reporting-and-payment-2024-annual-tax-report-for-individuals/he/Service_Pages_Income_tax_annual-report-2024_1301-2024.pdf> |
| **1301-2025** | רשות המסים, טופס 1301 לשנת המס 2025 (מעודכן ל-1.2026) — <https://www.gov.il/BlobFolder/service/reporting-and-payment-2025-annual-tax-report-for-individuals/he/Service_Pages_Income_tax_annual-report-2026_itc1301-2025.pdf> |
| **da-2024** | רשות המסים, דע זכויותיך וחובותיך — מדריך למילוי טופס דין וחשבון של יחיד על ההכנסה של שנת 2024 — <https://www.gov.il/BlobFolder/generalpage/income-tax-guide-knowyourright/he/Guides_IncomeTax_da-2024.pdf> |
| kolzchut | Secondary corroboration, cited inline |

Both form years carry **identical field codes** for everything the engine
touches (the 2025 form renumbers some section items — e.g. donations move from
item 75 to item 78 — but the 3-digit field codes are unchanged; the 2025 form
adds one new field, 100 — זיכוי מס חברות לפי סעיף 62א(ג)(2)(5) — irrelevant to
the engine). The freeze law affects amounts, not field codes; no code changed
between the two years.

Layout convention verified on both forms: paired fields are
**"בן הזוג הרשום" (registered spouse) / בן·בת הזוג (other spouse)**. The app is
single-user (the owner is the registered spouse), so the engine's use of the
registered-spouse codes is correct; the spouse-column codes are listed below
for future multi-person support.

---

## Corrections needed — summary

**The three numeric codes already emitted (`158`, `042`, `045`) are all
CONFIRMED** — correct code, correct semantics, single-user (registered-spouse)
column. Required changes are all about the six named keys:

1. **`donationsEligible` must NOT become field 037 as-is.** Official field
   037 (registered spouse; spouse 237) takes **the amount donated in the tax
   year** ("יש לרשום בסעיף זה (בשדה 237/037) את סכום התרומות שנתרמו בשנת
   המס") — the assessing system applies the 35% rate and the ceilings itself
   ("המחשב יחשב את הזיכוי המגיע בהתאם לרשום בשדות אלה", da-2024 p. 68). The
   correct engine value for 037 is `charity.totalDonationsAgorot` (Israeli
   institutions only), not the post-ceiling `eligibleAgorot`. Prior-year
   over-ceiling donations being re-claimed go in field **364** (spouse 292).
2. **`capitalTaxableGain` and `capitalTax` have no field on the main 1301.**
   Securities gains are reported on נספח ג (טופס 1322, aided by נספח ג1 טופס
   1325 / נספח ג2 טופס 1326); the main form takes only: **054** = number of
   capital-gain/shevach forms attached, **056** = total sale proceeds from
   capital gains & shevach *excluding* traded securities, **256** = total sale
   proceeds (מחזור מכירות) from traded securities as summed in נספח ג. Mapping
   the engine's taxable-gain or tax amounts to any of these would be wrong —
   they are proceeds/count fields.
3. **Securities withholding belongs in field 040.** Per da-2024 (item 83):
   "בסעיף זה יש לכלול ניכויים במקור שנוכו מרווחי הון, לרבות במכירת ניירות ערך
   סחירים" — the engine currently emits `capitalGains.withheldAgorot` only
   into `totalWithheldAgorot`, with no 1301 key. Recommend adding `'040'`.
   (Field 043 is withholding on **deposit/savings-plan interest** only — do
   not use it for Form 867 securities withholding.)
4. **`surtax`, `totalLiability`, `refund` have no 1301 input fields at all** —
   the Tax Authority computes surtax (§121ב) and the final liability/refund in
   assessment; the form only carries a surtax-threshold checkbox (part א) and
   the refund bank-account details (fields 277/278, not amounts). These three
   keys should stay named engine outputs (worksheet display), outside any
   official-code mapping.

---

## 1. Verification table — codes the engine emits

| Engine key | Engine value mapped | Official 1301 code & Hebrew name | Verified semantics | Source | Verdict |
|---|---|---|---|---|---|
| `'158'` | `workIncome` = Σ gross salaries | **158** — ממשכורת/משכר עבודה (הכנסת עבודה לרבות תקבולים מביטוח לאומי כשכיר, לא כולל מעבודה במשמרות בתעשייה), part ג item 3, registered spouse; spouse = 172 | Salary/wage income per Form 106, incl. NI receipts as employee included in the 106; shift-work-in-industry pay is excluded (own fields 068/069 — engine has no shift-work input, acceptable for now) | 1301-2024 p. 2; 1301-2025 p. 2; da-2024 סעיף 3 ("רשום כאן בשדה 172/158 הכנסה ממשכורת או משכר עבודה... הכוללים בטופס 106") | ✓ CONFIRMED |
| `'042'` | Σ salary `taxWithheldAgorot` | **042** — מס הכנסה שנוכה במקור ממשכורת, משכר עבודה ומקצבאות (מצ"ב טופסי 106), part טו (item 81 on 2024 form / item 84 on 2025 form); single total field, no spouse split | Income tax withheld at source from salary/wages/pensions per Form 106 (also taxable severance withholding per טופס 161). Salary-only sum is correct — securities withholding goes to 040, deposit interest to 043 | 1301-2024 p. 4; 1301-2025 p. 4; da-2024 סעיף 81 | ✓ CONFIRMED |
| `'045'` | `pensionContributions` = Σ employee pension contributions | **045** — לקצבה כ"עמית שכיר", part יד זיכויים אישיים (item 72 on 2024 form / item 75 on 2025 form), registered spouse; spouse = 086 | Field takes the **full amount paid** to a pension fund as employee member ("רשום בסעיפים אלו את מלוא הסכום ששולם לקופת גמל כעמית שכיר"); the system computes the §45א credit with the 7%/₪-cap rules. Engine correctly emits contributions, not the computed credit | 1301-2024 p. 4; 1301-2025 p. 4; da-2024 סעיפים 72-73 | ✓ CONFIRMED |

## 2. Named keys — official mapping for the Plan 5 filing view

| Engine key | Engine value | Official destination | Source | Verdict |
|---|---|---|---|---|
| `donationsEligible` | `charity.eligibleAgorot` (post-ceiling) | **037** — תרומות למוסדות ציבור או לקרן לאומית: תרומות בשנת המס למוסדות בישראל בלבד (spouse 237). **Must be fed `charity.totalDonationsAgorot`, not `eligibleAgorot`** — 037 takes the amount donated in-year; the ATA applies §46 rate/ceilings. US-institution donations = 046/048 (out of engine scope); prior-3-years over-ceiling re-claims = **364** (spouse 292) ↔ engine's `charity.carryforwardOutAgorot` feeds next year's 364 | 1301-2024 p. 4 item 75; 1301-2025 p. 4 item 78; da-2024 p. 68; kolzchut corroborates 037 as the donation-credit code (Form 116 uses the same code) <https://www.kolzchut.org.il/he/זיכוי_ממס_הכנסה_בשל_תרומה_(סעיף_46)> | ✗ CORRECTED — code is 037 but the semantically correct amount is total in-year donations, not the eligible-after-ceiling figure |
| `capitalTaxableGain` | `capitalGains.taxableGainAgorot` | **No main-form field.** Gains are itemised on נספח ג (טופס 1322; helper נספחים ג1=1325, ג2=1326). Main form part ח takes only 054 (count of רווח-הון/שבח forms attached), 056 (sale proceeds excl. traded securities), **256** (sale proceeds of traded securities per נספח ג) — all proceeds/counts, not gains | 1301-2024 p. 3 items 35-37; 1301-2025 p. 3 items 37-38; da-2024 חלק ח (pp. 40-41: "ריכוז רווחי ההון מניירות ערך סחירים ייעשה על גבי טופס 1322") | ? NO 1301 CODE — belongs in נספח ג/1322; keep as named worksheet output. Loss carry-forward out maps to main-form **166** (הפסדי הון שלא קוזזו, ללא חו"ל), part יא item 45ג |
| `capitalTax` | `capitalGains.taxAgorot` | **No main-form field** — tax on securities gains is computed within נספח ג / by assessment | da-2024 חלק ח | ? NO 1301 CODE — worksheet output only |
| *(not emitted)* | `capitalGains.withheldAgorot` | **040** — סה"כ הסכומים שנוכו במקור (ללא מקדמות וללא מס ששולם בחו"ל) מהכנסות אחרות הכלולות בדוח זה, part טו (item 83 / 2025 item 87). Guide: explicitly includes withholding on capital gains "לרבות במכירת ניירות ערך סחירים"; excludes deposit/savings interest (→ 043) | 1301-2024 p. 4; da-2024 סעיף 83 | RECOMMENDED ADDITION `'040'` |
| `surtax` | `surtax.totalAgorot` | **No 1301 field** — §121ב surtax is computed in assessment; part א only has a checkbox that income exceeded the §121ב(ה) threshold (721,560 ₪ printed on both year forms) | 1301-2024 p. 1; 1301-2025 p. 1 | ✓ CONFIRMED as code-less named output |
| `totalLiability` | `totalLiability` | **No 1301 field** — liability/balance is computed by the ATA ("הפרטים... לחישוב יתרת המס (חובה או זכות)", da-2024 חלק טו intro) | da-2024 p. 67 | ✓ CONFIRMED as code-less named output |
| `refund` | `refund` | **No 1301 amount field** — the form takes only the refund bank account (fields 277 סמל בנק/סניף, 278 מספר חשבון, name) | 1301-2024 p. 1; 1301-2025 p. 1 | ✓ CONFIRMED as code-less named output |

## 3. Adjacent findings (informational, no engine change implied)

- **Interest/dividend from securities** (engine's
  `capitalGains.taxableInterestDividendAgorot`, not in `form1301Fields`): the
  1301 splits these — interest on securities at ≤25% = field **157**
  (registered spouse 257 / spouse 357, part ה item 15), dividends at 25% =
  field **141** (241/341, item 17). The engine lumps interest+dividend into
  one number, so it cannot fill 157/141 today; if the filing view ever needs
  them, Form 867 provides the split (source: 1301-2024 p. 2; 1301-2025 p. 2).
- **Field 043** (ניכוי במקור מריבית, deposits/savings plans per Form 867) is
  out of engine scope (15% non-linked-interest cases deferred per Plan 2).
- **NI receipts as employee not included in Form 106** (מילואים, דמי אבטלה
  etc. paid directly by btl) have their own field **194** (spouse 196) — the
  engine folds everything into salary 158, which is correct only for amounts
  already inside the Form 106 (da-2024 סעיף 2ב). Worth a note in the filing
  view if the owner ever has direct btl receipts.
- The Tax Authority did not publish a standalone 2025 edition of דע זכויותיך
  at verification time on the same URL pattern; the 2025 form PDF itself
  (1301-2025) confirms every code above for 2025.

## 4. Verdict summary

- ✓ CONFIRMED: `'158'`, `'042'`, `'045'` — code, Hebrew name, and mapped
  amount all correct on both 2024 and 2025 forms; `surtax`, `totalLiability`,
  `refund` correctly have no official code (assessment-computed).
- ✗ CORRECTED: `donationsEligible` → official code **037**, but it must carry
  `charity.totalDonationsAgorot` (in-year donations to Israeli institutions),
  not the post-ceiling eligible amount; carry-forward re-claims → **364**.
- ? NO 1301 CODE (not "unverifiable" — verified absent): `capitalTaxableGain`,
  `capitalTax` — these live in נספח ג (טופס 1322), with only proceeds/count
  fields (054/056/256) on the main form.
- Recommended additions for Plan 5: emit `'040'` = securities withholding
  (Form 867), and map `lossCarryforwardOutAgorot` → field **166**; keep the
  comment in `calculate.ts` but update it to cite this report.
