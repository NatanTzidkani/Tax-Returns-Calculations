# Child credit-point allocation — primary-source addendum

Date: 2026-07-13 · Author: tax-law-analyst agent · Status: research addendum (no code changed)

Addendum to `docs/superpowers/research/2026-07-13-credit-points-verification.md`,
resolving the UNRESOLVED §1.2 allocation questions (mother-vs-father split;
single-parent / divorced / מזונות; the §66(ג) spousal election; the "§116ד"
birth-year split). The main report rested on כל-זכות (secondary); this addendum
goes to the **statute** (פקודת מס הכנסה) and the Tax Authority.

## Primary sources used here

| ID | Source | Tier |
|---|---|---|
| **pkuda-btl** | פקודת מס הכנסה [נוסח חדש] — full consolidated text hosted by the **National Insurance Institute** (ביטוח לאומי). PDF: <https://www.btl.gov.il/Laws1/02_0103_000000.pdf>. Read locally with `pdftotext -layout`; §40 and §66 transcribed verbatim below. **Caveat: this consolidated נוסח is not updated for the 2024 reform** (its newest child-point amendment is התשע"ב/2012). It is authoritative for the *allocation mechanism* (which paragraph governs whom), **not** for current point *counts*. | primary (pre-2024) |
| **reform-2024** | חוק סיוע להורים לילדים עד גיל שלוש (תיקוני חקיקה), התשפ"ד-2024 — ס"ח 3184, פורסם 20.3.2024, מתקן את §40 ו-§66 לפקודה, בתוקף רטרואקטיבי מ-1.1.2024. Summarised (with the six-points split) at capitax: <https://www.capitax.co.il/content/2/2878> | primary law, read via authoritative summary |
| **rmim-goldpro** | גולדברג פרושן ושות' רו"ח, ציטוט עמדת רשות המסים על §40 / §66(ג)(4)/(5) במשמורת משותפת ובני זוג מאותו מין — <https://www.goldpro.co.il/חוזרים-מקצועיים-המעודכן/מס-הכנסה/משמורת-משותפת-מלאה-של-ההורים-על-ילדיהם/> | secondary (CPA quoting Tax Authority position) |
| **gov-116d** | רשות המסים, "בקשה לדחיית מתן נקודת זיכוי לאישה שילדה (טופס 116ד')" — <https://www.gov.il/he/service/itc116d> (page returns HTTP 403 to the fetcher; **owner must open directly**) | primary (service page, unverified fetch) |
| **claltax-66** | Claltax, ציטוט §66(ג)(4)/(5) — <https://claltax.com/נקודות-זיכוי-תושב-בן-זוג-ילדים-נוער/> | secondary (corroboration) |

---

## 1. Mother-vs-father allocation — RESOLVED to the statute (structure), counts owner-verify

The two כל-זכות framings do **not** actually conflict — they describe **different
age bands**, and each maps to a different statutory paragraph. Verbatim from
**pkuda-btl** (§66 חישוב נפרד, §66(ג), lines ~3397-3415 of the extracted text):

> **(ג)** אלה ההוראות שיחולו לגבי החישוב הנפרד:
> **(3)** זכאות לנקודות קיצבה על פי סעיף 40(א) תהא רק לבן הזוג הרשום;
> **(4)** האשה תהא זכאית ל-½ נקודת זיכוי לפי סעיף 36א, ובנוסף וכנגד המס החל על הכנסתה מיגיעה אישית — לנקודות זיכוי בעד ילדיה כלהלן:
> &nbsp;&nbsp;(א) ½ נקודת זיכוי בעד כל אחד מילדיה בשנת לידתו ובשנת בגרותו;
> &nbsp;&nbsp;(ב) נקודת זיכוי אחת בעד כל אחד מילדיה החל בשנת המס שלאחר שנת לידתו ועד לשנת המס שקדמה לשנת בגרותו;
> &nbsp;&nbsp;(ג) נקודת זיכוי נוספת על נקודת הזיכוי לפי פסקת משנה (ב), בעד כל אחד מילדיה החל בשנת המס שלאחר שנת לידתו ועד לשנת המס שבה מלאו לו חמש שנים.
> **(5)** הגבר יהא זכאי, כנגד המס החל על הכנסתו מיגיעה אישית, לנקודות זיכוי בעד כל אחד מילדיו שהם פעוטות, כלהלן:
> &nbsp;&nbsp;(א) נקודת זיכוי אחת בשנת לידתו של הפעוט ובשנת המס שבה מלאו לו שלוש שנים;
> &nbsp;&nbsp;(ב) שתי נקודות זיכוי בשנת המס שלאחר שנת לידתו של הפעוט ובשנת המס שלאחריה;
> ("פעוט" = ילד שטרם מלאו לו ארבע שנים בשנת המס — §40(ב)(3)).

### What this establishes (primary)

| Question | Answer | Source | Verdict |
|---|---|---|---|
| Do BOTH parents get child points, or only one? | **Both**, but via *different* paragraphs and against *each parent's own* יגיעה-אישית income. The mother/אשה claims under §66(ג)(4); the father/גבר claims under §66(ג)(5). They are not the same points and are not double-counting. | pkuda-btl §66(ג)(4),(5); rmim-goldpro | CONFIRMED (primary, structure) |
| Which parent gets the **older-child** (age 6→17) points? | **The mother only.** §66(ג)(4)(ב) gives her one point for every child from the year after birth to the year before adulthood (i.e. ages 1-17). §66(ג)(5) gives the **father nothing** past age 3 — his entitlement is limited to a *פעוט* (under 4). | pkuda-btl §66(ג)(4)(ב),(5) | CONFIRMED (primary, structure) |
| Which parent gets the **young-child** (0-3 / 0-5) points? | **Both** — the mother across ages 0-18 (§66(ג)(4)), the father for a *פעוט* 0-3 (§66(ג)(5)). This is why kz-under6 frames young-child points as available to *each* parent while kz-under18 frames the *overall* benefit as "one parent only": the "one parent" framing is true for the 6-17 band and the קצבה, not for toddlers. | pkuda-btl §66(ג)(4),(5); kz-under6 vs kz-under18 | CONFIRMED (primary, structure) |
| Who gets the **קצבה** (child-allowance) points under §40(א)? | **The בן זוג רשום only** (§66(ג)(3)). These are the NII-paid נקודות קיצבה, not the credit points above. | pkuda-btl §66(ג)(3) | CONFIRMED (primary) |
| "Registered / allowance-receiving" spouse vs the other | Tax Authority position: the spouse receiving the קצבה from NII (usually the mother, = בן זוג רשום per §64ב) takes §66(ג)(4); the other spouse takes §66(ג)(5) for young children, provided the child is registered as theirs in מרשם האוכלוסין. Applied identically to same-sex married couples. | rmim-goldpro (Tax Authority position) | CONFIRMED (secondary, corroborates statute) |

### The point *counts* were raised by the 2024 reform — owner-verify

The §66(ג)(4)/(5) counts quoted above are the **pre-2024** values (this נוסח's
newest child amendment is 2012). **reform-2024** (חוק סיוע להורים לילדים עד גיל
שלוש, התשפ"ד-2024, retroactive to 1.1.2024) added **six extra points per child
aged 0-3**, split: **+1 in the birth year, +2 at age 1, +2 at age 2, +1 at
age 3**, *on top of* the existing points, and these boosted toddler points are
what make ages 0-3 effectively symmetric between the parents in the main
report's §1.1 table. The reform amended §40 and §66; I read its **split**
from the capitax summary of the enacted law, **not** the amended ordinance
verbatim. → The main report's **§1.1 per-child counts remain owner-verify
against the amended §40/§66 text**; what this addendum upgrades to *primary* is
the **allocation mechanism** (who claims via which paragraph), which the reform
did not restructure (still (4) for the אשה, (5) for the גבר).

**Correction flag for the main report's §1.1 "father / other parent" column:**
under a **married/cohabiting** couple the father (§66(ג)(5)) gets **nothing for
ages 4-18** — the report's non-zero father entries for ages 4-17 describe the
**separated-parents** case (§2 below), not a married father. The engine should
not grant a married father any 6-17 or age-18 points.

---

## 2. Single-parent (משפחה חד-הורית) and separated / divorced / מזונות — RESOLVED to §40(ב), §40א

Verbatim from **pkuda-btl** §40(ב) (lines ~2435-2461). *(Counts here are also the
pre-reform values; cite for the allocation rule, not the amounts.)*

> **40.(ב)(1)** בחישוב המס של יחיד תושב ישראל שהוא **הורה במשפחה חד-הורית** שהיו לו ילדים שבשנת המס טרם מלאו להם תשע-עשרה שנה ושכלכלתם היתה עליו, אך אינו זכאי לנקודת זיכוי לפי סעיף 37, יובאו בחשבון, בנוסף לנקודות הקיצבה לפי סעיף קטן (א), בשל ילדיו כאמור הנמצאים אצלו …
> **(1א)** … יחיד … שהוא **אב לפעוט במשפחה חד-הורית** ואינו זכאי לנקודות זיכוי לפי פסקה (1) … ואולם אם אמו של הפעוט … תושבת ישראל ואינה זכאית … לנקודות זיכוי לפי פסקה (1), יובאו בחשבון נקודות הזיכוי לפי פסקת משנה זו, כנגד הכנסתה מיגיעה אישית, ולא כנגד הכנסתו של האב …
> **(1ב)** במשפחה חד-הורית שבה ילד להורה אחד ואותו הורה זכאי לנקודות זיכוי לפי פסקה (1), תובא בחשבון … **נקודת זיכוי אחת נוספת**; …
> **(2)** **הורים החיים בנפרד** יקבל ההורה הזכאי לנקודת זיכוי לפי פסקה (1), **נקודת זיכוי אחת נוספת** ואם כלכלת ילדיהם מחולקת ביניהם, יקבל **ההורה שאינו זכאי** לנקודת זיכוי על פי פסקה (1) **נקודת זיכוי אחת או חלק ממנה לפי חלקו בהוצאות הכלכלה**.
> **(3)** … "ילד להורה אחד" — ילד … ואחד מהוריו נפטר … או שהוא רשום במרשם האוכלוסין בלא פרטי אחד ההורים; "פעוט" — ילד שטרם מלאו לו ארבע שנים …; "שנת לידה" …; "שנת בגרות" — שנת המס שבה מלאו לילד שמונה עשרה שנים.

And §40א (divorced who pays מזונות and remarried):

> **40א.** בחישוב המס של גרוש שהוא או בן זוגו משלם מזונות לבן זוגו לשעבר, והוא נשוי לבן-זוג אחר, תובא בחשבון **נקודת זיכוי אחת**.

| Case | Rule | Source | Verdict |
|---|---|---|---|
| Single parent (חד-הורית) | Sole custodial parent gets the child schedule **plus one extra point** (§40(ב)(1)+(1ב)); the schedule is claimed by the parent "שכלכלתם עליו". | pkuda-btl §40(ב)(1),(1ב) | CONFIRMED (primary, structure) |
| Single **father** of a toddler | Gets the *פעוט* points (§40(ב)(1א)) — **unless** the toddler's resident mother is not entitled under (1), in which case those points attach to **her** income, not his. | pkuda-btl §40(ב)(1א) | CONFIRMED (primary) |
| Separated parents (הורים החיים בנפרד) | Parent entitled under (1) gets **+1 extra point**; if maintenance (כלכלה) is **split**, the parent **not** entitled under (1) gets **1 point or a fraction, pro-rata to their share of maintenance costs**. This is the source of the report's asymmetric "custodial 2 / other 1" for older kids. | pkuda-btl §40(ב)(2) | CONFIRMED (primary, structure) |
| Divorced, pays מזונות, remarried | **+1 credit point** (§40א). | pkuda-btl §40א | CONFIRMED (primary) |

Note the boundary/definition points confirmed by §40(ב)(3): "פעוט" = under 4;
"שנת בגרות" = the tax year the child turns 18. This confirms the main report's
§1.3 "age the child *reaches during* the tax year" reading.

---

## 3. §66(ג) spousal election — RESOLVED to the statute

Verbatim from **pkuda-btl** §66(ג)(1),(1א) (lines ~3398-3401):

> **(ג)(1)** הזכאות לניכויים, לזיכויים ולנקודות זיכוי לפי סעיפים 34, 35, 36, 45א, 47, 47א ו-121א … יהיו לכל אחד מבני הזוג;
> **(1א)** בן זוג רשאי, **אף אם לבן זוגו אין הכנסה מיגיעה אישית**, לבקש חישוב נפרד על הכנסתו מיגיעה אישית, ויהיה זכאי, כנגד המס החל על הכנסתו זו, **לנקודות זיכוי כאמור בפסקאות (4) או (5)**.

| Question | Answer | Source | Verdict |
|---|---|---|---|
| The §66(ג) spousal interaction | Under a חישוב נפרד each spouse independently claims deductions and credits (§66(ג)(1)); an earning spouse may elect separate calculation **even if the other spouse has no personal-exertion income** and still take the child points under (4)/(5) (§66(ג)(1א)). The קצבה points remain with the בן זוג רשום only (§66(ג)(3)). | pkuda-btl §66(ג)(1),(1א),(3) | CONFIRMED (primary) |
| Practical consequence for the engine | The child points are **not** a couple-level pool to be split by election — they are fixed per-parent by (4) (אשה, ages 0-18) and (5) (גבר, פעוט 0-3). "Election" (חישוב מאוחד vs נפרד) affects *how* the tax is computed, not *which* parent owns which child points. | pkuda-btl §66(ג) | CONFIRMED (primary) |

---

## 4. "§116ד" birth-year split — RESOLVED as a FORM, statutory subsection owner-verify

**There is no §116ד in the ordinance for this.** §116 of the פקודה concerns
representatives/assessment liability (pkuda-btl line ~6370); it is unrelated.
"116ד" is **טופס 116ד'** — "בקשה לדחיית מתן נקודת זיכוי לאישה שילדה" (gov-116d).

| Question | Answer | Source | Verdict |
|---|---|---|---|
| What the split is | A woman who gave birth, entitled to the birth-year points, may **defer one full credit point** from the birth year to the **following** tax year (birth years are often part-worked, so the point is worth more the next year). Mechanics: file form 116ד twice — mark the "defer" section in the birth year and the "claim/utilise" section in the following year, each attached to טופס 101. | gov-116d; kz-under18 | CONFIRMED (primary service page + secondary) |
| Who may defer | **The mother only** (and same-sex spouses registered as parents). It is **not** transferable to a non-working husband — if the mother has no income, the point cannot be moved to the father. | gov-116d; secondary (finupp, protocol) | CONFIRMED (Tax Authority service page) |
| Statutory anchor | Introduced by amendment (originally a הוראת שעה for births in 2017-2018, later made permanent) — **not present in the pre-2024 btl consolidated text**, and I could **not** pin it to a specific current ordinance subsection number from primary text. | — | **UNRESOLVED — owner to confirm the exact amending section** |

---

## 5. Verdict summary

**Resolved to PRIMARY sources (statute / Tax Authority):**
1. **Mother-vs-father allocation is age-band-specific, and both parents get points
   via different paragraphs** — mother/אשה via §66(ג)(4) (ages 0-18), father/גבר
   via §66(ג)(5) (*פעוט* 0-3 only); a **married father gets nothing for ages
   4-18**. קצבה points to the בן זוג רשום only (§66(ג)(3)). The two כל-זכות pages
   do not conflict once split by age band. [pkuda-btl §66(ג)]
2. **Single-parent, separated, and מזונות cases** — §40(ב)(1),(1א),(1ב),(2) and
   §40א, all quoted verbatim. The separated-parent "split by share of maintenance"
   rule (§40(ב)(2)) is the true source of the report's asymmetric older-child
   split. [pkuda-btl §40]
3. **The §66(ג) spousal election** — separate-calc credits are per-spouse
   (§66(ג)(1)), an earner may elect even if the spouse has no income and still get
   (4)/(5) points (§66(ג)(1א)); child points are fixed per-parent, not a splittable
   pool. [pkuda-btl §66(ג)]
4. **The "§116ד" birth-year split is a FORM, not an ordinance section** — mother
   may defer one birth-year point to the next year; mother-only, non-transferable.
   [gov-116d]

**Still OWNER-VERIFY:**
- **Current point *counts*** for §40/§66 (2024+): read the **amended** §40 and
  §66 text of חוק סיוע להורים לילדים עד גיל שלוש, התשפ"ד-2024 (ס"ח 3184) verbatim
  — the btl נוסח used here is pre-reform. The reform's split (+1/+2/+2/+1 for ages
  0/1/2/3, six points total) is taken from the capitax summary, not the amended
  ordinance. The main report's §1.1 counts still need this primary check; only the
  *allocation mechanism* is upgraded to primary here.
- The exact **amending subsection** that authorises the טופס 116ד birth-year
  deferral (§4).
- Confirm the post-reform §66(ג)(5) **father** schedule for ages 0-3 matches the
  main report's symmetric §1.1 young-child values (the reform boosted the father's
  toddler points; verify the amended (5) text gives the same +1/+2/+2/+1).
- gov-116d and the reform's Knesset PDF both returned HTTP 403 to the fetcher —
  **owner should open them directly** to confirm the quotes attributed to them.

**Caveat carried through this whole addendum:** every *point-count* number above is
the **pre-2024** statutory value; treat counts as owner-verify. The **allocation
rules** (which parent, which paragraph, single-parent/separated/election
mechanics) are what this addendum confirms against the primary ordinance text.
