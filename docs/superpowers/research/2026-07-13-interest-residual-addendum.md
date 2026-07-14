# Addendum — 15% non-linked interest: flat rate vs "לא יעלה על" cap, and Form 867 box numbers

Date: 2026-07-13 · Author: tax-law-analyst agent · Status: research addendum (no code changed)

Closes the two residual owner-verify items left open in
`docs/superpowers/research/2026-07-13-non-linked-interest-15pct.md` §7(c) and
§7(d) (and repeated in the loss-offset addendum §"Residual owner-verify"). The
rates, Form 1301 field codes, and the loss-offset rule are already
primary-confirmed in those two reports; this addendum resolves only:

1. **Flat 15% vs. marginal-rate cap** — is §125ג(ג)'s 15% on non-linked deposit
   interest a flat rate, or a "שלא יעלה על" ceiling that can drop below 15% for a
   60+/low-income taxpayer? Does the engine's flat 15% need a cap branch?
2. **Form 867 box/appendix numbers** — where on Form 867 does non-linked (15%)
   deposit interest and its withholding sit, versus the securities interest
   already handled?

Engine stores integer **agorot** (₪ × 100); nothing numeric changes here — both
are rule/mapping findings, not constants. No freeze-law impact: the 15%/25% are
fixed statutory percentages (no §120ב indexation).

---

## Primary / authoritative sources used

| ID | Source | Grade |
|---|---|---|
| **pkuda-btl** | פקודת מס הכנסה [נוסח חדש] — consolidated text hosted by המוסד לביטוח לאומי. I downloaded the PDF and extracted it with `pdftotext -layout`; §§121, 125ג, 125ד quoted **verbatim** below (lines 6491–6640 of the extract). <https://www.btl.gov.il/Laws1/02_0103_000000.pdf> | Statute text (primary) |
| **hilan-ז** | חילן — reproduction of פקודת מס הכנסה חלק ז' (שיעורי המס), §125ג. Cross-check of the §125ג wording. <https://www.hilan.co.il/מרכז-ידע/חקיקה/דיני-מיסים/פקודת-מס-הכנסה-נוסח-חדש-תשכא-1961/חלק-ז-שיעורי-המס/> | Licensed-payroll reproduction (secondary) |
| **claltax-125דה** | Claltax — §125ד/§125ה interest exemptions (low-income + retirement-age). <https://claltax.com/סעיף-125ד-ו125ה-לפקודה-פטור-על-הכנסות-ריבית/> | Licensed-CPA (secondary) |
| **kolzchut-1948** | כל-זכות — החזר מס על ריבית מפיקדון/תכנית חיסכון למי שנולדו לפני 2.1.1948. <https://www.kolzchut.org.il/he/החזר_מס_על_ריבית_מפיקדון_או_מתוכנית_חיסכון_למי_שנולדו_לפני_2.1.1948> | Public-rights portal (secondary) |
| **roeahesbon-867** | רואה החשבון — מדריך טופס 867 (2026): the נספחים א'–ו' breakdown. <https://roeahesbon.com/form-867-tax-withholding/> | Licensed-CPA (secondary) |
| **discount-867** | בנק דיסקונט — הפקת טופס 867: what the certificate reports (issuer). <https://www.discountbank.co.il/private/savings-investments/securities-taxation/867/> | Issuing bank (corroboration) |
| **prisha-60** | פרישה — ניכוי מריבית בשל הכנסות נמוכות או בשל גיל. **403 Forbidden** on WebFetch — could not read; title only, via search. <https://www.prisha.co.il/Article/ניכוי-ריבית-הכנסות-נמוכות-גיל> | Inaccessible — noted, not relied on |

> **Source-grade note.** The decisive material for item 1 — the exact wording of
> §125ג(ב)/(ג)/(ד) and the §121(א)/(ב) rate ladder — was parsed by me from the
> btl.gov.il ordinance PDF, so it is **CONFIRMED primary**. btl.gov.il hosts a
> consolidated ordinance for NI purposes; the rate structure and the
> exertion/age-60 rule below are current law (cross-checked against hilan-ז).
> For item 2 the **appendix (נספח) identity** of Form 867 is CPA + issuing-bank
> corroborated, but the **discrete numeric box codes** inside each appendix are
> issuer-template-dependent and were not published on any source I reached —
> those stay owner-verify.

---

## Item 1 — Flat 15% vs. "לא יעלה על" cap

### 1.1 The statutory text (verbatim, pkuda-btl)

**§125ג(ב)** — linked / real interest:

> "יחיד חייב במס על הכנסה מריבית **בשיעור שלא יעלה על 25%**, ויראו את הכנסתו זו
> **כשלב הגבוה ביותר בסולם הכנסתו החייבת**."

**§125ג(ג)(1)** — non-linked interest (the deposit/savings 15% bucket, field 078):

> "**על אף האמור בסעיף קטן (ב)**, שולמה הריבית על נכס שאינו צמוד למדד, או שהוא
> צמוד בחלקו לשיעור עליית המדד, כולו או חלקו, או שאינו צמוד למדד עד לפדיון או עד
> להחזר, תחויב הכנסתו של היחיד מריבית במס **בשיעור של 15%**."

**§125ג(ד)** — kick-out to full §121 marginal rates if the interest is business
income / an interest-expense deduction was claimed / substantial-shareholder /
related-party / early קרן-השתלמות withdrawal / other minister-set condition
(the carve-outs already documented in the main report §1; out of engine scope).

**The decisive linguistic contrast (primary-confirmed):**

| Subsection | Instrument | Statutory phrasing | Nature |
|---|---|---|---|
| §125ג(ב) | linked / real interest (25%) | "בשיעור **שלא יעלה על** 25%" + interest deemed "**השלב הגבוה ביותר** בסולם הכנסתו" | **Explicit ceiling** — tax = min(25%, top-slice marginal rate) |
| §125ג(ג)(1) | **non-linked** interest (15%) | "בשיעור **של** 15%" — opens "על אף האמור בסעיף קטן (ב)" | **Stated as a fixed rate** — does **not** repeat "שלא יעלה על" |

So on the **literal primary text**, the 15% is written as a flat rate, unlike the
25% which is expressly a maximum. §125ג(ג) opens "notwithstanding subsection
(ב)", swapping the *rate* for non-linked assets; it does not re-import (ב)'s
"שלא יעלה על"/top-slice ceiling language.

### 1.2 Why the cap never binds for the owner (or any under-60 taxpayer) — §121

Even if one read (ב)'s top-slice ceiling into (ג), it could only reduce the
15% where the taxpayer's **marginal rate on the interest as top slice** is below
15%. The §121 ladder (verbatim, pkuda-btl) forecloses that for anyone under 60:

**§121(א)** — the *default* individual ladder: first **240,000 ₪ → 31%**;
240,001–501,960 → 34%; above → 48% (top 50% per the post-2013 note).

**§121(ב)(1)** — the reduced 10% / 14% / 21% / 31% brackets apply **only**:

> "…לגבי הכנסה חייבת בשנת המס **מיגיעה אישית** ולגבי הכנסה חייבת בשנת המס של
> **יחיד שמלאו לו 60 שנים** …"

Interest is **not** יגיעה-אישית (personal-exertion) income. Therefore, for a
taxpayer **under 60**, interest sits in §121(א) and its top-slice marginal rate
starts at **31%** — always **> 15%** (and > 25%). The fixed rate always binds; a
cap, even if it existed, would never reduce it. This holds for the owner
(salaried, presumed under 60) **regardless of income level**. The reduced
sub-15% brackets open up **only** at age 60+.

### 1.3 How 60+/low-income taxpayers actually pay less than 15% — §125ד/§125ה, not a rate cap

The documented route to a sub-15% effective rate on deposit interest is **not** a
marginal-rate cap on the 15%; it is two **base/threshold reliefs** the engine
does not model (claltax-125דה; §125ד text verbatim in pkuda-btl):

- **§125ד — ניכוי (deduction) from taxable interest.** Low-income (household
  income ≤ "התקרה המוטבת") → a fixed deduction from interest income; and
  retirement-age (born before "המועד הקובע" + reached גיל פרישת חובה) → larger
  fixed deductions (base amounts 13,000 ₪ single / 16,000 ₪ couple in the
  ordinance text; §125ד amounts are §120ב-indexed — the current-year figures are
  higher, e.g. the kolzchut-1948 refund ceilings 15,000 / 18,360 ₪ for 2026).
  This reduces the **amount** of taxable interest, not the rate.
- **§125ה — ריבית מוטבת (additional exemption)** for retirement-age with income
  restrictions.

The kolzchut-1948 refund for savers born before 2.1.1948 is expressly built on
**§125ד** (a deduction capped at those ceilings, refunded because the bank
withheld more than the post-deduction liability) — again a base relief, not a
rate cap. (prisha-60, the article specifically on reduced *withholding* for
age/low-income, **403'd** and could not be read; it concerns withholding-at-
source mechanics, which resolve at assessment and do not change the assessed
rate.)

### 1.4 Verdict table

| Question | Finding | Source | Verdict |
|---|---|---|---|
| Is §125ג(ג)'s 15% worded as a flat rate or a "שלא יעלה על" ceiling? | **Flat rate** — "בשיעור של 15%"; the "שלא יעלה על" + top-slice language appears only in §125ג(ב) (the 25%) | pkuda-btl §125ג(ב)/(ג)(1); hilan-ז | CONFIRMED (primary): 15% stated flat; 25% is the explicit ceiling |
| Can the effective rate on non-linked interest be **below 15%** for a taxpayer **under 60** (incl. the owner)? | **No.** Non-exertion interest under §121(א) is taxed from 31% as top slice; no sub-15% bracket exists under 60 | pkuda-btl §121(א)/(ב)(1) | CONFIRMED — flat 15% always correct under 60 |
| Can it be below 15% for a **60+/low-income** taxpayer? | **Yes**, but via **§125ד deduction / §125ה exemption** (reduce the taxable base), not via a rate cap on the 15% | claltax-125דה; pkuda-btl §125ד; kolzchut-1948 | CONFIRMED (mechanism = base relief) |
| Is the residual (post-125ד/ה) taxable deposit interest of a 60+ low-income person *additionally* capped to a sub-15% marginal rate? | Literal §125ג(ג)(1) ("בשיעור של 15%", no "שלא יעלה על") points to **flat 15% even for 60+**; no primary source found stating the 15% is a ceiling | pkuda-btl §125ג(ג)(1) | **OWNER-VERIFY** (edge case only; does not affect any under-60 taxpayer) |

### 1.5 Engine verdict — does the flat 15% need a cap branch?

**No cap branch is needed.** The engine's flat 15% on non-linked deposit interest
is **CONFIRMED correct for the owner and for every taxpayer under 60** — §121(א)
puts non-exertion interest at a ≥31% top-slice marginal rate, so the 15% always
binds; a `min(15%, marginal)` cap would be dead code for the single-user scope.

Two edge cases, both **out of current scope** and neither requiring a cap on the
15% today:

- **§125ד/§125ה relief** (60+/low-income) lowers the effective rate by reducing
  the **taxable interest amount**, not the rate. If the app ever serves a
  60+/low-income taxpayer, model these as a *deduction/exemption against the
  interest base* — not as a rate cap. (Leave the deposit 15% flat; subtract the
  §125ד/ה relief upstream.)
- **The 25% linked/securities rate is the one that is genuinely a "שלא יעלה על"
  ceiling** (§125ג(ב)). If the engine ever taxes *linked/real* interest at 25%
  for a 60+ low-income taxpayer, that path — not the deposit 15% — is where a
  `min(25%, marginal)` cap could bind. For the owner it also always binds at 25%
  (≥31% marginal under 60), so no change today.

Residual **OWNER-VERIFY** (edge only, does not touch the owner): whether a 60+
low-income taxpayer's residual taxable deposit interest is capped to a sub-15%
marginal rate. The primary text says flat 15%; I found no source treating the
15% as a ceiling. Defer.

---

## Item 2 — Form 867 box / appendix numbers for non-linked (15%) deposit interest

### 2.1 Deposit interest IS on Form 867 — in a distinct appendix from securities

Form 867 (the bank/broker annual withholding certificate) is a set of **נספחים
(appendices)** by income type. Both a CPA guide and the issuing bank confirm the
same breakdown (roeahesbon-867; discount-867):

| Form 867 appendix | Title / contents | Rate | Maps to Form 1301 (from main report §4) |
|---|---|---|---|
| **867 א' + ב'** | רווח הון מניירות ערך סחירים ולא-סחירים (capital gains) | 25% | gains → 026/… ; withholding → 040 |
| **867 ג'** | אישור ניכוי מס במקור **מדיבידנד וריבית מניירות ערך** (securities interest + dividend — the engine's existing bucket) | 25% | interest **157**, dividend **141**; withholding **040** |
| **867 ד'** | אישור ניכוי מס במקור **מריבית ורווחים אחרים מפקדונות ותוכניות חיסכון** (**non-linked deposit / savings interest** — the 15% bucket) | **15%** | interest **078**; withholding **043** |
| 867 ה' | ניכוי מדמי הלוואה (loan fees) | — | — |
| 867 ו' | קרנות ריט / REIT | — | — |

**Key finding:** the 15% non-linked deposit interest and its withholding sit in
**appendix 867 ד'** — a *different* appendix from the securities interest+dividend
already handled by the engine (**867 ג'**). This cleanly matches the two separate
Form 1301 destinations the main report confirmed: deposits → **078 / 043**,
securities → **157 / 141 / 040**. discount-867 states the deposit certificate is
"an integrated part of Form 867" (appendix ד'), not a standalone document.

Practical caveat: for a saver with **only** bank deposits (no securities
account), the bank often issues the appendix-ד' interest/withholding certificate
on its own (sometimes not even labelled "867"); either way the numbers feed Form
1301 fields **078** (income) and **043** (withholding). So a future extraction
schema should read the **867-ד'** appendix (or the bank's standalone deposit-
interest certificate), not the 867-ג' securities appendix.

### 2.2 Verdict table

| Item | Finding | Source | Verdict |
|---|---|---|---|
| Which Form 867 appendix carries non-linked 15% deposit interest + withholding? | **Appendix 867 ד'** — "ריבית ורווחים אחרים מפקדונות ותוכניות חיסכון" | roeahesbon-867; discount-867 | CONFIRMED (appendix identity) |
| Which appendix carries securities interest/dividend (the engine's existing bucket)? | **Appendix 867 ג'** — "דיבידנד וריבית מניירות ערך" (25%) | roeahesbon-867; discount-867 | CONFIRMED |
| Is deposit interest on Form 867 at all, or a separate bank certificate? | On Form 867 as appendix ד'; may also be issued standalone by the bank for pure-deposit savers | discount-867 | CONFIRMED |
| Specific **numeric box codes** inside 867-ד' / 867-ג' | Not published; layouts are issuer-template-dependent (each bank/broker numbers its own boxes) | (none reached) | **OWNER-VERIFY** — pull the exact box numbers off the owner's actual 867 when building the extraction schema |

---

## Verdict summary

- **Item 1 — flat vs. cap: the engine's flat 15% is CORRECT; no cap branch
  needed.** Primary text: §125ג(ג)(1) states the non-linked rate as a flat
  "בשיעור של 15%" (the "שלא יעלה על" ceiling + top-slice language is in
  §125ג(ב), governing the 25% linked/real interest only). Under §121(א)/(ב),
  non-exertion interest of any **under-60** taxpayer (incl. the owner) is a
  ≥31% top-slice — so the 15% always binds regardless of income. A sub-15%
  effective rate arises **only** for 60+/low-income taxpayers and comes through
  the **§125ד deduction / §125ה exemption** (base reductions the engine doesn't
  model), **not** a rate cap. → No `min(15%, marginal)` branch; if 60+/low-income
  is ever in scope, model §125ד/ה as a deduction against the interest base.
- **Item 2 — Form 867 mapping: CONFIRMED at the appendix level.** Non-linked
  15% deposit interest + withholding live in **appendix 867 ד'**
  ("מפקדונות ותוכניות חיסכון") → Form 1301 fields **078 / 043**; securities
  interest+dividend live in **appendix 867 ג'** → fields **157 / 141 / 040**
  (the engine's existing bucket). Deposit interest may also arrive as a
  standalone bank certificate for pure-deposit savers.
- **Residual OWNER-VERIFY (edge only, does not affect the owner):** (a) whether a
  60+ low-income taxpayer's residual taxable deposit interest is capped below 15%
  — literal text says flat, no primary source says ceiling; (b) the discrete
  numeric box codes inside 867-ד'/867-ג', which are issuer-template-dependent —
  read them off the owner's actual Form 867 when the extraction schema is built.
  (c) prisha-60, the article on reduced age/low-income *withholding*, **403'd**
  and was not readable; it concerns withholding mechanics, not the assessed rate.
- **No freeze-law impact / no constant changes:** the 15%/25% are fixed statutory
  percentages (no §120ב indexation); §125ד amounts *are* §120ב-indexed but are
  not modeled by the engine.
