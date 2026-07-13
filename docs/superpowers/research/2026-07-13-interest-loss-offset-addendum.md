# Addendum — Can a capital LOSS offset 15% non-linked deposit interest? (§92(א)(4))

Date: 2026-07-13 · Author: tax-law-analyst agent · Status: research addendum (no code changed)

Addendum to `docs/superpowers/research/2026-07-13-non-linked-interest-15pct.md`
(flag #1, that report's §3 and §7(a)). That report *defaulted* to "no offset"
but marked it NEEDS-OWNER-VERIFY. This addendum resolves it against **primary /
official sources** (פקודת מס הכנסה §92(א)(4) + רשות המסים חוזר 10/2025) and
also pins the linkage-differential principal-exemption section.

**Verdict headline: the "no offset" default is CONFIRMED correct.** A capital
loss (current-year or carried-forward) may **NOT** be set off against 15%
non-linked interest from a bank deposit / savings plan, because such interest is
not "בשל נייר ערך" (in respect of a security). This is stated **explicitly and
verbatim** by the Tax Authority in חוזר 10/2025 §3.7. The report's proposed
engine shape (keep the 15% bucket out of the loss-offset waterfall) is the
correct final behaviour — **no change required**.

Engine stores integer **agorot** (₪ × 100); nothing numeric changes here — this
is a rule/eligibility finding, not a constant.

---

## Primary / authoritative sources used

| ID | Source | Grade |
|---|---|---|
| **circ-10-2025** | רשות המסים, חוזר מס הכנסה 10/2025 — קיזוז הפסדי הון (27.11.2025). I downloaded the gov.il PDF and extracted it with `pdftotext -layout`; §3.3, §3.7 quoted verbatim below. <https://www.gov.il/BlobFolder/policy/professional-directives-271125-1/he/IncomeTax_professional-directives-271125-1.pdf> | Official Tax Authority guidance (primary) |
| **nevo-pkuda** | פקודת מס הכנסה [נוסח חדש] — §9(13)/§9(13א) text (parsed via WebFetch). <https://www.nevo.co.il/law_html/law00/84255.htm> | Statute text (primary) |
| **ytax** | נמרוד ירון ושות׳ — ניתוח חוזר 10/2025 (verbatim reproduction of the §3.7 exclusion + §92(א)(4)(ב) rate condition). <https://y-tax.co.il/capital-loss-offsetting/> | Licensed-CPA (secondary corroboration) |
| **capitax-3159 / raf-cpa / arnontl** | CPA reproductions of §92(א)(4)(א)/(ב) wording and Amendment 234 rate condition; בן דוד ruling on substantial shareholders. <https://www.capitax.co.il/content/2/3159> · <https://www.raf-cpa.com/23943> · <https://arnontl.com/he/news/...> | Licensed-CPA (secondary) |

> **Source-grade note.** The decisive statement is the official gov.il Tax
> Authority circular §3.7, which I parsed line-by-line myself — treat it as
> CONFIRMED primary. The full verbatim ordinance text of §92(א)(4) itself was
> reached through the circular's own citation (§3.3.1/§3.3.2 quote the section)
> plus CPA reproductions; nevo's law00/84255 page covers only Parts A–C, so §92
> (Part E) was not parsed from a nevo statute page directly. The circular is an
> official publication that binds the Authority's practice, so this is
> HIGH-confidence even without the raw §92 nevo page.

---

## 1. What §92(א)(4) actually permits (from חוזר 10/2025 §3.3, verbatim)

The circular reproduces the operative rule:

> "בהתאם להוראות סעיף 92(א)(4) לפקודה, הפסד הון שוטף שנובע ממכירת נייר ערך
> יקוזז באותה שנת מס גם כנגד שני אלה:
> **3.3.1** הכנסה מריבית או מדיבידנד ששולמו **בשל אותו נייר ערך** …
> **3.3.2** הכנסה מריבית או דיבידנד **בשל ניירות ערך אחרים**, ובלבד ששיעור המס
> החל עליהם לא עולה על שיעור המס הקבוע בסעיף 126(א) … אם מקבל הריבית או
> הדיבידנד הוא חבר בני אדם, ועל שיעור המס הקבוע בסעיף **125ב(1) או 125ג(ב)**
> לפקודה (25% נכון למועד פרסום החוזר) … אם מקבל הריבית או הדיבידנד הוא יחיד."

So a current-year capital loss from selling **a security** may be offset against:
- **§92(א)(4)(א):** interest/dividend paid **in respect of that same security**
  (only if actually paid that year); and
- **§92(א)(4)(ב):** interest/dividend **in respect of other securities**, *provided*
  the rate on that income does not exceed §125ב(1)/§125ג(ב) — i.e. **25% for an
  individual** (the surtax/מס יסף rate is excluded from that ceiling test —
  circ-10-2025, immediately after §3.3.2).

The gating word in **both** subparagraphs is **"בשל נייר ערך"** — the interest
must arise *in respect of a security*.

## 2. The decisive exclusion — deposits/savings are NOT offsettable (§3.7, verbatim)

> **"3.7** הפסדי הון מניירות ערך **לא ניתנים לקיזוז כנגד ריבית ששולמה על תכנית
> חיסכון, פיקדונות** (לרבות פיקדונות מובנים – Structured Products), הלוואה שאינה
> בגדר נייר ערך או כנגד רווחים ששילמה קרן נאמנות. יובהר, כי קיזוז בהתאם להוראות
> סעיף 92(א)(4) לפקודה יעשה **מקום בו מקור ההכנסה מריבית או דיבידנד הם מנייר
> ערך**."

Translation: capital losses from securities **cannot** be offset against interest
paid on a **savings plan, deposits** (incl. structured products), a loan that is
not a security, or against mutual-fund profits; §92(א)(4) offset applies **only
where the source of the interest/dividend income is a security**.

This is exactly the 15% non-linked deposit-interest bucket (Form 1301 item 21 /
field 078). A plain-shekel bank deposit or savings plan is not a נייר ערך, so
its interest is outside §92(א)(4) entirely — no offset, current-year or carried.
Corroborated verbatim by ytax ("אין לקזז הפסדים כנגד ריבית מתכניות חיסכון,
פיקדונות או הלוואות שאינן ניירות ערך…").

## 3. Linkage-differential principal exemption — exact section

The original report (§1 row 3, §7(b)) assumed §9(13) and flagged it. Confirmed:

> **§9(13)** (nevo-pkuda): "הפרשי הצמדה שקיבל **יחיד** בשל נכס, ובלבד שהתקיימו
> כל אלה: (1) הפרשי ההצמדה אינם הפרשי הצמדה חלקיים …" — i.e. the exemption for
> **linkage differentials received by an individual on an asset** (subject to the
> conditions, chiefly that they are *full*, not partial, linkage differentials
> and the asset is not a business asset). §9(13א) is a separate, narrow case
> (linkage differentials paid on **expropriation** of a non-inventory asset) and
> is not the deposit-principal exemption.

Verdict: the principal linkage-differential exemption is **§9(13)** — the
report's assumption is CONFIRMED; §9(13א) is a different, unrelated case.

---

## 4. Verdict table

| Item | Report's default | Verified rule | Source | Verdict |
|---|---|---|---|---|
| Capital loss vs. 15% non-linked **deposit/savings** interest (field 078) | **No offset** | **No offset** — not "בשל נייר ערך"; excluded by circ §3.7 verbatim | circ-10-2025 §3.7 (primary); ytax | **CONFIRMED — default is correct** |
| Capital loss vs. interest/dividend **from securities** at rate ≤25% (§125ב(1)/125ג(ב)) | Yes (existing securities bucket) | Yes, §92(א)(4)(ב), individual ceiling 25% (surtax excluded from ceiling test) | circ-10-2025 §3.3.2 (primary) | CONFIRMED — engine's existing securities path unchanged |
| Capital loss vs. interest/dividend of the **same security** | (n/a in report) | Yes, §92(א)(4)(א), only if actually paid that year | circ-10-2025 §3.3.1 (primary) | CONFIRMED (informational) |
| Principal linkage-differential exemption section | §9(13) (owner-verify) | **§9(13)** — individual, full linkage differentials on an asset | nevo-pkuda (primary) | CONFIRMED — §9(13) is correct (not §9(13א)) |

## 5. Engine implication

**No change to the engine's default.** When the 15% non-linked-interest branch is
built (per the original report §6), it must stay **out** of the loss-offset
waterfall (`offsetVsInterestDividend` / any §92(א)(4) target). The securities
interest/dividend bucket (fields 157/141, ≤25%) remains the *only* interest/
dividend offset target, exactly as the engine already does it. Wiring deposit
interest into the offset would over-absorb the owner's losses — the primary
source forbids it.

**Residual owner-verify (unchanged from original report, out of this addendum's
scope):** whether §125ג(ג) 15% is itself a flat rate or a "לא יעלה על" cap for a
60+/low-income taxpayer; specific Form 867 box numbers. Neither affects the
offset verdict above.
