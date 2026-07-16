# §47 ordering addendum — surtax base & §45א cap: pre- or post-§47 income?

Date: 2026-07-16 · Author: Claude (session research) · Status: research addendum (no code changed)

Addendum to `docs/superpowers/research/2026-07-13-section47-deductions.md` and
`docs/superpowers/research/2026-07-13-section47-rates-addendum.md`, settling
the **one open ordering question** the §47 plan
(`docs/superpowers/plans/2026-07-13-section47-deductions.md` §2.2, §5) gates
Step 7 on: when the §47 deduction reduces taxable income before the brackets,
do (a) the §121ב surtax base and (b) the §45א credit's qualifying-income cap
use the **raw** work income or the **post-§47** figure?

**Source:** פקודת מס הכנסה [נוסח חדש], consolidated wikisource text (same
`action=raw` fetch used and graded in the sah3184 addendum — secondary
transcription of רשומות, amendment-annotated), §§1, 45א, 47, 121ב read
verbatim 2026-07-16: <https://he.wikisource.org/wiki/פקודת_מס_הכנסה>.

## Verdict summary

| # | Question | Verdict | Basis |
|---|---|---|---|
| 1 | §121ב surtax base | **POST-§47** (the deduction reduces the surtax base) | §121ב(ה) → §1 "לאחר הניכויים" |
| 2 | §45א cap's qualifying income (הכנסה מזכה) | **PRE-§47 — explicitly** | §47(א)(1) "לפני הניכוי על פי סעיף זה"; §45א(ג) adopts it |
| 3 | (bonus) §47↔§45א double-dip | **Forbidden by §47(ג)** — a shekel deducted under §47 cannot also earn the 35% credit | §47(ג) verbatim |

## 1. Surtax base — POST-§47

**§121ב(א):** "יחיד אשר **הכנסתו החייבת** בשנת המס עלתה על ... יהיה חייב במס
נוסף על חלק **הכנסתו החייבת** העולה על ...".

**§121ב(ה):** "”הכנסה חייבת“ – הכנסה חייבת **כהגדרתה בסעיף 1** וכמשמעותה
בסעיף 89, למעט סכום אינפלציוני ... ולרבות שבח ...".

**§1:** "”הכנסה חייבת“ – הכנסה **לאחר הניכויים**, הקיזוזים והפטורים שהותרו
ממנה לפי כל דין".

§47 is a ניכוי; therefore the surtax base is income **after** it. The plan's
§2.2 hunch ("surtax is on taxable income so it likely uses the
post-deduction figure") is confirmed. Engine impact: in `calculate.ts`, the
surtax's `totalTaxable` must be built from `taxableWorkIncome`
(post-deduction), not raw `workIncome`, once Step 7 wires the deduction.

## 2. §45א cap — PRE-§47, by explicit definition

**§45א(ג):** "”הכנסה מבוטחת“, ”הכנסה מזכה“ ו”עמית מוטב“ – **כהגדרתם בסעיף
47**".

**§47(א)(1):** "”הכנסה מזכה“ – סך כל הכנסתו החייבת של יחיד **לפני הניכוי על
פי סעיף זה ועל פי סעיף 47א**, כמפורט להלן ...".

The same "לפני הניכוי על פי סעיף זה" prefix opens the §47(א)(3) "הכנסה
לעמית עצמאי" and §47(א)(5) "הכנסה נוספת" definitions — **every income base
inside the §47/§45א pension-relief cluster is pre-§47** (and pre-§47א) by
construction, so the deduction's own ceilings are not eroded by taking it.
Engine impact: `computePensionCredit`'s qualifying-income cap keeps using the
**raw** work income exactly as today — no change when §47 lands.

## 3. Bonus — the §47(ג) anti-double-dip rule (new engine requirement)

**§47(ג):** "סכום שנוכה לפי סעיף קטן (ב) או (ב1) **לא יובא בחשבון לצורך
סעיף 45א**."

(And **§47(ב2)**: a sum deducted under (ב) cannot also be deducted under
(ב1), and vice versa.)

The plan does not currently state this: when Step 7 wires the deduction, the
contribution amounts consumed by the §47 ניכוי must be **excluded from the
§45א credit's contribution base**. Today the engine feeds all box-045
employee contributions to `computePensionCredit` — that stays correct for
the fully-insured salaried case (§47 = 0), but the future
independent-contribution input must be split: each shekel goes to the
deduction *or* the credit, never both. Add this to the §47 module's TDD
steps (it interacts with the מוטב/non-מוטב election — the "better branch"
comparison must compare *total tax* including the credit each branch leaves
available).

## 4. Input extractability — repo-side half of the plan's §5 item

`packages/shared/src/documents/form106.ts` stores Form 106 as a **generic
`boxes: Record<3-digit-code, agorot>` map** — no schema change is needed for
an "insured salary" figure; extraction already carries any box the document
shows. What remains owner-side: confirm **which box code (if any) on the
actual Form 106** reports הכנסה מבוטחת (§47(א)(4)), and whether independent
עמית-עצמאי deposits appear on any document at all (they likely need the
fund's annual statement, i.e. a reviewer-entered input like
`nonLinkedInterest*`). Do not hard-code a box number from memory — verify on
the owner's real form.

## 5. What this changes in the plan

- §5 "Surtax base & §45א cap" item → **CLOSED** (verdicts above; cite this
  addendum in the Step-7 `// source:` comments).
- §5 "Input extractability" item → **half-closed** (schema side needs
  nothing; the box-code identification stays owner-side).
- New Step-7/8 requirement: implement **§47(ג)/(ב2) exclusivity** (this
  addendum §3).
- The only remaining gate to scheduling is the **scope call** (§5): does any
  §47 / §17(5א) amount actually fire for the owner's return? If the return
  is single-employer, fully-insured, no independent fund — every amount is 0
  and the plan stays deferred.
