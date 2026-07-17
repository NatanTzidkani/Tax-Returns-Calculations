# Research source registry — every externally fetched page, once

**Rule (owner instruction, 2026-07-16):** record each page fetched during tax-law
research here so the same page is never re-worked twice. Before fetching a
source, check this registry; after fetching, add a row (even for failures —
a 404/login-wall row saves the next session the retry). Each research report
keeps its own detailed source table; this file is the cross-session index.

## Per-report source tables (detailed URL lists live inside each report)

| Report | Covers |
|---|---|
| `2026-07-05-tax-constants-verification.md` | brackets, point value, surtax, pension §45א, charity §46 ceilings (2024/2025) |
| `2026-07-12-form1301-codes-verification.md` | official Form 1301 field codes |
| `2026-07-13-credit-points-verification.md` + counts/allocation addenda | children §40 counts, oleh §35, allocation regimes |
| `2026-07-13-degrees-40g-addendum.md` | §40ג–§40ה degree windows |
| `2026-07-13-non-linked-interest-15pct.md` + interest addenda | §125ג(ג)(1) |
| `2026-07-13-section47-deductions.md` + rates addendum | §47 ceilings + rates |
| `2026-07-14-sah3184-parent-allocation-addendum.md` | enacted ס"ח 3184, ITA instructions ita-260324/ita-030124, consolidated §40/§66 (incl. its BLOCKED table: nevo login-wall, Knesset JS pages, rfa.justice DNS) |
| `2026-07-16-section47-ordering-addendum.md` | §§1, 45א, 47, 121ב ordering verbatim |
| `2026-07-17-il-2026-year-data.md` | full 2026 year-data constant set (brackets post-ריווח, point value, surtax+2% add-on, §46, §45א, §91/§125ג, NI 2026) |

## Ad-hoc fetches (not inside a report's own table)

| Date | URL | Result | Used for |
|---|---|---|---|
| 2026-07-15 | `https://he.wikisource.org/w/index.php?title=פקודת_מס_הכנסה&action=raw` | 200, 1.5MB wikitext | §40(ב) verbatim (il-0.7.0), §66(ג), later §§1/45א/47/121ב (ordering addendum). Re-fetch only to check for NEW amendments |
| 2026-07-16 | `https://www.kolzchut.org.il/he/נקודות_זיכוי_ממס_הכנסה_להורה_יחיד_(הורה_עצמאי)` | **404** — page does not exist under this name | — (do not retry this slug) |
| 2026-07-16 | `https://www.kolzchut.org.il/he/נקודות_זיכוי_ממס_הכנסה_להורים_לילדים_עד_גיל_6` | **404** — wrong slug (the real page is "…להורה לפעוט (מתחת לגיל 6)") | — (do not retry this slug) |
| 2026-07-16 | `https://www.kolzchut.org.il/he/נקודות_זיכוי_ממס_הכנסה_ל"הורה_אחד"_עבור_גידול_ילדיו` | 200 | **הורה-יחיד 0-5 stacking corroboration** (secondary): a 2-year-old → "9 נקודות (4.5 שמיועדות לאב ו-4.5 שמיועדות לאם)" + the flat extra point; table valid 2024+. Closes the il-0.7.0 sign-off item's 0-5 uncertainty |
| 2026-07-17 | `https://www.gov.il/BlobFolder/generalpage/income-tax-monthly-deductions-booklet/he/generalInformation_income-tax-monthly-deductions-booklet_monthly-deductions-booklet-2026.pdf` | 200, PDF 1.38MB (curl + pdftotext) | **booklet-2026** (April-2026 re-publication!): 2026 brackets after ריווח מדרגות (228,000/301,200), point 242 ₪/mo, surtax 721,560 + 2% capital, §46 207/10,354,816, §47(א)(1)(1) 9,700/mo. Same URL served the pre-April edition earlier in 2026 — content replaced |
| 2026-07-17 | `https://he.wikisource.org/w/index.php?title=פקודת_מס_הכנסה&action=raw` | 200, 1.55MB wikitext (re-fetch of the 2026-07-15 row, per its amendment-check proviso) | Found NEW amendments: §121 widened brackets (תשפ"ו־6, annotated 2026-2027), NEW §39ב miluim-combat credit points incl. 2026-2027 הוראת שעה; re-verified §§45א/46/91/121ב(א1)/125ג(ג)(1) unchanged |
| 2026-07-17 | `https://www.btl.gov.il/Insurance/HozrimBituah/Hozrim/_שינוי_בתשלום_דמי_ביטוח_לאומי_ודמי_ביטוח_בריאות_לשנת_2026.pdf` | 200, PDF 351KB | **btl חוזר מעסיקים 1522 (01/01/2026)**: NI 2026 — ceiling 51,910, reduced band 7,703 (NEW statutory definition: 7,522 CPI-indexed, no longer 60%×avg wage), avg wage 13,769, employee rates 1.04/3.23/7.00/5.17 (הוראת שעה through end-2026) |
| 2026-07-17 | `https://www.btl.gov.il/Insurance/HozrimBituah/Hozrim/_איגרת_למעסיק_לשנת_2026.pdf` | 200, PDF 333KB | **btl בל/651 (01.2026)** — same 2026 figures as חוזר 1522 (corroborating primary) |
| 2026-07-17 | `https://www.kolzchut.org.il/he/מדרגות_מס_הכנסה` | 200 | Secondary corroboration of 2026 brackets (228,000/301,200), surtax 3%+2%, point 2,904 ₪/yr (7,986/2.75) |

Known-blocked hosts (from the sah3184 addendum — don't burn fetches):
nevo.co.il full texts (login wall), main.knesset.gov.il LawBill pages (JS
shell), rfa.justice.gov.il (DNS failure from this container).
