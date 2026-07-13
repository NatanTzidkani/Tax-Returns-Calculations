# Credit-point COUNTS — primary-source addendum (children & oleh)

Date: 2026-07-13 · Author: tax-law-analyst agent · Status: research addendum (no code changed)

Addendum to `docs/superpowers/research/2026-07-13-credit-points-verification.md`
and `docs/superpowers/research/2026-07-13-credit-points-allocation-addendum.md`.
Those two reports upgraded the **allocation mechanism** to primary but left the
**point counts** on secondary (כל-זכות) sources — specifically the **2024 reform
amounts** (חוק סיוע להורים לילדים עד גיל שלוש, התשפ"ד-2024), read there from a CPA
summary rather than the enacted law. This addendum closes that gap as far as the
fetcher allows: it reaches the **statutory §40 / §66(ג) / §35 text** and confirms
the counts against it, flagging what is still owner-verify.

## Method & sources

| ID | Source | Tier |
|---|---|---|
| **pkuda-gov** | פקודת מס הכנסה [נוסח חדש] — the Tax Authority's own consolidated text on gov.il (LegalInformation collection). PDF: <https://www.gov.il/BlobFolder/legalinfo/law_pkudat_mas_hachnasa/he/LegalInformation_kesher_%D7%A4%D7%A7%D7%95%D7%93%D7%AA%20%D7%9E%D7%A1%20%D7%94%D7%9B%D7%A0%D7%A1%D7%94%20%5B%D7%A0%D7%95%D7%A1%D7%97%20%D7%97%D7%93%D7%A9%5D%20-%20%D7%9C%D7%90%20%D7%9E%D7%A8%D7%95%D7%91%D7%93.pdf> — downloaded (10.8 MB) and read locally with `pdftotext -layout`. §35, §40, §66 transcribed verbatim below. **Currency caveat: this "consolidated" PDF is itself current only to ~2022** — its newest amendments are תיקון 260 / 262 (תשפ"ב-2022) and its latest annotated year is תשפ"ג; it does **NOT** contain the 2024 reform (nor the 2024 freeze law). So for *pre-reform* §40/§66 and for §35 it is primary; for the *2024 reform additions* it is not the source. | primary (current to ~2022) |
| **gov-2024law** | רשות המסים, official announcement of חוק סיוע להורים לילדים עד גיל שלוש — <https://www.gov.il/he/pages/sa050324-2>. **Returns HTTP 403 to both WebFetch and curl** (Mozilla UA) — owner must open directly. Its text (the six-point split, retroactive 1.1.2024) was recovered via the search index and matches every secondary source. | primary (unverified fetch — 403) |
| **capitax-2878** | קפיטקס, "חוק סיוע להורים לילדים עד גיל שלוש" — <https://www.capitax.co.il/content/2/2878> (ס"ח 3184, 20.3.2024; amends §40 and §66; applies 2024 **and** 2025) | secondary (CPA quoting the enacted law) |
| **y-elgali** | ר"ח אלגלי, same law — <https://www.y-elgali.com/post/חוק-סיוע-להורים-לילדים-עד-גיל-שלוש> | secondary (corroboration of the split) |
| **industry** | התאחדות התעשיינים — <https://industry.org.il/index.php?dir=site&page=union_articles&op=item&cs=8853&langpage=heb> (split + retroactive 1.1.2024) | secondary (corroboration) |

Nevo's up-to-date §40 (`law_html/law00/84255.htm`) could not be read for the
target sections through the fetcher; the Knesset LawBill page returned empty. The
enacted **ס"ח 3184** PDF was therefore not obtained verbatim.

---

## 1. The 2024 reform additions (+1/+2/+2/+1 for ages 0/1/2/3)

**Verdict: point counts CONFIRMED (primary announcement + exact arithmetic tie-out
to the primary pre-reform statute); enacted §40/§66 verbatim text still owner-verify.**

חוק סיוע להורים לילדים עד גיל שלוש (תיקוני חקיקה), התשפ"ד-2024 — **ס"ח 3184,
פורסם 20.3.2024, מתקן את §40 ו-§66 לפקודה, בתוקף רטרואקטיבי מ-1.1.2024** (capitax-2878,
gov-2024law). The per-age split:

| Child's age reached in tax year | Reform addition (per eligible parent) | Source | Verdict |
|---|---|---|---|
| Born this year (0) | **+1** | gov-2024law; capitax-2878; y-elgali; industry | CONFIRMED |
| 1 | **+2** | same | CONFIRMED |
| 2 | **+2** | same | CONFIRMED |
| 3 | **+1** | same | CONFIRMED |
| **Total per child** | **+6 (ages 0-3)** | same | CONFIRMED |

The gov-2024law announcement text (recovered via search index) states it verbatim:
*"…שש נקודות זיכוי נוספות בסך הכול, בשל כל ילד… בשנת הלידה ובשנה שבה מלאו לילד שלוש
שנים תינתן נקודת זיכוי נוספת אחת בכל שנה, ובשנים שבהן מלאו לילד שנה ושנתיים יהיה
ההורה זכאי ל-2 נקודות זיכוי נוספות."* This matches the CPA summary the earlier
reports relied on **and** ties out to the arithmetic in §2 below.

- **Applies to which years:** 2024 **and** 2025 (and onward). It is a **permanent**
  amendment (תיקוני חקיקה to §40/§66), not a הוראת שעה, effective retroactively from
  **1.1.2024** (capitax-2878, industry, gov-2024law). The freeze law
  (חוק ההתייעלות הכלכלית (הקפאת עדכוני מס ומס יסף), התשפ"ה-2024) does **not** touch it —
  it freezes indexed *amounts*, and these are statutory *point counts*.
- **Still OWNER-VERIFY:** the **enacted §40/§66 subparagraph text** of ס"ח 3184
  verbatim. Neither consolidated ordinance PDF (pkuda-gov, and the btl PDF used in
  the allocation addendum) contains the 2024 reform — **both are pre-reform (≤2022)**.
  gov-2024law, nevo, and the Knesset bill page all failed the fetcher (403 / empty).
  The count is confirmed by the official announcement + arithmetic; the exact new
  subparagraph numbering/wording is not yet read from רשומות.

---

## 2. Base child age→point table — §66(ג)(4) (married mother) & §40(ב)(1) (single parent)

**Verdict: the PRE-reform base is CONFIRMED verbatim against the primary ordinance
(pkuda-gov); the post-reform totals follow by adding §1. The "ages 6-17 = 2 (full
band)" value for 2024+ is NOT in the consolidated text and stays secondary.**

Verbatim from **pkuda-gov §66(ג)(4)** (the married **mother/אשה** schedule; extracted
lines ~5900-5940):

> **(4)** האשה תהא זכאית ל-½ נקודת זיכוי לפי סעיף 36א, ובנוסף… לנקודות זיכוי בעד ילדיה כלהלן:
> **(א)** 1½ נקודות זיכוי בעד כל אחד מילדיה בשנת לידתו, ו-½ נקודת זיכוי בעד כל אחד מילדיה בשנת בגרותו;  *(תיקון 247, תשע"ח-2018)*
> **(ב)** נקודת זיכוי אחת בעד כל אחד מילדיה החל בשנת המס שלאחר שנת לידתו ועד לשנת המס שקדמה לשנת בגרותו;
> **(ג)** 1½ נקודות זיכוי נוספות על נקודת הזיכוי לפי פסקת משנה (ב), בעד כל אחד מילדיה החל בשנת המס שלאחר שנת לידתו ועד לשנת המס שבה מלאו לו חמש שנים;  *(תיקון 260 – הוראת שעה, תשפ"ב-2022)*
> **(ד)** נקודת זיכוי אחת נוספת על נקודות הזיכוי לפי פסקת משנה (ב), בעד כל אחד מילדיה, אשר בשנת 2022 טרם מלאו לו שלוש עשרה שנים והוא אינו פעוט…

Pre-reform married-mother totals that this yields, and the post-reform total after
adding §1:

| Age reached in tax year | §66(ג)(4) build-up | Pre-reform base | +Reform (§1) | Post-reform total | vs report §1.1 | Verdict |
|---|---|---|---|---|---|---|
| Born (0) | (א) 1½ | 1.5 | +1 | **2.5** | 2.5 | CONFIRMED |
| 1 | (ב) 1 + (ג) 1½ | 2.5 | +2 | **4.5** | 4.5 | CONFIRMED |
| 2 | (ב) 1 + (ג) 1½ | 2.5 | +2 | **4.5** | 4.5 | CONFIRMED |
| 3 | (ב) 1 + (ג) 1½ | 2.5 | +1 | **3.5** | 3.5 | CONFIRMED |
| 4 | (ב) 1 + (ג) 1½ | 2.5 | 0 | **2.5** | 2.5 | CONFIRMED |
| 5 | (ב) 1 + (ג) 1½ | 2.5 | 0 | **2.5** | 2.5 | CONFIRMED |
| 6-12 | (ב) 1 + (ד) 1 | 2 | 0 | **2** | 2 | CONFIRMED for 6-12 |
| 13-17 | (ב) 1 | 1 | 0 | **1** | 2 (report) | **MISMATCH — owner-verify** |
| 18 (בגרות) | (א) ½ | 0.5 | 0 | **0.5** | 0.5 | CONFIRMED |

Notes:
- The base table in the two earlier reports (birth 2.5 / age1-2 4.5 / age3 3.5 /
  age4-5 2.5 / age18 0.5) is **confirmed to the primary statute** once the §1 reform
  is added to the verbatim §66(ג)(4) base.
- **The one gap:** the reports treat **ages 6-17 uniformly as 2 points** (mother).
  The consolidated statute gives the extra point (making it 2) **only for 6-12**, via
  §66(ג)(4)(ד), which is textually frozen to *"אשר בשנת 2022 טרם מלאו לו שלוש עשרה
  שנים"* — i.e. the 2022 הוראת שעה drafting. The **extension of that extra point to
  the full 6-17 band from 2024** (kz-6to17, secondary) is **not present** in this
  pre-reform consolidated text and is **not verified to primary** here. → For ages
  **13-17** treat the mother's count as **owner-verify (1 vs 2)**; ages 6-12 = 2 is
  primary-confirmed.
- The report table's "father / other parent" column is governed by §66(ג)(5)/(5א)
  (married father) — see the allocation addendum. **A discrepancy worth the owner's
  eye:** pkuda-gov defines *"פעוט" = ילד שטרם מלאו לו שש שנים* (§40(ב)(3), via
  תיקון 260/2022) and extends the married father's §66(ג)(5) schedule to **ages 0-5**
  (1½ at birth, 2½ for ages 1-5) plus **§66(ג)(5א)** for 6-12; whereas the **btl** PDF
  quoted in the allocation addendum still had *פעוט = under 4* and limited the father
  to 0-3. The two consolidated texts disagree on the father's range because the btl
  copy is older. The father counts therefore remain **owner-verify against the
  post-2024 §66(ג)(5)** text.

Verbatim from **pkuda-gov §40(ב)(1)** (the **single-parent / משפחה חד-הורית** schedule;
extracted lines ~3920-3928), for cross-check:

> **40.(ב)(1)** …בשל ילדיו כאמור הנמצאים אצלו, **1½ נקודות זיכוי** בשל כל ילד בשנת לידתו ו-**½ נקודת זיכוי** בשל כל ילד בשנת בגרותו, **2½ נקודות זיכוי** בשל כל ילד החל בשנת המס שלאחר שנת לידתו ועד לשנת המס שבה מלאו לו חמש שנים, ו**נקודת זיכוי אחת** בשל כל ילד החל בשנת המס שבה מלאו לו שש שנים ועד לשנת המס שקדמה לשנת בגרותו;

This is the same pre-reform build-up (birth 1½ / ages 1-5 2½ / ages 6-17 1 /
adulthood ½) with the single-parent **+1** bonus added separately by §40(ב)(1ב) —
confirming the single-parent path in the earlier reports. Again pre-reform: add §1
for the toddler ages.

---

## 3. Oleh §35 schedules — CONFIRMED verbatim to the primary ordinance

**Verdict: the 2022+ schedule (54 months / 8.5 points) is CONFIRMED to primary and
is a PERMANENT amendment (תיקון 262), in force for 2024/2025. The pre-2022 schedule
(42 months / 7.5) is superseded and not in the current consolidated text — owner-verify
its transitional application to pre-2022 olim.**

Verbatim from **pkuda-gov §35(א)** (extracted lines ~3812-3852):

> **35.(א)** בחישוב המס של עולה יובאו בחשבון –
> **(1)** 1/12 נקודת זיכוי לכל חודש משנים-עשר החודשים הראשונים מעלייתו לישראל;  *(תיקון 262, תשפ"ב-2022)*
> **(1א)** ¼ נקודת זיכוי לכל חודש משמונה-עשר החודשים שלאחריהם;  *(תיקון 262, תשפ"ב-2022)*
> **(2)** 1/6 נקודת זיכוי לכל חודש בשנים-עשר החדשים שלאחריהם;
> **(3)** 1/12 נקודת זיכוי לכל חודש משנים-עשר החדשים שלאחריהם.
> …
> **(ג)** הזיכוי האמור יינתן לשנת מס שכולה או מקצתה נמצאת בתקופת **54 החודשים** האמורים, לפי מספר החדשים שהעולה ישב בישראל באותה שנה, ולא יינתן אלא בפעם הראשונה שנעשה לעולה; לפי בקשתו לא תובא במנין 54 החודשים תקופת **היעדרות רצופה מהארץ** שאיננה פחותה מששה חדשים ואיננה עולה על שלוש שנים.  *(תיקון 181, תשע"א-2011; תיקון 262, תשפ"ב-2022)*

| Item | Verified value (primary) | Source | Verdict |
|---|---|---|---|
| 2022+ monthly rates | mo 1-12: **1/12** · mo 13-30 (18 mo): **¼** · mo 31-42 (12 mo): **1/6** · mo 43-54 (12 mo): **1/12** | pkuda-gov §35(א)(1),(1א),(2),(3) | CONFIRMED (primary) |
| 2022+ total | 1 + 4.5 + 2 + 1 = **8.5 points over 54 months** | derived from the above | CONFIRMED (primary) |
| Permanent vs הוראת שעה | **Permanent.** תיקון 262 (תשפ"ב-2022) is annotated on §35 **without** a "הוראת שעה" tag — unlike the neighbouring §40/§66 additions, which are expressly *"(תיקון מס' 260 – הוראת שעה)"*. §35 as consolidated shows only the 54-month text as live law. So the report's §3.2 sunset worry is resolved: **the 54-month / 8.5-point schedule is in force for 2024 and 2025.** | pkuda-gov §35 (amendment annotations) | CONFIRMED (primary) |
| Apportionment per tax year | Given for any tax year wholly/partly within the 54 months, **by months resident that year**; once only. | pkuda-gov §35(ג) | CONFIRMED (primary) |
| Clock-pause events | Statute lets the oleh exclude, on request, a **continuous absence from the country of 6 months–3 years** from the 54-month count. The report's "pause for full-time study / army service" is **not in the statute text** — it would rest on regulations under §35(ה); **owner-verify** (statutory pause is absence only). | pkuda-gov §35(ג),(ה) | CORRECTED / owner-verify |
| Pre-2022 schedule (mo 1-18 ¼ · 19-30 1/6 · 31-42 1/12 = **7.5 over 42 mo**) | **Not in the current consolidated text** — it is the pre-תיקון-262 version, superseded. Its figures match the earlier report but could not be re-verified from *this* (current) primary PDF. For olim who made aliyah **before 1.1.2022** but are still inside their benefit window in 2024/2025, which schedule applies is a **transitional-provision** question (הוראת מעבר of תיקון 262, not in the consolidated נוסח). | — | **OWNER-VERIFY** (pre-2022 cohort transition) |

---

## 4. Verdict summary — what is now primary-confirmed vs still owner-verify

**Upgraded to PRIMARY (statute / official announcement) by this addendum:**
1. **Oleh §35, 2022+ schedule** — 1/12, ¼, 1/6, 1/12 monthly bands over 54 months =
   **8.5 points**, **permanent** (תיקון 262), in force **2024/2025**. Fully verbatim
   from pkuda-gov §35(א),(ג). This closes the report's §3.2 UNRESOLVED.
2. **Pre-reform base child schedule** — the mother's §66(ג)(4) build-up (birth 1½,
   ages 1-5 2½, ages 6-12 2, ages 13-17 1, adulthood ½) and the single-parent
   §40(ב)(1) build-up — verbatim from pkuda-gov. Adding the reform (§1) reproduces the
   reports' post-reform totals **birth 2.5 / age1-2 4.5 / age3 3.5 / age4-5 2.5 /
   age18 0.5** — all **confirmed to primary**.
3. **The 2024 reform *split* (+1/+2/+2/+1, six points, ages 0-3)** — confirmed to the
   Tax Authority's **official announcement** (gov-2024law) and, decisively, by the
   **exact arithmetic tie-out** to the primary pre-reform §66(ג)(4)/§40(ב)(1) base.
   Applies **2024 and 2025**, permanent, retroactive to 1.1.2024.

**Still OWNER-VERIFY (fetcher blocked or genuinely stale primary text):**
- **Enacted ס"ח 3184 §40/§66 verbatim.** Both consolidated ordinance PDFs (gov.il and
  btl) are **pre-reform, current only to ~2022**; gov-2024law (gov.il), nevo, and the
  Knesset bill page all failed the fetcher (403 / empty). The reform *counts* are
  confirmed, but the exact amended subparagraph wording/numbering is not yet read from
  רשומות — owner should open ס"ח 3184 or gov-2024law directly.
- **Mother's ages 13-17 count (1 vs 2).** Primary text gives the extra point only for
  6-12 (§66(ג)(4)(ד), frozen to "בשנת 2022"); the full-6-17 "2" for 2024+ is secondary
  (kz-6to17) only.
- **Married father's §66(ג)(5)/(5א) range and counts.** The two consolidated texts
  disagree (btl: פעוט<4, father 0-3; gov.il: פעוט<6, father 0-5 plus 6-12); resolve
  against the **post-2024** §66(ג)(5).
- **Oleh pre-2022 cohort** — which schedule (42-mo/7.5 vs 54-mo/8.5) applies in
  2024/2025 to someone who made aliyah before 1.1.2022 (תיקון 262 transitional rule),
  and confirmation of the study/army clock-pause (statutory pause is absence only).

**Can the credit-points plan's numbers be treated as primary-confirmed?**
- **Oleh 2022+ (8.5 / 54 months): YES** — fully primary.
- **Child post-reform totals for ages 0-5 and age 18: YES** — pre-reform base is
  primary (pkuda-gov) and the reform delta is confirmed by the official announcement +
  arithmetic. The only remaining risk is the *verbatim* enacted text (owner-verify),
  not the numbers.
- **Child ages 6-17 and the father column: NOT YET** — the 13-17 "2" and the father's
  post-2024 range are still secondary; keep them owner-verify.
- **Pre-2022 oleh cohort: NOT YET** — transitional rule unverified.

Net: the plan's **oleh 2022+ schedule and the 0-5 / 18 child counts are now
primary-grounded**; the **6-17 child band, the father allocation counts, the pre-2022
oleh transition, and the verbatim ס"ח 3184 text** remain the open owner-verify items.
