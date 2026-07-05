# Tax-constants verification — IL 2024 & 2025 year data

Date: 2026-07-05 · Author: tax-law-analyst agent · Status: research report (no code changed)

Scope: every constant in
`packages/tax-engine/src/jurisdictions/il/years/2024.ts` and `2025.ts`,
plus research on the credit-point tables left open in Plan 2
(children, academic degree, oleh hadash).

Engine values are stored in integer **agorot** (₪ × 100); tables below show NIS.

## Primary sources used

| ID | Source |
|---|---|
| **booklet-2025** | Israel Tax Authority, לוח עזר לחישוב מס הכנסה ממשכורת ושכר עבודה, January 2025 — <https://www.gov.il/BlobFolder/generalpage/income-tax-monthly-deductions-booklet/he/generalInformation_income-tax-monthly-deductions-booklet_monthly-deductions-booklet-2025.pdf> |
| **booklet-2024** | Same series, January 2024 — <https://www.gov.il/BlobFolder/generalpage/income-tax-monthly-deductions-booklet/he/generalInformation_income-tax-monthly-deductions-booklet_monthly-deductions-booklet-2024.pdf> |
| **btl-651-2025** | המוסד לביטוח לאומי, בל/651 אגרת למעסיק החל מחודש פברואר 2025 (01.2025) — <https://www.btl.gov.il/Insurance/HozrimBituah/Hozrim/%D7%90%D7%99%D7%92%D7%A8%D7%AA%20%D7%9C%D7%9E%D7%A2%D7%A1%D7%99%D7%A7%20%D7%94%D7%97%D7%9C%20%D7%9E%D7%97%D7%95%D7%93%D7%A9%20%D7%A4%D7%91%D7%A8%D7%95%D7%90%D7%A8%202025.pdf> |
| **btl-1511-2024** | המוסד לביטוח לאומי, חוזר מעסיקים 1511 (01/01/2024), "שינוי בתשלום דמי ביטוח לאומי ודמי ביטוח בריאות לשנת 2024" — <https://www.btl.gov.il/Insurance/HozrimBituah/Hozrim/%D7%A9%D7%99%D7%A0%D7%95%D7%99%20%D7%91%D7%AA%D7%A9%D7%9C%D7%95%D7%9D%20%D7%93%D7%9E%D7%99%20%D7%91%D7%99%D7%98%D7%95%D7%97%20%D7%9C%D7%90%D7%95%D7%9E%D7%99%20%D7%95%D7%93%D7%9E%D7%99%20%D7%91%D7%99%D7%98%D7%95%D7%97%20%D7%91%D7%A8%D7%99%D7%90%D7%95%D7%AA%20%D7%9C%D7%A9%D7%A0%D7%AA%202024.pdf> |
| **hozer-10-2025** | רשות המסים, חוזר מס הכנסה 10/2025 — קיזוז הפסדי הון (27 Nov 2025) — <https://www.gov.il/BlobFolder/policy/professional-directives-271125-1/he/IncomeTax_professional-directives-271125-1.pdf> |
| kolzchut | Secondary corroboration, individual pages cited inline |

Freeze law context (both booklets state it): חוק ההתייעלות הכלכלית (תיקוני
חקיקה להשגת יעדי התקציב לשנת התקציב 2025) (הקפאת עדכוני מס ומס יסף),
התשפ"ה-2024, published ס"ח 3342, 26 Dec 2024 — §120ב-indexed amounts are NOT
adjusted on 1 Jan of 2025-2027, i.e. 2025 amounts = 2024 amounts. Verified in
practice: booklet-2024 and booklet-2025 print identical bracket / credit-point
/ surtax / charity / pension-ceiling figures.

---

## Corrections required

**None. Every engine constant in both year files is CONFIRMED against an
official source.** The two `TODO(owner-verify)` NI ceilings are confirmed
exactly (49,030 ₪/mo for 2024; 50,695 ₪/mo for 2025 — the "interpolation" in
the 2025 file happens to equal the official figure and can be re-annotated as
verified).

Two **comment-level notes** (no value changes):

1. `2025.ts` NI comment says health full rate went "5.00% → 5.17% from
   1 Feb 2025". Per btl-651-2025 the actual sequence is 5.00% (2024) → **5.16%
   (Jan 2025)** → **5.17% (from Feb 2025)**. The engine's 5.17% full-year
   approximation therefore overstates January 2025 by 0.01pp — acceptable for
   the informational-only NI module, but the comment should mention the 5.16%
   January step.
2. `2025.ts` NI ceiling TODO can be closed: 50,695 ₪/mo is the official 2025
   figure (btl-651-2025), not an interpolation. (btl's current rates page and
   kolzchut now show 51,910 ₪/mo — that is the **2026** value, effective
   01.01.2026, and must not leak into 2025 data.)

---

## 1. Verification tables

### 1.1 Income-tax brackets (יגיעה אישית, annual)

Source: booklet-2024 פרק ב and booklet-2025 פרק ב (identical tables:
monthly 7,010 / 10,060 / 16,150 / 22,440 / 46,690; annual as below).
Engine models the personal-exertion (יגיעה אישית) table — correct for salary
income; note the booklet's separate non-personal table starts at 31%.

| Constant | Engine (NIS/yr) | Verified 2024 | Verified 2025 | Source | Verdict |
|---|---|---|---|---|---|
| Bracket 1 top, 10% | 84,120 | 84,120 (10%) | 84,120 (10%) | booklet-2024 p.8; booklet-2025 p.8 | CONFIRMED |
| Bracket 2 top, 14% | 120,720 | 120,720 (14%) | 120,720 (14%) | ״ | CONFIRMED |
| Bracket 3 top, 20% | 193,800 | 193,800 (20%) | 193,800 (20%) | ״ | CONFIRMED |
| Bracket 4 top, 31% | 269,280 | 269,280 (31%) | 269,280 (31%) | ״ | CONFIRMED |
| Bracket 5 top, 35% | 560,280 | 560,280 (35%) | 560,280 (35%) | ״ | CONFIRMED |
| Marginal rate above | 47% | 47% מכל שקל נוסף | 47% | ״ | CONFIRMED |

WARNING for future edits: current kolzchut/PwC pages already show **2026**
brackets (e.g. 20% bracket up to 228,000 ₪) — 2026 amounts resume indexation
per the freeze law's own terms and are NOT valid for 2024/2025.

### 1.2 Credit point value (נקודת זיכוי §33א)

| Constant | Engine | Verified | Source | Verdict |
|---|---|---|---|---|
| Credit point value | 2,904 ₪/yr (290,400 agorot) = 242 ₪/mo × 12 | 242 ₪/חודש (both years) | booklet-2024 פרק ג §א; booklet-2025 פרק ג §א | CONFIRMED |

### 1.3 Surtax (מס יסף §121ב)

| Constant | Engine | Verified | Source | Verdict |
|---|---|---|---|---|
| Threshold | 721,560 ₪/yr (72,156,000 agorot) | 721,560 ₪ (60,130 ₪/mo), both years | booklet-2024 p.9; booklet-2025 p.9 | CONFIRMED |
| Base rate | 3% (300bp) | 3% on the part of taxable income above the threshold | ״ | CONFIRMED |
| 2024 capital add-on | 0% | Law published 26 Dec 2024; the extra 2% is listed by booklet-2025 among "עדכונים ושינויים ליישום בשנת המס **2025**" — no capital add-on in 2024 | booklet-2025 פרק א §3 | CONFIRMED |
| 2025 capital add-on | 2% (200bp) on taxable income from capital sources above the same threshold (total 5% on that part) | "יחיד יהיה חייב במס נוסף 'חדש' בשיעור של 2%, על הכנסה חייבת ממקורות הוניים העולה על הסכום הקבוע בסעיף" | booklet-2025 פרק א §3 and פרק ב p.9 | CONFIRMED |

### 1.4 Charity credit (§46)

| Constant | Engine | Verified | Source | Verdict |
|---|---|---|---|---|
| Credit rate (individual) | 35% (3,500bp) | 35% of eligible donations | פקודת מס הכנסה §46(א); kolzchut "זיכוי ממס הכנסה בשל תרומה (סעיף 46)" <https://www.kolzchut.org.il/he/זיכוי_ממס_הכנסה_בשל_תרומה_(סעיף_46)> | CONFIRMED |
| Minimum total donations | 207 ₪/yr (20,700 agorot) | 207 ₪ in 2024 and 2025 (2023: 200 ₪) | booklet-2024 פרק ג §ג; booklet-2025 פרק ג §ג; kolzchut ibid. | CONFIRMED |
| Absolute ceiling | 10,354,816 ₪/yr (1,035,481,600 agorot) | 10,354,816 ₪ in 2024 and 2025 (frozen) | ״ | CONFIRMED |
| Income-share ceiling | 30% of taxable income (3,000bp), lower of the two | 30% מההכנסה החייבת — whichever is lower | §46(א); kolzchut ibid. | CONFIRMED |
| 3-year carry-forward | (engine feature) | Excess above the ceilings may be carried to the **3 following tax years**, subject to each year's ceilings | kolzchut ibid. ("להעביר את סכום התרומה שעולה על שיעורי התקרה ל-3 שנות המס הבאות") | CONFIRMED |

### 1.5 Pension credit (§45א)

| Constant | Engine | Verified | Source | Verdict |
|---|---|---|---|---|
| Credit rate | 35% (3,500bp) | 35% of employee pension contributions | kolzchut "זיכוי ממס הכנסה בגין הפרשות לביטוח פנסיוני" <https://www.kolzchut.org.il/he/זיכוי_ממס_הכנסה_בגין_הפרשות_לביטוח_פנסיוני> (cites §45א) | CONFIRMED |
| Contribution cap share | 7% (700bp) of qualifying income | contributions credited up to 7% of salary and no more than 8,148 ₪/yr (2024 & 2025) — and 8,148 = 7% × 116,400, cross-checks the two engine parameters exactly | kolzchut ibid. | CONFIRMED |
| Qualifying-income ceiling | 116,400 ₪/yr (11,640,000 agorot) | תקרת הכנסה מזכה §47(א)(1)(1), מהכנסת עבודה: 9,700 ₪/חודש (both years) | booklet-2024 פרק ג §ב; booklet-2025 פרק ג §ב "קופות גמל" | CONFIRMED |

Scope note (unchanged from Plan 2): the engine models the plain §45א employee
case. עמית מוטב variants (§45א(ה), §47 deduction interplay, 45א(ד) insurance
189 ₪/mo cap) are out of scope until a §47 plan; booklet-2025 פרק ג lists
those separate ceilings.

### 1.6 Capital gains (§91) and loss offset (§92)

| Item | Engine | Verified | Source | Verdict |
|---|---|---|---|---|
| Real gain rate, individual | 25% (2,500bp) | §91(ב)(1): individual real capital gain taxed at up to 25% (substantial shareholder ≥10%: 30% — engine explicitly excludes this case) | פקודת מס הכנסה §91(ב) (text: <https://www.hilan.co.il/מרכז-ידע/חקיקה/דיני-מיסים/פקודת-מס-הכנסה-נוסח-חדש-תשכא-1961/חלק-ה-רווחי-הון/>); Form 1325 appendix for individuals, gov.il <https://www.gov.il/BlobFolder/service/reporting-and-payment-2025-annual-tax-report-for-individuals/he/Service_Pages_Income_tax_annual-report-2026_1325-2025.pdf> | CONFIRMED |
| Current-year securities loss vs gains | offset against capital gains | §92(א): capital loss offsets capital gains (nominal-values measurement) | hozer-10-2025 §2-3 | CONFIRMED |
| …then vs same-year securities interest/dividend | offset against interest/dividend paid on the same security, and on other securities where the applicable rate ≤ 25% (§125ב(1)/§125ג(ב)) — same-year only | hozer-10-2025 §3.3.1-3.3.2 (סעיף 92(א)(4)) | CONFIRMED |
| Carry-forward vs GAINS ONLY | carried losses never offset interest/dividend | "הפסד הון מועבר לא יותר בקיזוז כנגד הכנסה מריבית או מדיבידנד כאמור בסעיף 92(א)(4)" | hozer-10-2025 §4.1 | CONFIRMED |

Ordering nuance worth a code comment: per hozer-10-2025 §5 the taxpayer may
choose the offset order among eligible targets in the current year ("בסדר שבו
יחפוץ", e.g. no obligation to burn losses against exempt inflationary amounts
first). The engine's fixed order (gains first, then same-year securities
interest/dividend) is a permitted and generally taxpayer-favourable order, but
is a policy choice, not a legal mandate. Carry-forward requires a filed return
for the loss year (hozer-10-2025 §4.3) — satisfied by our filing flow.

### 1.7 National insurance, employee share (informational module only)

2024 — source: btl-1511-2024 (לוח י' table, "סכומים קובעים" section):

| Constant | Engine | Verified | Verdict |
|---|---|---|---|
| Reduced NI | 0.40% | 0.40% | CONFIRMED |
| Reduced health | 3.10% | 3.10% (reduced total 3.50%) | CONFIRMED |
| Full NI | 7.00% | 7.00% | CONFIRMED |
| Full health | 5.00% | 5.00% (full total 12.00%) | CONFIRMED |
| Reduced-band top | 7,522 ₪/mo (752,200 agorot) | "עד 60% מהשכר הממוצע, ובסכום עד 7,522 ₪ לחודש" (avg wage 12,536 ₪) | CONFIRMED |
| Monthly ceiling (was TODO) | 49,030 ₪/mo (4,903,000 agorot) | "הכנסה מרבית לתשלום דמי ביטוח היא 49,030 ₪ ברוטו לחודש" | CONFIRMED — TODO can be closed |

2025 — source: btl-651-2025:

| Constant | Engine | Verified | Verdict |
|---|---|---|---|
| Reduced NI | 1.04% | 1.04% (הוראת שעה בלוח י' from Jan 2025, through 2026 + possible 2-yr extension) | CONFIRMED |
| Reduced health | 3.23% | 3.23% ("עודכנו מ-3.1% ל-3.23%", reduced employee total 4.27%) | CONFIRMED |
| Full NI | 7.00% | 7.00% (full employee total 12.17%) | CONFIRMED |
| Full health | 5.17% | 5.17% **from Feb 2025**; January 2025 was 5.16% ("עודכנו מ-5.16% ל-5.17% החל מחודש פברואר 2025"). Engine's 5.17% full-year approximation ≈ +0.01pp for one month — fine for informational use; fix the comment | CONFIRMED (comment note) |
| Reduced-band top | 7,522 ₪/mo | "סכום ההכנסה בשיעור המופחת 7,522 ₪" (avg wage for collection frozen at 12,536 ₪ from Jan 2024; booklet-2025 פרק א §5 explains the 12,536/13,316 dual-figure situation) | CONFIRMED |
| Monthly ceiling (was TODO) | 50,695 ₪/mo (5,069,500 agorot) | "סכום ההכנסה המירבית 50,695 ₪" | CONFIRMED — official figure, not an interpolation; TODO can be closed |

2026 look-ahead (do NOT apply to 2024/2025): btl rates page and kolzchut show
7,703 ₪ reduced-band top and 51,910 ₪ ceiling effective 01.01.2026
(<https://www.btl.gov.il/Insurance/Rates/Pages/לעובדים שכירים.aspx>,
<https://www.kolzchut.org.il/he/ההכנסה_המירבית_לתשלום_דמי_ביטוח_לאומי>).

---

## 2. Credit-point rules left open in Plan 2 — researched draft

> **STATUS: NOT IMPLEMENTED.** Research for a future plan. Until then the
> reviewer enters verified totals via `additionalCreditPoints`. All figures
> below are per-year credit **points** (× 2,904 ₪ in 2024/2025). Owner must
> re-verify against the ordinance text before any implementation.

### 2.1 Children (points per parent, tax years 2024-2025)

Two 2024 changes, both retroactive to 1 Jan 2024 and currently permanent law:
חוק סיוע להורים לילדים עד גיל שלוש (תיקוני חקיקה), התשפ"ד-2024 (enacted
20 Mar 2024; adds +1 point birth year, +2 points ages 1-2, +1 point age 3, per
parent), and the extension of the ages-6-12 extra point to ages 6-17.
Legal basis: §§40, 66(ג) of the ordinance.
Sources: kolzchut consolidated table
<https://www.kolzchut.org.il/he/נקודות_זיכוי_ממס_הכנסה_להורה_לילד_עד_גיל_18>;
toddler page <https://www.kolzchut.org.il/he/נקודות_זיכוי_ממס_הכנסה_להורה_לפעוט_(מתחת_לגיל_6)>;
ages 6-17 page <https://www.kolzchut.org.il/he/נקודות_זיכוי_ממס_הכנסה_להורים_לילדים_בגיל_17-6>;
gov.il announcement <https://www.gov.il/he/pages/sa050324-2> (403 to our
fetcher, cited from search index); corroboration
<https://taxcollege.co.il/החל-משנת-2024-נקודת-זיכוי-נוספת-להורים-ל/>.

Child's age reached during the tax year → points per parent (2024-2025):

| Child age in tax year | Mother / custodial parent | Father / other parent |
|---|---|---|
| Born this year | 2.5 | 2.5 |
| 1 | 4.5 | 4.5 |
| 2 | 4.5 | 4.5 |
| 3 | 3.5 | 3.5 |
| 4-5 | 2.5 | 2.5 |
| 6-17 | 2 | 1 |
| 18 | 0.5 | — |

Notes: (a) both parents claim independently, including a non-custodial parent;
(b) הורה יחיד (single parent, other parent absent/unknown) receives both
allocations; (c) special rules for divorced/separated parents and for a parent
receiving mezonot — see kolzchut pages "הורה אחד" and "הורה גרוש או פרוד";
(d) points apply against יגיעה אישית income only for the 6-17 addition;
(e) 2023 differed (birth 1.5 / ages 1-2 2.5 / age 3 2.5 / extra point only for
ages 6-12) — relevant only if we ever compute 2023 returns.

### 2.2 Academic degree (§40ג)

Source: kolzchut
<https://www.kolzchut.org.il/he/נקודות_זיכוי_ממס_הכנסה_בגין_תואר_ראשון>,
<https://www.kolzchut.org.il/he/נקודות_זיכוי_ממס_הכנסה_בגין_תואר_שני>,
<https://www.kolzchut.org.il/he/נקודות_זיכוי_ממס_הכנסה_בגין_תואר_שלישי_במסלול_ישיר>.

| Degree | Completed 2014-2022 | Completed 2023 onward |
|---|---|---|
| Bachelor (תואר ראשון) | 1 point for **1** tax year (year after completion or the next, taxpayer's choice) | 1 point/yr for up to **3** tax years (per number of study years, cap 3) |
| Master (תואר שני) | 0.5 point for 1 tax year (same choice rule) | 0.5 point/yr for **2** tax years |
| Doctorate, direct track (תואר שלישי במסלול ישיר) | 0.5 point for 1 tax year | see kolzchut page; medicine/dentistry and residency-deferral special rules apply |

Notes: one benefit per degree level; professions with mandatory internship
(התמחות) may defer start to the year after internship ends; medicine/dentistry
have their own schedule (kolzchut "תואר ברפואה"). Owner should verify the
2023+ rules against §40ג as amended before implementing — secondary sources
only here.

### 2.3 Oleh hadash (§35)

Source: kolzchut "נקודות זיכוי במס הכנסה לעולה חדש"
<https://www.kolzchut.org.il/he/נקודות_זיכוי_ממס_הכנסה_לעולה_חדש>; corroboration
<https://www.bshcpa.co.il/נקודות-זיכוי-לעולה-חדש-וקטין-חוזר/>.

| Aliyah date | Schedule (months counted from receiving oleh status) | Total |
|---|---|---|
| Before 1.1.2022 | months 1-18: ¼ point/mo; months 19-30: ⅙ point/mo; months 31-42: 1/12 point/mo | 7.5 points over 42 months |
| From 1.1.2022 | months 1-12: 1/12 point/mo; months 13-30: ¼ point/mo; months 31-42: ⅙ point/mo; months 43-54: 1/12 point/mo | 8.5 points over 54 months |

Notes: the clock runs continuously (paused, not consumed, by army service or
academic study); applies to all taxable income; claim via 101/annual return.
**UNRESOLVED for implementation:** the 54-month schedule began as a הוראת שעה
for 2022+ olim — before implementing, verify its current status and end date
in §35 of the ordinance as amended (kolzchut presents it as in force for
2024-2025 olim).

---

## 3. Verdict summary

- CONFIRMED: all 30+ engine constants in both year files (§1.1-1.7).
- CORRECTED: none.
- UNRESOLVED: none among engine constants. Open research items (section 2 —
  not implemented): permanence/end-date of the 54-month oleh schedule; exact
  §40ג text for degrees completed 2023+; medicine/dentistry degree schedule.
- Suggested follow-ups for the main session (comment-only, no value changes):
  close the two NI-ceiling `TODO(owner-verify)` markers with the btl circular
  citations above, and note the Jan-2025 5.16% health-rate step in `2025.ts`.
