# ס"ח 3184 & parent allocation — primary-source addendum (the three gates)

Date: 2026-07-14 · Author: tax-law-analyst agent · Status: research addendum (no code changed)

Addendum to `docs/superpowers/research/2026-07-13-credit-points-allocation-addendum.md`
and `docs/superpowers/research/2026-07-13-credit-points-counts-addendum.md`, targeting
the three primary-source gaps that keep parent-allocation engine branches disabled
(plan checklist, `docs/superpowers/plans/2026-07-13-parent-allocation.md`
"⚠️ Owner must verify before merge"):

1. the פעוט definition / married-father §66(ג)(5) age range (btl "under 4" vs gov.il "under 6");
2. the mother's 6–17 band count (1 vs 2) for 2024/2025;
3. the §66(ג)(3) קצבה point count.

**Headline: the enacted ס"ח 3184 was obtained verbatim** (the Knesset file server
hosts the רשומות PDF — the host every earlier attempt missed), together with two
official Tax Authority instructions to employers and the current consolidated
§40/§66 text. **All three questions are closed** (Q1 and Q2 CONFIRMED with one
narrow residue; Q3 CONFIRMED outright), and two of the earlier reports' standing
assumptions are **corrected**: the "פעוט" gate no longer exists in the child
schedules at all, and a married father is *not* zero for ages 6–17 — he gets 1
point.

## Sources — with honest fetch results

| ID | Source | Tier | Fetch result |
|---|---|---|---|
| **sah3184** | **חוק סיוע להורים לילדים עד גיל שלוש (תיקוני חקיקה), התשפ"ד-2024** — ס"ח 3184, 20.3.2024 (תיקון עקיף מס' **271** לפקודה), the enacted רשומות PDF on the Knesset file server: <https://fs.knesset.gov.il/25/law/25_lsr_4239836.pdf> | **primary (enacted law, רשומות)** | **200 OK** (260 KB); read via `pdftotext -layout`. §1 (the §40/§66 amendments) and §3 (commencement) transcribed below |
| **ita-260324** | רשות המסים, הוראה לפקידי השומה/מעסיקים 2024-001090 (26.3.2024) על ס"ח 3184 — <https://www.gov.il/BlobFolder/dynamiccollectorresultitem/employers-info-260324/he/IncomeTax_employers-info-260324.pdf> | primary (Tax Authority instruction) | **200 OK** (107 KB) |
| **ita-030124** | רשות המסים, הוראה 2024-000012 (3.1.2024) על **ס"ח 3048** — חוק הגדלת נקודות זיכוי להורים במס הכנסה והרחבת מענק עבודה, התשפ"ג-2023 (the 6–17 extension), incl. per-parent tables — <https://www.gov.il/BlobFolder/dynamiccollectorresultitem/employers-info-030124/he/IncomeTax_employers-info-030124.pdf> | primary (Tax Authority instruction) | **200 OK** (135 KB) |
| **pkuda-gov** | פקודת מס הכנסה [נוסח חדש], gov.il consolidated PDF (same file as the counts addendum; current to ~2022) — used here for the **pre-2024 baseline** §40(א)/(ב)(3), §66(ג)(5)/(5א) | primary (pre-reform baseline) | **200 OK** (10.8 MB), re-downloaded and re-extracted |
| **wikisource** | he.wikisource.org, פקודת מס הכנסה — community-maintained consolidated text, amendment-annotated, current through the תשפ"ד child-point amendments (raw wikitext via `action=raw`): <https://he.wikisource.org/wiki/פקודת_מס_הכנסה> | secondary (transcription of רשומות; precise annotations) | **200 OK** (1.5 MB wikitext); §40 + §66 extracted |
| **kz-6to17** | כל-זכות, נקודות זיכוי להורים לילדים בגיל 6–17 — <https://www.kolzchut.org.il/he/נקודות_זיכוי_ממס_הכנסה_להורים_לילדים_בגיל_17-6> | secondary | fetched OK (in-force status for 2025/2026 confirmed, no sunset) |
| **BLOCKED: nevo-3048** | nevo.co.il full text of ס"ח 3048's law (`law_html/law11/090323.htm`) | — | **302 → login wall** (`/Authentication/UserLogin.aspx`); not readable |
| **BLOCKED: nevo-pdf** | nevo direct רשומות PDF guesses (`law_word/law14/law-3184.pdf` etc.) | — | **302 → 404** |
| **BLOCKED: knesset-lawbill** | main.knesset.gov.il LawBill pages (lawitemid **2202778** = the 2023 law, **482355** = the 2024 law) | — | JS shell — fetches return an empty page (HTTP 247/anomalous, 573 bytes; no fs links in markup) |
| **BLOCKED: rfa-justice** | rfa.justice.gov.il (Ministry of Justice רשומות search API document for the 2023 הוראת-שעה law) | — | **DNS resolution failure** from this container |
| *(not retried)* | gov.il announcement `sa050324-2` (403'd in the counts addendum) | — | superseded by ita-260324, which is the same content as a fetchable PDF |

**The one primary text still unread:** the enacted **ס"ח 3048** (7.6.2023,
"חוק הגדלת נקודות זיכוי להורים במס הכנסה והרחבת מענק עבודה, התשפ"ג-2023") —
every host carrying it verbatim is login-walled/JS/DNS-blocked. Its *effect* is
confirmed three ways below (ITA instruction ita-030124 + the consolidated text +
the fact that sah3184's drafting only parses against the post-3048 text). Owner
pointer if desired: nevo `law_html/law11/090323.htm` (behind free login) or the
Knesset law page lawitemid 2202778.

---

## 1. Q1 — פעוט definition / father §66(ג)(5) range: CONFIRMED (primary), and the question itself is superseded

### 1a. The btl-vs-gov.il conflict was a staleness artefact

The gov.il consolidated baseline (pkuda-gov, ~2022) already reads, **§40(ב)(3)**:

> "פעוט" – ילד שטרם מלאו לו שש שנים בשנת המס;   *(תיקון מס' 247) תשע"ח-2018*

and **§66(ג)(5)** (annotated תיקון 247, תשע"ח-2018 — *permanent*, not הוראת שעה):

> (5) הגבר יהא זכאי, כנגד המס החל על הכנסתו מיגיעה אישית, לנקודות זיכוי בעד כל אחד מילדיו שהם פעוטות, כלהלן:
> (א) ½1 נקודות זיכוי בשנת לידתו של הפעוט;
> (ב) ½2 נקודות זיכוי החל בשנת המס שלאחר שנת לידתו של הפעוט ועד לשנת המס שבה מלאו לו חמש שנים;

So **פעוט = under 6 since תיקון 247 (2018)**; the btl PDF's "under 4" (father
0–3) is simply a pre-2018 נוסח. That conflict is resolved — but the 2024 law
went further, so the פעוט range is no longer even the operative question:

### 1b. The enacted ס"ח 3184 — verbatim (primary)

From the רשומות PDF (sah3184), §1 — תיקון פקודת מס הכנסה מס' 271:

> **1.** בפקודת מס הכנסה (להלן - הפקודה) -
> **(1)** בסעיף 40(ב) -
> (א) בפסקה (1), במקום הסיפה החל במילים "½1 נקודות זיכוי" יבוא "**½2 נקודות זיכוי בשל כל ילד בשנת לידתו ו־½ נקודת זיכוי בשל כל ילד בשנת בגרותו, ½4 נקודות זיכוי בשל כל ילד החל בשנת המס שלאחר לידתו ועד לשנת המס שבה מלאו לו שנתיים, ½3 נקודות זיכוי בשל כל ילד בשנת המס שבה מלאו לו שלוש שנים, ½2 נקודות זיכוי בשל כל ילד בשנות המס שבהן מלאו לו ארבע שנים וחמש שנים ושתי נקודות זיכוי בשל כל ילד החל בשנת המס שבה מלאו לו שש שנים ועד לשנת המס שקדמה לשנת בגרותו**";
> (ב) בפסקה (1א) -
> (1) בפסקת משנה (א), במקום "½1 נקודות זיכוי" יבוא "½2 נקודות זיכוי";
> (2) במקום פסקת משנה (ב) יבוא:
> "(ב) **½4 נקודות זיכוי בשל כל ילד החל בשנת המס שלאחר לידתו ועד לשנת המס שבה מלאו לו שנתיים, ½3 נקודות זיכוי בשל כל ילד בשנת המס שבה מלאו לו שלוש שנים ו–½2 נקודות זיכוי בשל כל ילד בשנות המס שבהן מלאו לו ארבע שנים וחמש שנים**;";
> **(2)** בסעיף 66(ג) -
> (א) בפסקה (4)(א), במקום הרישה עד המילים "חמש שנים" יבוא "**½2 נקודות זיכוי בעד כל אחד מילדיה בשנת לידתו, ו–½ נקודת זיכוי בעד כל אחד מילדיה בשנת בגרותו, ½4 נקודות זיכוי בעד כל אחד מילדיה החל בשנת המס שלאחר שנת לידתו ועד לשנת המס שבה מלאו לו שנתיים, ½3 נקודות זיכוי בעד כל אחד מילדיה בשנת המס שבה מלאו לו שלוש שנים, ½2 נקודות זיכוי בעד כל אחד מילדיה בשנות המס שבהן מלאו לו ארבע שנים וחמש שנים**";
> (ב) בפסקה (5) -
> (1) בפסקת משנה (א), במקום "½1 נקודות זיכוי" יבוא "½2 נקודות זיכוי";
> (2) במקום פסקת משנה (ב) יבוא:
> "(ב) **½4 נקודות זיכוי בשל כל ילד החל בשנת המס שלאחר לידתו ועד לשנת המס שבה מלאו לו שנתיים, ½3 נקודות זיכוי בשנת המס שבה מלאו לו שלוש שנים, ו–½2 נקודות זיכוי בשנות המס שבהן מלאו לו ארבע שנים וחמש שנים**;".
> **3.** תחילתם של סעיפים 40 ו־66 לפקודה, כנוסחם בסעיף 1 לחוק זה, ביום כ' בטבת התשפ"ד (**1 בינואר 2024**).

No sunset — a permanent amendment, retroactive to 1.1.2024. (This also closes
the counts addendum's "enacted ס"ח 3184 verbatim" owner-verify item.)

### 1c. The resulting consolidated father schedule for 2024/2025

The current consolidated §66(ג)(5) (wikisource; §40/§66 amendment annotations
end at תשפ"ד — nothing later touches the child paragraphs):

> (5) הגבר יהא זכאי, כנגד המס החל על הכנסתו מיגיעה אישית, לנקודות זיכוי **בעד כל אחד מילדיו**, כלהלן:
> (א) ½2 נקודות זיכוי בשנת לידתו של הילד;
> (ב) ½4 נקודות זיכוי בשל כל ילד החל בשנת המס שלאחר לידתו ועד לשנת המס שבה מלאו לו שנתיים, ½3 נקודות זיכוי בשנת המס שבה מלאו לו שלוש שנים, ו־½2 נקודות זיכוי בשנות המס שבהן מלאו לו ארבע שנים וחמש שנים;
> (ג) **נקודת זיכוי אחת בעד כל אחד מילדיו החל בשנת המס שבה מלאו לו שש שנים ועד לשנת המס שקדמה לשנת בגרותו**;
> (5א) *(פקעה)*

and **§40(ב)(3)**: "פעוט" – *(נמחקה)*. The 2022 baseline's "שהם פעוטות" gate and
the (5א) 6–12 הוראת שעה are gone: the restriction was **replaced by explicit age
bands** (0–5 boosted schedule + 1 point for 6–17), and the פעוט definition was
**deleted** from §40(ב)(3). §40(ב)(1א) likewise now reads "אב **לילד** במשפחה
חד-הורית" with its own (ג) granting 1 point for ages 6–17; its proviso (points
attach to the mother's income when she is not entitled under (1)) survives
verbatim. The corresponding grant-side פעוט concept lives on only in the מענק
עבודה sections that ס"ח 3184 §2 added (its own definition, "ילד... שטרם מלאו לו
שלוש שנים" — irrelevant to credit points).

The restructure itself (bands instead of פעוט; the (ג) 6–17 rows) entered via
**ס"ח 3048** — see Q2 residue note. That sah3184 amends "פסקת משנה (ב)" of (5)
and (1א) and a (4)(א) רישה running "עד המילים 'חמש שנים'" is itself enacted-
primary proof it operates on the post-3048 structure, not the 2022 baseline.

| Question | Engine assumption (disabled branch) | Verified answer (2024 & 2025) | Source | Verdict |
|---|---|---|---|---|
| פעוט age range for father schedules | btl "under 4" vs gov.il "under 6" — shipped as a loud throw | **Superseded**: פעוט definition deleted from §40(ב)(3); father §66(ג)(5) covers **all his children** by explicit bands | sah3184 §1(2)(ב); wikisource §66(ג)(5), §40(ב)(3); ita-260324; ita-030124 | **CONFIRMED (primary)** |
| Married-father per-age counts | not shipped | birth **2.5** · ages 1–2 **4.5** · age 3 **3.5** · ages 4–5 **2.5** · ages 6–17 **1** · age 18 **0** (no בגרות point in (5)) | sah3184 §1(2)(ב) (0–5); ita-030124 table 3.2 + wikisource (5)(ג) (6–17) | **CONFIRMED** (0–5 enacted-primary; 6–17 primary-administrative, see Q2 residue) |
| Single father §40(ב)(1א) | not shipped | birth **2.5** · 1–2 **4.5** · 3 **3.5** · 4–5 **2.5** · 6–17 **1** (no adulthood ½); mother-not-entitled proviso unchanged | sah3184 §1(1)(ב); wikisource §40(ב)(1א)(א)–(ג) | **CONFIRMED** (same split as above) |

Note the ITA's own summary table (ita-260324 §3, "לכל הורה"): שנת לידה 1.5→**2.5**,
age 1 2.5→**4.5**, age 2 2.5→**4.5**, age 3 2.5→**3.5** from 2024 — parent-symmetric,
exactly the enacted numbers.

---

## 2. Q2 — mother's 6–17 band (1 vs 2) for 2024/2025: CONFIRMED = 2 (and the father/other parent = 1, not 0)

### The evidence chain

**(a) Enacted primary (sah3184 §1(1)(א), quoted above):** the new §40(ב)(1)
single-custodial-parent סיפה ends "**ושתי נקודות זיכוי בשל כל ילד החל בשנת המס
שבה מלאו לו שש שנים ועד לשנת המס שקדמה לשנת בגרותו**" — **2 points, ages 6–17**,
enacted in רשומות, in force 1.1.2024, no sunset.

**(b) Tax Authority instruction (ita-030124, on ס"ח 3048), verbatim:**

> ביום 7.6.2023 פורסם בספר החוקים 3048... תוקנו בין היתר, סעיפים 40 ו-66 לפקודת מס הכנסה ונקבע כי, החל משנת המס 2024 תובא בחישוב המס **נקודת זיכוי נוספת** להורה בעבור כל ילד שבשנת המס מלאו לו 6 שנים וטרם מלאו לו 18 שנים.
> ...בשנים 2022 ו-2023 במסגרת הוראת שעה נקבע כי תובא... נקודת זיכוי נוספת... בעבור כל ילד שבשנת המס מלאו לו 6 שנים וטרם מלאו לו 13 שנים וזאת עד ליום 31.12.2023.
>
> 3.1 נקודות זיכוי **לאשה נשואה ולהורה במשפחה חד הורית שילדיו בחזקתו (ומקבל קצבת ילדים בגינם)**:
> גיל 6-12: הוראת שעה 2022,2023 → 2 · מ-2024 → **2**
> גיל 13-17: הוראת שעה 2022,2023 → 1 · מ-2024 → **2**
>
> 3.2 נקודות זיכוי **לגבר נשוי ולהורה במשפחה חד הורית שילדיו אינם בחזקתו או שאינו מקבל קצבת ילדים בגינם**:
> גיל 6-12: → 1 · מ-2024 → **1**
> גיל 13-17: → 0 · מ-2024 → **1**
>
> 3.3 בחישוב המס של **הורה יחיד** יובאו בחשבון הן נקודות הזיכוי המפורטות בפסקה 3.1 והן נקודות הזיכוי המפורטות בפסקה 3.2.

**(c) Current consolidated §66(ג)(4)(א)** (wikisource; the tail after "חמש שנים"
survived sah3184's רישה replacement):

> (א) ½2 נקודות זיכוי בעד כל אחד מילדיה בשנת לידתו, ו־½ נקודת זיכוי... בשנת בגרותו, ½4... עד לשנת המס שבה מלאו לו שנתיים, ½3... שלוש שנים, ½2... ארבע שנים וחמש שנים, **ושתי נקודות זיכוי בעד כל אחד מילדיה החל בשנת המס שבה מלאו לו שש שנים ועד לשנת המס שקדמה לשנת בגרותו**;
> (א1) על אף האמור בפסקת משנה (א), אמו של ילד תהיה זכאית לבחור אם נקודת זיכוי אחת מתוך נקודות הזיכוי... בשנת הלידה, תובא בחשבון בשנת המס שבה נולד הילד או בשנת המס שלאחריה;
> (ב) *(נמחקה)*; (ג) *(נמחקה)*; (ד) *(פקעה)*

So the counts addendum's mismatch is resolved: §66(ג)(4)(ד)'s "אשר בשנת 2022"
wording was the expired 2022–2023 הוראת שעה; from 2024 the 2-point rate for the
full 6–17 band is folded into (4)(א) itself (and §40(ב)(1)) by ס"ח 3048. כל-זכות's
"2" was **correct**, not a misreading. kz-6to17 confirms it remains in force
(2025/2026, no sunset); the 2024 freeze law is irrelevant (it freezes indexed
*amounts*; these are statutory point counts).

**Correction to the allocation addendum (§1/§5):** "a married father gets
nothing for ages 4-18" was true only of the stale btl text. Under 2024/2025 law
the married father (§66(ג)(5)) gets the full 0–5 schedule **and 1 point for each
child aged 6–17** (0 only at 18).

| Question | Engine assumption (disabled branch) | Verified answer (2024 & 2025) | Source | Verdict |
|---|---|---|---|---|
| Mother / custodial 6–17 count | "2 custodial" — shipped as loud throw pending verification | **2 points per child** (each of ages 6–17) | sah3184 §1(1)(א) (enacted, §40(ב)(1)); ita-030124 table 3.1; wikisource §66(ג)(4)(א) | **CONFIRMED** |
| Father / other-parent 6–17 count | "1 other" — same throw | **1 point per child** | ita-030124 table 3.2; wikisource §66(ג)(5)(ג), §40(ב)(1א)(ג) | **CONFIRMED** |
| הורה יחיד (ילד להורה אחד) | — | claims **both** columns (3.1 + 3.2), i.e. 6–17 = 3; matches consolidated §40(ב)(1ב) "וכן יובאו בחשבון... גם נקודות הזיכוי לפי אותה פסקה [(1א)]" | ita-030124 §3.3; wikisource §40(ב)(1ב) | CONFIRMED (new detail — see engine impact) |
| Income-source restriction | open question in the base plan | §66(ג)(4)/(5) points remain "כנגד המס החל על הכנסתה/ו **מיגיעה אישית**" — unchanged | wikisource §66(ג)(4),(5) | CONFIRMED (unchanged) |

**Residue (the only soft spot, stated plainly):** the *enacted wording* of
ס"ח 3048 itself — which created the 6–17 rows and restructured (4)(א)/(5)/(1א)
into bands — was **not read from רשומות** (nevo login wall; Knesset JS pages;
justice-ministry DNS failure). The *numbers* are nonetheless multi-source
primary: the Tax Authority's binding instruction states them in tables, the
enacted sah3184 both presupposes the restructure and enacts the identical
2-point 6–17 tail for §40(ב)(1), and the consolidated text agrees. Grade the
6–17 counts **CONFIRMED (primary administrative + enacted corroboration)**; if
the owner wants רשומות-verbatim closure, open ס"ח 3048 (7.6.2023) directly.

---

## 3. Q3 — §66(ג)(3) קצבה point count: CONFIRMED — not a tax-computation credit at all (0 in the return)

**§40(א) verbatim** (pkuda-gov, annotated תיקון מס' 99, תשנ"ד-1994; wikisource's
current text is word-identical — unchanged by the 2023/2024 laws):

> **40.(א)** יחיד תושב ישראל זכאי לנקודות קיצבה בשל כל אחד מילדיו, כקבוע בסעיף 109 לחוק הביטוח הלאומי [נוסח משולב], התשכ"ח-1968; **תשלום נקודות הקיצבה ייעשה בידי המוסד לביטוח לאומי לפי חוק הביטוח הלאומי.**

And the §33א definition (pkuda-gov):

> "נקודת קיצבה" - סכום השווה לסכום נקודת זיכוי כערכה ביום כ"א בטבת תשנ"ז (31 בדצמבר 1996), כשהוא מתואם לפי הוראות סעיף 120ב לענין נקודת קיצבה ומחולק בשנים עשר.

So since תיקון 99 (1994), the §40(א) "נקודות קיצבה" are **paid out by the
National Insurance Institute as part of the child allowance (קצבת ילדים)** —
they are a payment channelled through btl, **not a credit taken in the income-tax
computation**. §66(ג)(3) ("זכאות לנקודות קיצבה על פי סעיף 40(א) תהא רק לבן הזוג
הרשום") merely assigns that extra-tax entitlement to the registered spouse. The
ITA's own 2024 table headings corroborate the reading: receiving the קצבה is an
*eligibility marker* for the mother-column of the credit tables ("ומקבל קצבת
ילדים בגינם"), never a credit line of its own.

| Question | Engine value (stub) | Verified value | Source | Verdict |
|---|---|---|---|---|
| §66(ג)(3)/§40(א) קצבה points in the annual tax computation | `CHILD_ALLOWANCE_TWELFTHS = 0` **as an owner-verify placeholder** with a "הכמות טרם אומתה" label | **0 — definitively.** The points exist but are NII-paid (קצבת ילדים), outside the tax computation; there is no non-zero count to enter on a return | pkuda-gov / wikisource §40(א), §33א | **CONFIRMED (primary)** — the stub's *value* stands; its *label/status* should change from "unverified" to "NII-paid, no return-side effect" |

Peripheral flag (out of engine scope, noted for completeness): §38/§39 (working/
assisting-spouse credits under a *joint* computation) still vary by §40(א)
entitlement — "1½ נקודות זיכוי אם הם אינם זכאים לנקודת קיצבה לפי סעיף 40(א),
ו-1¾ נקודות זיכוי אם הם זכאים" (pkuda-gov). The engine models neither section.

---

## 4. Bonus finding — the טופס 116ד statutory anchor (closes allocation addendum §4 UNRESOLVED)

The birth-year one-point deferral **is** in the ordinance: **§66(ג)(4)(א1)** and
**§40(ב)(1א1)** (both annotated תיקון מס' 247, תשע"ח-2018 in pkuda-gov; quoted in
§2(c) above). The allocation addendum's "could not pin the amending subsection"
item is closed: cite §66(ג)(4)(א1) / §40(ב)(1א1) (תיקון 247) in the engine's
`birthYearDeferral` `// source:` comments. Mother-only framing confirmed by the
text ("אמו של ילד תהיה זכאית לבחור"). ita-260324 restates the mechanic for the
boosted 2024 birth-year points ("האישה רשאית להעביר נקודת זיכוי אחת מתוך 2.5
נקודות הזיכוי... לשנה שלאחר שנת הלידה").

---

## 5. Verdict summary

| # | Gate (plan checklist) | Verdict |
|---|---|---|
| 1 | Exact פעוט range for father Schedule B | **CONFIRMED (primary, enacted ס"ח 3184 + consolidated text)** — and superseded: no פעוט gate exists in 2024/2025 law; father schedule = 2.5 / 4.5 / 4.5 / 3.5 / 2.5 / 2.5 (ages 0–5) + **1** (ages 6–17) + 0 (age 18) |
| 2 | Mother's 6–17 count (1 vs 2) | **CONFIRMED = 2** for 2024 and 2025 (enacted §40(ב)(1) tail + ITA tables + consolidated §66(ג)(4)(א)); father/other parent = **1**; הורה יחיד stacks both. Residue: ס"ח 3048's own רשומות wording unread (login-walled) — numbers are primary via the ITA instruction and sah3184 corroboration |
| 3 | §66(ג)(3) קצבה count | **CONFIRMED = 0 in the tax computation** — NII-paid via קצבת ילדים (§40(א), תיקון 99/1994); not a placeholder anymore |
| — | (bonus) 116ד statutory anchor | **CONFIRMED**: §66(ג)(4)(א1) / §40(ב)(1א1), תיקון 247 תשע"ח-2018 |

---

## 6. Engine impact — exactly which disabled branch each verdict unblocks

*(No code changed by this addendum; owner review gates all of the below.)*

1. **Father Schedule B — `src/jurisdictions/il/rules/child-allocation.ts`, the
   `marriedOtherSpouse` / `singleFatherOfToddler` loud-throw** ("father §66(ג)(5)
   פעוט schedule not yet owner-verified"). Q1+Q2 unblock it, but **not as the
   plan drew it**: Schedule B is *not* "פעוט-only, 0 above the cutoff". The
   verified father column is the `other`-role column of the tables file — ages
   0–5 identical to the mother's (already encoded `[30,54,54,42,30,30]` twelfths,
   now enacted-primary), **12 twelfths (1 point) for each of ages 6–17**, and 0
   at 18 (already encoded `[.., 0]`). The plan's regime table note "a married
   father gets nothing for ages 4–18" and the allocation addendum's matching
   correction flag are themselves **corrected** by this addendum. The
   `singleFatherOfToddler` regime should also be renamed/re-scoped (statute now
   says "אב **לילד** במשפחה חד-הורית", full 0–17 schedule); its
   `motherClaimsUnderSection1 === false` → attach-to-her-income guard survives
   verbatim in current law. Update the branch's `// source:` comments to this
   addendum (§1b/§1c) and drop the פעוט terminology.

2. **The 6–17 band — `src/jurisdictions/il/rules/credit-points-tables.ts`,
   `CHILD_POINT_TWELFTHS` missing-row throw** ("the 6-17 age-band point count is
   not yet owner-verified"). Q2 unblocks it for both roles: add ages 6–17 as
   `[24, 12]` twelfths (custodial 2 pts / other 1 pt), valid for tax years 2024
   and 2025, permanent, no sunset; income-source restriction unchanged (against
   יגיעה-אישית income under the §66(ג) regimes). This also unblocks the
   worksheet form's disabled 6–17 child band (the web taxpayer form's loud
   server-error path stays for other invalid ages).

3. **The קצבה stub — `child-allocation.ts` `CHILD_ALLOWANCE_TWELFTHS` (0 + TODO
   label in `flatAdditionTwelfths`)**. Q3 resolves it: keep the value **0**, but
   change its meaning from "owner-verify placeholder" to a **verified statutory
   0-in-computation** — relabel (e.g. "נקודות קצבה משולמות על ידי המוסד לביטוח
   לאומי במסגרת קצבת הילדים — אינן נזקפות בחישוב המס") and cite §40(א)+§33א via
   this addendum. Arguably the `receivesChildAllowance` row can then be dropped
   from the breakdown entirely (a permanent-0 informational row), or kept as an
   audit line — owner's call.

4. **New detail the plan must absorb (not previously modelled):** the הורה-יחיד
   (ילד להורה אחד) case stacks *both* columns per ita-030124 §3.3 /
   §40(ב)(1ב) — i.e. `singleParent` with a deceased/unregistered other parent
   gets Schedule A **plus** the (1א) father-column points **plus** the +1
   (1ב) bonus. The current plan's `singleParent` regime models only Schedule A
   + 1. Needs a plan amendment (or an explicit reviewer input) before the
   regime ships; until then the fail-loud/additionalCreditPoints fallback
   stands for that sub-case.

5. **Source-comment upgrades (no behaviour change):** `birthYearDeferral` rows →
   cite §66(ג)(4)(א1)/§40(ב)(1א1) (תיקון 247) per §4 above; the 0–5 child rows in
   `credit-points-tables.ts` can upgrade their citation from the kolzchut-based
   report to sah3184 (enacted verbatim, this addendum §1b).

Still open for the owner after this addendum: only the ס"ח 3048 רשומות-verbatim
nicety (Q2 residue) and the plan's own non-source gates (rounding convention for
§40(ב)(2) fractional points, election automation, same-sex framing, age
semantics — unchanged by this research).
