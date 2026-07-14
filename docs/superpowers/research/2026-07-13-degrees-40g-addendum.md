# §40ג / §40ד degree & vocational credit points — primary-source addendum

Date: 2026-07-13 · Author: tax-law-analyst agent · Status: research addendum (no code changed)

Addendum to `docs/superpowers/research/2026-07-13-credit-points-verification.md`
§2, which flagged the **degree / vocational claim-year mechanics as UNRESOLVED**
(fixed-vs-elective claim years, internship deferral, vocational conditions,
direct-track/medicine tracks) and deferred them because the earlier report rested
on כל-זכות (secondary) plus a bare Form 119 field list. This addendum reads the
**Tax Authority Form 119 explanatory notes (דברי הסבר)** — a primary Authority
publication updated **11.2024**, covering tax years 2024 & 2025 — line by line and
resolves those items. Figures are credit **points** (statutory counts, not
§120ב-indexed money → the freeze law is irrelevant to them; point *value* 2,904 ₪/yr
is confirmed elsewhere). Nothing here is an engine constant yet; the engine still
takes these via `TaxpayerInput.additionalCreditPoints` (0.25-pt units).

## Primary source read for this addendum

| ID | Source | Tier | Fetch |
|---|---|---|---|
| **form119-2024** | רשות המסים, טופס 119 — "בקשה להקלה במס ליחיד הזכאי לתואר אקדמי/תעודת מקצוע (סעיפים 40ג עד 40ה לפקודת מס הכנסה)", updated 11.2024, incl. דברי הסבר §§1-7 — <https://www.gov.il/BlobFolder/service/itc119/he/Service_Pages_Income_tax_annual-report-2024_itc119-2024.pdf> | **primary** (Tax Authority) | downloaded + `pdftotext -layout`, full text read |
| **kz-ba** | כל-זכות, "בגין תואר ראשון" — <https://www.kolzchut.org.il/he/נקודות_זיכוי_ממס_הכנסה_בגין_תואר_ראשון> | secondary | corroboration |
| **capitax-189** | קפיטקס, "פורסם תיקון 189 לפקודת מס הכנסה — דחיית מועד נקודות זיכוי בגין התמחות" — <https://www.capitax.co.il/content/2/777> | secondary | corroboration (internship) |

**Statutory anchor / caveat on sub-letters.** Form 119 titles itself
"סעיפים 40ג עד 40ה לפקודת מס הכנסה" and groups all five tracks (bachelor,
master, PhD-medicine, direct-track PhD, vocational) under that 40ג–40ה range
**without printing which sub-letter governs which track**. The allocation
"academic degrees → §40ג, vocational studies/certificate → §40ד" comes from
**secondary** CPA/כל-זכות sources (consistent across haimasher, claltax,
כל-זכות). The **substantive rules below are primary** (Form 119 דברי הסבר);
the exact §40ג-vs-§40ד sub-letter split is **owner-verify against the ordinance
text** (nevo/consolidated PDF not fetched — likely 403). This does not affect
the point counts or claim years, only the citation label.

---

## 1. Bachelor's (תואר ראשון) — RESOLVED

Form 119 דברי הסבר §1 (verbatim):
> "מי שסיים את לימודיו, יהא זכאי לנקודת זיכוי אחת **החל משנת המס שלאחר שנת המס
> שבה הסתיימו לימודיו לתואר או התמחותו**. נקודת הזיכוי כאמור תובא בחשבון במספר
> שנות המס שהן כמספר שנות לימודיו האקדמיות, אך לא יותר משלוש שנות מס."
> "מי שסיים לימודים לתואר אקדמי ראשון בשנים **2022-2014** יהיה זכאי לנקודת זיכוי
> אחת, בשנת המס שלאחר שנת סיום התואר **או בשנת המס שלאחריה, לפי בחירתו**."

| Constant | Draft value (§2.1) | Verified value | Source | Verdict |
|---|---|---|---|---|
| BA points/yr | 1 | 1 | form119-2024 §1 | CONFIRMED (primary) |
| BA #years, 2023+ | up to 3 (= study years, cap 3) | = number of academic study years, **cap 3 tax years** | form119-2024 §1 | CONFIRMED (primary) |
| BA claim window, 2023+ | consecutive after completion | **FIXED**: consecutive years **starting the tax year after** studies (or internship) ended — not elective | form119-2024 §1 ("החל משנת המס שלאחר") | **RESOLVED → FIXED** (primary) |
| BA points, 2014-2022 | 1 | 1 | form119-2024 §1 | CONFIRMED (primary) |
| BA #years, 2014-2022 | 1 | 1 | form119-2024 §1 | CONFIRMED (primary) |
| BA claim window, 2014-2022 | year-after OR year-after-that (choice) | **ELECTIVE**: the year after completion **or** the following year, taxpayer's choice ("לפי בחירתו") | form119-2024 §1, kz-ba | CONFIRMED (primary) |

**Fixed-vs-elective — the central UNRESOLVED item — is now settled:** the
"choice of year" (לפי בחירתו) is a feature of the **2014-2022 cohort only** (one
point, pick one of two candidate years). The **2023+ regime is fixed**: the
benefit runs in consecutive tax years *starting the year after* studies/internship
ended, for as many years as there were academic study years, capped at 3. There is
no year-selection election in the 2023+ regime.

## 2. Master's (תואר שני) — RESOLVED

Form 119 דברי הסבר §2 (verbatim):
> "יחיד הזכאי לתואר אקדמי שני... זכאי **למחצית נקודת זיכוי**, החל בשנת המס שלאחר
> שנת המס שבה הסתיימו לימודיו לתואר או התמחותו. מחצית נקודת זיכוי כאמור תובא
> בחשבון במספר שנות מס שהן כמספר שנות לימודיו האקדמיות, אך **לא יותר משתי שנות מס**."
> "מי שסיים לימודים לתואר אקדמי שני בשנים 2022-2014 יהיה זכאי למחצית נקודת זיכוי,
> בשנת המס שלאחר שנת סיום התואר או בשנת המס שלאחריה, לפי בחירתו."

| Constant | Draft value (§2.2) | Verified value | Source | Verdict |
|---|---|---|---|---|
| MA points/yr | 0.5 | 0.5 | form119-2024 §2 | CONFIRMED (primary) |
| MA #years, 2023+ | "2" (implied fixed) | **= number of academic study years, cap 2 tax years** (not a flat 2) | form119-2024 §2 | **CORRECTED / clarified** (primary) |
| MA claim window, 2023+ | two years after completion | **FIXED** consecutive, starting year after studies/internship | form119-2024 §2 | RESOLVED → FIXED (primary) |
| MA 2014-2022 | 0.5, one year, choice | 0.5, one year, **elective** (year-after or the following, choice) | form119-2024 §2 | CONFIRMED (primary) |

Small correction to the draft: the 2023+ master's window is `min(study years, 2)`,
mirroring the bachelor's `min(study years, 3)` — not an unconditional 2 years. A
one-year master's program therefore yields only one year of the 0.5 point.

## 3. Vocational studies / certificate (לימודי מקצוע / תעודת מקצוע) — RESOLVED

Form 119 דברי הסבר §5 and §7(ו) (verbatim, condensed):
> §5: "יחיד שסיים לימודי מקצוע וזכאי לתעודת מקצוע (כולל תעודת הוראה שלא משולבת
> בלימודי תואר אקדמי), זכאי לנקודת זיכוי אחת, החל בשנת המס שלאחר שנת המס שבה
> הסתיימו לימודיו לתעודה, בהתאם למספר שנות הלימוד אך לא יותר משלוש שנות מס."
> 2014-2022: "...זכאי לנקודת זיכוי אחת בשנת המס שלאחר שנת סיום לימודי המקצוע או
> בשנת המס שלאחריה, לפי בחירתו."
> §7(ו): "לימודי מקצוע — לימודים לרכישת מקצוע מסויים... בהיקף שעות לימוד הזהה
> ל-**1,700 שעות לימוד לפחות** הנהוגות במוסד להשכלה גבוהה, כהגדרתו בסעיף 40ג
> לפקודה. תעודת מקצוע — תעודה הניתנת בסיום לימודי מקצוע, **המוכרת על-ידי משרד
> ממשלתי**... אף אם הלימודים לא היו במוסד המוכר על-ידי המועצה להשכלה גבוהה."

| Constant | Draft value (§2.3) | Verified value | Source | Verdict |
|---|---|---|---|---|
| Vocational points/yr | 1 | 1 | form119-2024 §5 | CONFIRMED (primary) |
| Vocational #years, 2023+ | up to 3 (= study years, cap 3) | = study years, **cap 3 tax years**, fixed consecutive from year after completion | form119-2024 §5 | CONFIRMED (primary) |
| Vocational 2014-2022 | 1, one year, choice | 1, one year, **elective** | form119-2024 §5 | CONFIRMED (primary) |
| Min hours | ≥ 1,700 | **≥ 1,700 study hours** equivalent to those customary at an institution of higher education (per §40ג definition) | form119-2024 §7(ו) | CONFIRMED (primary) |
| Certificate | gov-recognized | certificate recognized by a **government ministry** (משרד ממשלתי); institution need **not** be CHE-recognized | form119-2024 §7(ו) | CONFIRMED (primary) |
| No double-claim with degree | flagged | **§7(ג): taxpayer must CHOOSE** between the degree benefit (§§1-4) and the vocational benefit (§5) — cannot take both | form119-2024 §7(ג) | CONFIRMED (primary) |
| One-per-level cap | — | **§7(ב): benefit for one bachelor OR one master OR one vocational certificate only** (two bachelor's ⇒ still one benefit, per the form's own example) | form119-2024 §7(ב) | CONFIRMED (primary) |

Teaching certificate (תעודת הוראה) that is **not** embedded in an academic degree
is treated as vocational under §5 (form119-2024 §5). Note the 2023+ vocational
window is `min(study years, 3)` — same shape as bachelor's.

## 4. Internship deferral (התמחות) — RESOLVED

Form 119 דברי הסבר §6 (verbatim):
> "יחיד שסיים התמחות **בשנת 2012 ואילך**, הזכאי לקבל תואר אקדמי ראשון או שני
> בתחום עיסוק בו נדרשת התמחות וכי השלמתו היא תנאי להתמחות, **יוכל לבחור** אם
> נקודות הזיכוי... יובאו בחשבון בשנת המס שלאחר השנה שבה הסתיימו לימודיו לתואר
> האקדמי האמור **או** בשנת המס שלאחר השנה שבה סיים התמחותו. כל זאת ובלבד
> **שתקופת ההתמחות תחל לא יאוחר משנת המס שלאחר** השנה שבה הסתיימו לימודיו לתואר."

Rule (RESOLVED, primary): for a **bachelor's or master's in a profession that
requires an internship** where completing the degree is a condition of the
internship (e.g. law, accountancy), and where **internship ended in 2012 or
later**, the taxpayer may **elect** the benefit start to be either (a) the tax
year after the degree studies ended, or (b) the tax year after the **internship**
ended — provided the internship **began no later than the tax year after** degree
completion. This is the §40ג mechanism behind תיקון 189 (capitax-189, secondary
corroboration). This is the only election that survives into the 2023+ regime: it
shifts the *start year* of the (otherwise fixed) consecutive window, it does not
add years.

## 5. Direct-track PhD and medicine/dentistry — now primary-sourced (owner decides scope)

Both were UNRESOLVED/out-of-scope in the draft (§2.4). Form 119 gives concrete
primary numbers; recording them so the owner can decide whether to model or keep
on `additionalCreditPoints`.

### 5.1 Medicine / dentistry PhD (תואר שלישי ברפואה/רפואת שיניים) — form119-2024 §3
- **2023+:** 1 point in **each of the first 3** tax years after completion, **+ 0.5
  point in each of the next 2** tax years (i.e. 3 × 1 pt then 2 × 0.5 pt).
- **2014-2022:** 1 point (year after completion or the following, choice) **+ 0.5
  point** in the year after the year the 1 point was taken.

### 5.2 Direct-track PhD (תואר שלישי "ישיר") — form119-2024 §4
- For the **first-degree** component: benefit **as in §1 (bachelor)** — code 1
  (1 point, cap-3 rules).
- For the **third-degree** component: benefit **as in §2 (master, 0.5 pt)** — code 4.
- **Explicit exclusion:** no credit points for a third degree that is **neither**
  direct-track **nor** medicine/dentistry (form119-2024 §4).
- 2014-2022 direct-track: 1 point (year after first degree or following, choice)
  + 0.5 point (year after third-degree completion or following, choice).

### 5.3 §7 interaction rules (primary, form119-2024)
- §7(ד): someone who took the §1 bachelor benefit and then studied a medicine PhD
  (§3) may receive a §3 **top-up**.
- §7(א): benefit granted only after the individual presents proof of completion and
  entitlement to the degree/certificate.
- §7(ה): "academic degree" = a recognized degree under חוק המועצה להשכלה גבוהה,
  התשי"ח-1958; institution list at che.org.il.

---

## 6. Verdict summary — is a degrees increment now unblockable?

**RESOLVED to primary (Form 119 דברי הסבר, updated 11.2024 — Tax Authority):**
1. **Fixed vs elective (the deferral-reason):** 2023+ regime is **fixed**
   consecutive years starting the year after completion; the "choice of year"
   election belongs to the **2014-2022** cohort only. (§1, §2, §5)
2. **Year counts:** bachelor `min(study years, 3)`, master `min(study years, 2)`,
   vocational `min(study years, 3)` — all 2023+ (a **correction** to the draft's
   flat "2" for master's).
3. **Internship deferral (§6):** elective start = max(year-after-degree,
   year-after-internship), for internship-required bachelor/master, internship
   ending 2012+, internship starting ≤ year-after-degree.
4. **Vocational (§40ד):** ≥ 1,700 hours, government-ministry-recognized
   certificate, institution need not be CHE-recognized; **§7(ג) choose degree OR
   vocational**, **§7(ב) one benefit per level**.
5. **Medicine and direct-track PhD:** concrete primary schedules recorded (§5).

**Still owner-verify (not blocking a first increment):**
- The exact **§40ג vs §40ד** sub-letter allocation per track (Form 119 groups them
  40ג–40ה without sub-attribution; the split is from secondary CPA sources). Read
  the ordinance text (nevo / consolidated gov.il PDF) to label the engine
  constants precisely. Substance is unaffected.
- Verbatim ordinance wording for the "study years" definition (Form 119 says
  "שנות לימודיו האקדמיות" — confirm whether part-years / repeated years count).

**Unblockable?** Yes for the **bachelor, master, and vocational** tracks: the
2023+ (fixed `min(study years, cap)` from year-after-completion) and 2014-2022
(elective 1-of-2-years) mechanics, the internship-deferral start shift, and the
degree-vs-vocational / one-per-level exclusivity are all primary-confirmed. A
clean first increment models these with a reviewer-supplied
`{ level, completionYear, studyYears, claimYearIndex, internshipEndYear? }` and
still falls back to `additionalCreditPoints`. Medicine/direct-track PhD can be a
later slice or stay on the manual escape hatch; only the sub-letter citation label
needs the ordinance read before the `// source:` comments are finalized.
