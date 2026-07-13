# §47 / §45א / §17(5א) deduction & credit **RATES** — primary-source addendum

Date: 2026-07-13 · Author: tax-law-analyst agent · Status: research addendum
(no code changed) · Companion to `2026-07-13-section47-deductions.md`

Scope: resolve the **rates** the companion report could only source from
licensed-firm tables / kolzchut and marked NEEDS-OWNER-VERIFICATION — the 11%
§47 self-employed deduction (→25,608 ₪ cap), the 5.5% complementary §45א
credit, the combined 16.5%, the §17(5א) 4.5% keren-hishtalmut rate, the
salaried "insured salary > ceiling ⇒ no §47 deduction" gate, the §47(ב)
deduction-base ambiguity (164,400 vs 232,800), and the §47(ב1) "ניכוי נוסף"
mechanism. This addendum reached the **primary statute text** for all of them.

**Bottom line:** every rate in the companion report's §3 is now CONFIRMED
against פקודת מס הכנסה [נוסח חדש] itself. The 164,400-vs-232,800 base
ambiguity and the "two conflicting ניכוי-נוסף descriptions" are both RESOLVED
by reading the actual subsections — the industry tables were numerically right
but described the base loosely. Two corrections to the companion report's
labelling are noted in §6.

> **Indexation caveat (applies to every ₪ cap below).** The percentages are
> statutory and fixed. The shekel figures the ordinance itself prints
> (84,000 / 118,800 / 156,000 / 1,632) are **un-indexed base amounts** that
> §120ב updates each year; the *current* indexed ceilings (116,400 / 164,400 /
> 293,397 / 2,268 …) are the ones in the Jan-2024 & Jan-2025 booklets
> (companion report §2, already CONFIRMED). This addendum confirms the
> **rates**; multiply them by the booklet-confirmed indexed ceilings, not by
> the ordinance's frozen base numbers.

## Primary source (the one this addendum rests on)

| ID | Source |
|---|---|
| **pmh-govil** | פקודת מס הכנסה [נוסח חדש] — לא מרובד, official consolidated text on gov.il (Tax Authority legal-info). Downloaded and text-extracted with `pdftotext -layout`; §§45א, 46, 47, 47א, 17(5א) read verbatim. URL: <https://www.gov.il/BlobFolder/legalinfo/law_pkudat_mas_hachnasa/he/LegalInformation_kesher_%D7%A4%D7%A7%D7%95%D7%93%D7%AA%20%D7%9E%D7%A1%20%D7%94%D7%9B%D7%A0%D7%A1%D7%94%20%5B%D7%A0%D7%95%D7%A1%D7%97%20%D7%97%D7%93%D7%A9%5D%20-%20%D7%9C%D7%90%20%D7%9E%D7%A8%D7%95%D7%91%D7%93.pdf> |
| nevo (corroboration) | פקודת מס הכנסה [נוסח חדש] — <https://www.nevo.co.il/law_html/law00/84255.htm> (same consolidated text; used to cross-check section structure) |

All Hebrew quotations below are transcribed from the pmh-govil extract.

---

## 1. §47(ב1) — the self-employed **מוטב** deduction (the "11%")

Primary text, §47(ב1) (עמית מוטב who paid to a pension provident fund for
himself, or for a child aged 18+), deduction not to exceed:

> "(1) בשל סכומים ששולמו כאמור – **11% מההכנסה לעמית עצמאי**;
> (2) בשל סכומים ששולמו כאמור ושבשלם לא הותר ניכוי לפי פסקה (1) – **7%
> מההכנסה הנוספת**; ואולם אם הסכומים ששולמו כאמור עולים על 12% מהכנסתו
> הנוספת, יותר לו בשל החלק העולה על 12% כאמור, **ניכוי נוסף שלא יעלה על 4%**
> מההכנסה הנוספת, והכל בלבד שלא יינתן ניכוי לפי פסקה זו בשל סכומים שהופקדו
> בעד העמית המוטב שסכומם אינו עולה על 16% מהשכר הממוצע במשק."

| Rate | Section | Base | Source | Verdict |
|---|---|---|---|---|
| **11%** deduction | §47(ב1)(1) | "ההכנסה לעמית עצמאי" | pmh-govil §47(ב1)(1) | **CONFIRMED (primary)** |
| **7%** deduction | §47(ב1)(2) | "ההכנסה הנוספת" | pmh-govil §47(ב1)(2) | **CONFIRMED (primary)** |
| **+4%** "ניכוי נוסף" | §47(ב1)(2) | portion of contribution over 12% of ההכנסה הנוספת | pmh-govil §47(ב1)(2) | **CONFIRMED (primary)** |

Companion report's `deductionRateBp` = **1100 (11%)** is CONFIRMED — but note it
sits in **§47(ב1)**, not §47(ב), and the section applies to an עמית **מוטב**.

### Where 25,608 ₪ actually comes from (base ambiguity RESOLVED)

"ההכנסה לעמית עצמאי" is defined in §47(א)(3):

> "'הכנסה לעמית עצמאי' – סך כל הכנסתו החייבת של יחיד … עד לסכום האמור בפסקה
> (1) להגדרה 'הכנסה מזכה' לשנה, בניכוי הכנסתו המבוטחת."

פסקה (1) of "הכנסה מזכה" is the **work-income-only** ceiling — §47(א)(1)(1),
booklet-indexed to **116,400 ₪/yr** (companion §2). So:

- §47(ב1)(1) 11% base is capped at **116,400 ₪** → 11% × 116,400 = **12,804 ₪**.
- §47(ב1)(2) 7%+4% (=up to 11%) runs on "הכנסה נוספת", whose ceiling per
  §47(א)(5) is `min(uninsured income ≤ 116,400 ; taxable income ≤ 2.5×116,400
  = 291,000 − insured)`. For a **pure self-employed** filer (no insured
  income) that is **116,400 ₪** → another up-to **12,804 ₪**.
- The two stack: **12,804 + 12,804 = 25,608 ₪.**

So the licensed-firm shorthand "11% × 232,800 = 25,608" is *numerically*
correct but mislabels the base: it is **not** a single 232,800 ₪ "הכנסה מזכה"
ceiling. It is **two stacked 116,400 ₪ work-income ceilings** (§47(ב1)(1) on
הכנסה לעמית עצמאי + §47(ב1)(2) on הכנסה נוספת), each = the §47(א)(1)(1)
figure. **164,400 ₪ (§47(א)(1)(2), "לא מהכנסת עבודה") is *not* the deduction
base** — it governs the non-work-income branch of "הכנסה מזכה", not the
עמית-עצמאי deduction. Ambiguity RESOLVED against primary text.

### §47(ב2): no double-dipping

> "(ב2) סכום שנוכה לפי סעיף קטן (ב), לא יהיה ניתן לנכותו לפי סעיף קטן (ב1),
> ולהיפך." — a taxpayer takes the §47(ב) *or* §47(ב1) branch, not both
> (pmh-govil §47(ב2)). This is the מוטב/non-מוטב election the companion §1
> describes, now confirmed to the statute.

---

## 2. §47(ב) — the **non-מוטב** deduction (5% / 7% + 4%)

For completeness (a salaried filer who is *not* a מוטב), §47(ב):

> "(1) **7% מהכנסתו המזכה שאיננה הכנסת עבודה**; ואולם אם שילם סכום העולה על
> 12% מהכנסתו כאמור, יותר לו, בשל החלק העולה על 12% כאמור, **ניכוי נוסף עד
> ל-4%** מאותה הכנסה;
> (2) הסכום הנמוך מבין אלה: (א) **5% מהכנסתו המזכה שהיא הכנסת עבודה שאינה
> הכנסה מבוטחת**; (ב) **5% מהכנסתו החייבת שהיא הכנסת עבודה עד לסכום השווה
> לשתי פעמים וחצי הסכום** האמור בפסקה (1) להגדרה 'הכנסה מזכה' לשנה, **בניכוי
> הכנסתו המבוטחת**."

| Rate | Section | Base | Source | Verdict |
|---|---|---|---|---|
| **7%** + **4%** additional | §47(ב)(1) | non-work-income הכנסה מזכה | pmh-govil §47(ב)(1) | **CONFIRMED (primary)** |
| **5%** | §47(ב)(2) | work-income הכנסה מזכה, capped 2.5× work ceiling (=291,000) less insured | pmh-govil §47(ב)(2) | **CONFIRMED (primary)** |

---

## 3. Salaried "insured salary > ceiling ⇒ no §47 deduction" gate — CONFIRMED

The gate the companion §3.3 sourced only to as-invest is **built into the base
arithmetic** of §47(ב)(2)(ב): the deduction runs on work income "עד לסכום
השווה לשתי פעמים וחצי הסכום … בניכוי **הכנסתו המבוטחת**." 2.5 × work-income
ceiling = 2.5 × 116,400 = **291,000 ₪/yr (= 24,250 ₪/mo = §47(א)(5))**. When
the employer-insured salary reaches that ceiling, `291,000 − insured ≤ 0`, so
the §47(ב)(2) deduction base is **0**.

| Rule | Value | Section | Source | Verdict |
|---|---|---|---|---|
| Insured salary ≥ 2.5× work ceiling (291,000/yr = 24,250/mo) ⇒ §47(ב) deduction = 0 | 291,000 ₪/yr | §47(ב)(2)(ב) ("בניכוי הכנסתו המבוטחת") | pmh-govil §47(ב)(2)(ב) | **CONFIRMED (primary)** — mechanism is the "less insured income" cap, not a separate rule |

Consequence for the engine (unchanged from companion §3.3): a single-employer,
fully-insured salaried filer with no independent fund has a §47 deduction of
**0**, so the engine's current output is already correct for that population.

---

## 4. §45א credit — the **35%** rate and the **5% + 0.5% = 5.5%** structure

The "5.5% complementary credit" the companion §3.1 could not source is two
distinct statutory pieces. The credit **rate** is 35%; 5.5% is the *deposit
ceiling* eligible for that credit.

### 4.1 Credit rate — §45א(ב) and §45א(א)

> "(א) יחיד יזוכה ממס ב-**25%** מן הסכומים ששילמו … לביטוח חייו …
> (ב) יחיד יזוכה ממס ב-**35%** מן הסכומים ששילמו … לקופת גמל לקצבה …"
> (pmh-govil §45א(א),(ב))

| Rate | Section | Applies to | Source | Verdict |
|---|---|---|---|---|
| **35%** credit | §45א(ב) | pension provident-fund (קצבה) contributions | pmh-govil §45א(ב) | **CONFIRMED (primary)** — matches engine `creditRateBp` 3500 |
| **25%** credit | §45א(א) | life-insurance (ביטוח חיים) premiums | pmh-govil §45א(א) | **CONFIRMED (primary)** — informational; engine reads only box-045 pension |

### 4.2 The 5% credit-deposit ceiling (מוטב) — §45א(ה)(2)(ב)(1)

> "(ב)(1) לענין עמית מוטב שלא היתה לו בשנת המס הכנסה מבוטחת – **5% מהכנסתו
> החייבת עד לסכום השווה לפעמיים הסכום האמור בפסקה (1) להגדרה 'הכנסה מזכה'
> שבסעיף 47(א)(1) לשנה** …" (pmh-govil §45א(ה)(2)(ב)(1))

"פעמיים הסכום … בפסקה (1)" = **2 × 116,400 = 232,800 ₪** — *this* is where the
**232,800 ₪** in the industry tables belongs: it is the **§45א credit** base
ceiling, **not** the §47 deduction base. (§45א(ד)(2)(ב) similarly sets 5%/7% of
"הכנסה מזכה" for a **non-מוטב** — 5% with no work income, 7% with work income.)

### 4.3 The extra 0.5% (self-employed, no אכ"ע) — §45א(ו)

> "(ו) יחיד שלא נוכו לו סכומים בעד רכישת ביטוח מועדף מפני אבדן כושר עבודה לפי
> סעיף 32(14)(ב), יזוכה ממס בשיעור של **35%** מן הסכומים שהפקיד לקופת גמל
> לקצבה בעבור עצמו כעמית עצמאי ולא זוכה בשלהם ממס לפי סעיף קטן (ב), **עד
> לשיעור של 0.5% מהכנסתו מעסק או ממשלח יד** עד לסכום השווה לפעמיים הסכום
> האמור בפסקה (1) להגדרה 'הכנסה מזכה' שבסעיף 47(א)(1) בניכוי הכנסתו
> המבוטחת." (pmh-govil §45א(ו))

| Component | Section | Rate | Source | Verdict |
|---|---|---|---|---|
| Base credit-deposit ceiling (self-employed מוטב) | §45א(ה)(2)(ב)(1) | **5%** of income ≤ 232,800 | pmh-govil | **CONFIRMED (primary)** |
| אכ"ע-forgone top-up | §45א(ו) | **+0.5%** of business income, credited at **35%** | pmh-govil | **CONFIRMED (primary)** |
| **⇒ complementary credit deposit** | (ה)(2)(ב)(1) + (ו) | **5% + 0.5% = 5.5%** | derived from two confirmed subsections | **CONFIRMED (primary, composite)** |

So the companion's "5.5% → 12,804 ₪ contribution" is 5.5% × 232,800 = 12,804 ₪
of *credit-eligible deposit*, on which the credit is 35% × 12,804 = **4,481.40
₪**. Both the 5.5% base and the 35% rate are now primary-confirmed. The
0.5% is a **§45א credit** top-up — **not** the §47(ב1) "ניכוי נוסף" (see §5).

---

## 5. The two "ניכוי נוסף" descriptions — RECONCILED

The companion §3.2 flagged two irreconcilable sources: a "0.5% credit top-up"
and a "7% deduction on uninsured income." **Both are real; they are different
sections**, and the companion's confusion was conflating them:

| "extra benefit" | What it actually is | Section | Primary text |
|---|---|---|---|
| the **0.5%** | a **credit** (35%) for self-employed who forwent the §32(14) אכ"ע deduction — turns the 5% credit-deposit into 5.5% | **§45א(ו)** | pmh-govil §45א(ו) |
| the **"ניכוי נוסף"** proper | a **deduction**: extra **4%** (on top of 7%) on the portion of contributions exceeding 12% of "הכנסה נוספת" | **§47(ב1)(2)** (and §47(ב)(1) for non-מוטב) | pmh-govil §47(ב1)(2) |

The statutory phrase **"ניכוי נוסף"** appears in §47(ב)(1) and §47(ב1)(2) and
means the **4%** deduction bump, *not* a 7% figure and *not* a 0.5% credit. The
"7%" is the base rate of §47(ב1)(2)/(§47(ב)(1)) that the 4% sits on top of. The
"0.5%" is an unrelated §45א credit. **UNRESOLVED item RESOLVED.**

---

## 6. §17(5א) — keren-hishtalmut self-employed **4.5%** deduction — CONFIRMED

> "(5א) סכומים ששילם יחיד לקרן השתלמות לעצמאים לא יעלו על **4.5% מהכנסתו
> הקובעת**; לענין זה – 'הכנסה קובעת' – הכנסתו החייבת של היחיד מעסק או ממשלח
> יד, לפני הניכוי לפי פסקה זו, ועד לסכום של **156,000 שקלים חדשים בשנה** …"
> (pmh-govil §17(5א))

| Rate | Section | Base | Source | Verdict |
|---|---|---|---|---|
| **4.5%** deduction | §17(5א) | "הכנסה קובעת" (business income), ceiling **156,000 ₪ statutory → 293,397 ₪ indexed** (booklet, companion §2) | pmh-govil §17(5א) | **CONFIRMED (primary)** |

Companion §3's "§17(5א) rate 4.5% → 13,203 ₪ cap" is CONFIRMED: 4.5% ×
293,397 (booklet-indexed ceiling) = **13,203 ₪**. The rate is primary; the
293,397 ceiling was already booklet-confirmed. (Note the ordinance still prints
the un-indexed 156,000 base — do not use it directly.)

---

## 7. Combined 16.5% — components confirmed

"16.5%" is not a single statutory number; it is the sum a self-employed מוטב
can shelter: **11% deduction (§47(ב1)(1)) + 5.5% credit-deposit (§45א(ה)(2)(ב)(1)
+ §45א(ו))**. Both addends are primary-confirmed above, so the 16.5% headline
and the pensuni "16.5% של הרובד הראשון = 19,206 ₪" cross-check (16.5% × 116,400
= 19,206) are sound — with the caveat that the **deduction** and **credit**
pieces run on **different ceilings** (deduction stacks two 116,400 work
ceilings; credit runs on 2×116,400 = 232,800), so the flat "16.5% × one
ceiling" is a first-tier approximation, not the full cap.

---

## 8. Verdict summary — every companion NEEDS-OWNER-VERIFICATION rate now CONFIRMED

| Constant / rule | Companion verdict | Addendum verdict | Section · source |
|---|---|---|---|
| §47(ב1)(1) self-employed deduction **11%** | NEEDS-OWNER-VERIFICATION | **CONFIRMED (primary)** | §47(ב1)(1) · pmh-govil |
| 25,608 ₪ deduction cap | NEEDS-OWNER-VERIFICATION | **CONFIRMED (primary)** = 11%×(116,400+116,400) via §47(ב1)(1)+(2), *not* 11%×one-232,800 | §47(ב1),(א)(3),(א)(5) · pmh-govil |
| §47(ב) base: 164,400 vs 232,800 | AMBIGUOUS | **RESOLVED** — base is 116,400 work ceiling (stacked); 232,800 is the §45א **credit** ceiling; 164,400 is irrelevant to the עמית-עצמאי deduction | §47(א)(1)(1),(3); §45א(ה) · pmh-govil |
| §45א complementary credit **5.5%** | NEEDS-OWNER-VERIFICATION | **CONFIRMED (primary)** = 5% (§45א(ה)(2)(ב)(1)) + 0.5% (§45א(ו)) | §45א(ה),(ו) · pmh-govil |
| §45א pension credit **rate 35%** | (engine value, prior report) | **CONFIRMED (primary)** | §45א(ב) · pmh-govil |
| combined **16.5%** | NEEDS-OWNER-VERIFICATION | **CONFIRMED (primary, composite)** = 11% + 5.5% | §47(ב1)(1)+§45א(ה)/(ו) · pmh-govil |
| §17(5א) keren-hishtalmut **4.5%** | NEEDS-OWNER-VERIFICATION | **CONFIRMED (primary)** | §17(5א) · pmh-govil |
| salaried insured-salary gate (no §47 if insured ≥ 291,000/yr) | NEEDS-OWNER-VERIFICATION | **CONFIRMED (primary)** — via "בניכוי הכנסתו המבוטחת" up to 2.5× work ceiling | §47(ב)(2)(ב) · pmh-govil |
| §47(ב1) "ניכוי נוסף" (0.5% vs 7%) | UNRESOLVED | **RESOLVED** — "ניכוי נוסף" = **+4% deduction** (§47(ב1)(2)); the 7% is its base rate; the 0.5% is a separate **§45א(ו) credit** | §47(ב1)(2); §45א(ו) · pmh-govil |

### Corrections to companion labelling (for the owner, not code)

1. The 11% deduction lives in **§47(ב1)(1)** (עמית מוטב), not §47(ב). Companion
   headers say "§47(ב) 11%"; the statute puts 11% in §47(**ב1**)(1). §47(ב)
   itself is the *non*-מוטב branch (5% / 7%+4%).
2. **232,800 ₪ is a §45א *credit* base, not a §47 *deduction* base** (§45א(ה)).
   The 11% deduction's base is the 116,400 work-income ceiling, stacked with a
   second 116,400 "הכנסה נוספת" ceiling — arithmetically 232,800, structurally
   two 116,400 pieces.
3. The companion's "0.5% credit top-up that turns 5% into 5.5%" is correct and
   is **§45א(ו)** — but it is *not* the "§47(ב1) ניכוי נוסף"; those are two
   different mechanisms in two different sections.

### Still owner-verify (genuinely open)

- **None of the rates.** All eight items above are primary-confirmed.
- Whether any §47/§17(5א) deduction fires for *Matan's* actual return (single
  employer, fully-insured salary, no עמית-עצמאי fund) — companion §4 scope call
  stands: for that profile every deduction here is **0**, so deferring the §47
  module remains defensible. This is a scope decision for the owner, not a
  rate question.
- The **indexed ₪ ceilings** (116,400 / 164,400 / 232,800 / 291,000 / 293,397)
  are booklet-confirmed for 2024-2025 in the companion report; re-verify them
  per year (they track the average wage / §120ב, not the rates confirmed here).
