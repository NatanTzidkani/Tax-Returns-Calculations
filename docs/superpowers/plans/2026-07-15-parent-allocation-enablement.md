# Parent-allocation enablement (il-0.7.0) — consume the ס"ח 3184 addendum

**Date:** 2026-07-15 · **Status:** COMPLETE 2026-07-15 (all seven tasks; every
task checkbox executed as written — commits `d9e0141`…HEAD on
`feat/parent-allocation-enablement`. One deviation: the §40(ב)(1ב) verbatim
re-fetch happened during planning, not Task 3, and is quoted in the source
comments.)
**Follows:** `docs/superpowers/plans/2026-07-13-parent-allocation.md` (il-0.6.0)
**Research it consumes:** `docs/superpowers/research/2026-07-14-sah3184-parent-allocation-addendum.md`
(the enacted ס"ח 3184 read verbatim from רשומות + two official ITA employer
instructions + current consolidated §40/§66) — referred to below as **the
addendum**.

## Goal

il-0.6.0 shipped the parent-allocation regime map with three branches
**disabled-loud** because their counts were not primary-verified: the father
schedules (`marriedOtherSpouse` / `singleFatherOfToddler`), the 6–17 child
band, and the §66(ג)(3) קצבה count (stubbed 0 + TODO label). The addendum has
since closed all three gates with primary sources (its §5 verdict table), and
surfaced one correction the plan must absorb: the הורה-יחיד case stacks *both*
parents' columns, so the current `singleParent` regime **under-grants**.

This increment enables exactly what the addendum verified — nothing else —
and bumps `ENGINE_VERSION` to `il-0.7.0`.

## What gets enabled (addendum §6, item by item)

| # | Disabled branch today | Verified rule (2024 & 2025) | Addendum source |
|---|---|---|---|
| 1 | `credit-points-tables.ts` — 6–17 rows missing, loud throw | ages 6–17 = **[24, 12]** twelfths (custodial 2 pts / other 1 pt), permanent, no sunset | §2 — sah3184 §1(1)(א) enacted tail; ita-030124 tables 3.1/3.2; consolidated §66(ג)(4)(א)/(5)(ג)/§40(ב)(1א)(ג) |
| 2 | `child-allocation.ts` — father Schedule B loud throw | father column = the tables' `other` column, **all ages 0–17** (0–5 identical to the mother's, 1 pt each 6–17, 0 at 18). No פעוט gate exists in current law (§40(ב)(3) definition deleted) | §1b/§1c — sah3184 §1(2)(ב) enacted verbatim; wikisource §66(ג)(5), §40(ב)(1א) |
| 3 | `singleFatherOfToddler` regime name/scope | statute now reads "אב **לילד** במשפחה חד-הורית" — full 0–17 schedule, not פעוט-only → rename **`singleFather`**; the `motherClaimsUnderSection1 === false` → attach-to-her-income proviso survives verbatim | §1c |
| 4 | קצבה stub `CHILD_ALLOWANCE_TWELFTHS = 0` + "טרם אומתה" label | **0 — definitively and permanently**: §40(א) קצבה points are NII-paid inside קצבת ילדים (תיקון 99, 1994; §33א definition), never a return-side credit. Value unchanged; label/status change from "unverified placeholder" to "verified statutory 0" | §3 |
| 5 | `singleParent` under-grant (new correction) | הורה יחיד (ילד להורה אחד) claims **both columns**: Schedule A **+** the §40(ב)(1א) column per child **+** the (1ב) +1 bonus (e.g. 6–17 → 2+1 = 3 pts/child) | §2 table row 3 — ita-030124 §3.3; consolidated §40(ב)(1ב) |
| 6 | Source comments | `birthYearDeferral` → cite §66(ג)(4)(א1)/§40(ב)(1א1) (תיקון 247, תשע"ח-2018); 0–5 table rows upgrade citation from kolzchut to sah3184 enacted verbatim; delete the il-0.6.0 correction-flag comment ("married father gets nothing for ages 4–18" — itself corrected by the addendum) | §4, §1b, §2 correction note |

**Design note on #5 (the only judgment call):** the `singleParent` regime was
already modelled as §40(ב)(1)+(1ב) — i.e. the strict הורה-יחיד sense (the
separated-custodial case is `separatedEntitled`), so the stacking applies to
the whole regime, no new enum value needed. The stacked per-child row is
emitted as its own labelled breakdown row (citing §40(ב)(1ב)) rather than
folded into the Schedule-A row, preserving the auditable-worksheet convention.
Before coding, re-fetch the consolidated §40(ב)(1ב) verbatim (wikisource, the
addendum's source) and quote it in the `// source:` comment — the addendum
quotes it only elliptically.

**קצבה row disposition (owner may override):** the addendum leaves "drop the
permanent-0 row vs keep as audit line" open. This plan **keeps** the row,
relabelled ("נקודות הקצבה משולמות בידי המוסד לביטוח לאומי במסגרת קצבת
הילדים — אינן נזקפות בחישוב המס"), because the no-black-box worksheet
convention favours showing *why* a flag the reviewer set produced no points.

## What stays gated (NOT touched here)

- **§40(ב)(2) multi-child fraction** (`assertSeparatedNonEntitledMultiplicity`)
  — per-child vs collective is an owner *ruling*, not a research gap; the
  addendum did not address it.
- **Fraction rounding convention** (round vs floor vs exact) — same.
- **§66(ג)(1)/(1א) election optimiser** — its own future increment.
- **Same-sex / registered-parent framing**, **age semantics**, and the
  **§40(ב)(1א) explanatory 0-row surfacing** reviewer nit — carried forward
  unchanged on the il-0.6.0 checklist.
- The **flag-routing looseness** nit (`receivesChildAllowance` accepted under
  non-§66 regimes): now that the count is a verified permanent 0, the row is
  informational under every regime; still label-only, still harmless.
  Tightening remains deferred.

## Tasks (TDD — failing test → implement → green → commit)

### Task 1 — tables: 6–17 band + citation upgrades
**Files:** `src/jurisdictions/il/rules/credit-points-tables.ts`,
`test/jurisdictions/il/credit-points-tables.test.ts`.
- [ ] Failing tests: `childPointTwelfths(6..17, 'custodial') === 24`,
      `('other') === 12`; ages 0–5/18 unchanged; <0 / >18 still throw.
- [ ] Add rows 6–17 `[24, 12]`; delete the missing-row throw (every age 0–18
      now has a row); upgrade 0–5 `// source:` to the addendum §1b.
- [ ] Commit `feat(tax-engine): enable the 6-17 child band — 2/1 points primary-verified (ס"ח 3184 addendum)`.

### Task 2 — allocation: father Schedule B + singleFather rename + קצבה relabel
**Files:** `src/jurisdictions/il/rules/child-allocation.ts`,
`src/core/types.ts`, `test/jurisdictions/il/child-allocation.test.ts`.
- [ ] Failing tests: `marriedOtherSpouse` ages 0,1,3,6,17 → 30/54/42/12/12
      twelfths with §66(ג)(5) labels, age 18 → legitimate 0;
      `singleFather` same column via §40(ב)(1א), mother-claims-false guard
      unchanged; 116ד flags still throw under both father regimes.
- [ ] Replace the Schedule-B throw with the `other`-column lookup; rename
      `singleFatherOfToddler` → `singleFather` across the engine; drop פעוט
      terminology; delete the stale correction-flag block; relabel the קצבה
      row (value stays 0, TODO removed, cite addendum §3).
- [ ] Commit `feat(tax-engine): enable father Schedule B (§66(ג)(5)/§40(ב)(1א)) and settle the קצבה stub at statutory 0`.

### Task 3 — הורה-יחיד stacking
**Files:** `child-allocation.ts`, `credit-points.ts` (module),
tests for both.
- [ ] Verbatim-quote §40(ב)(1ב) in the source comment (re-fetch wikisource).
- [ ] Failing tests: `singleParent` child age 8 → Schedule-A row (24) **+**
      stacked (1א)-column row (12) + flat +1 bonus; age 18 → 6 + 0 (no stack
      row emitted at 0); birth-year deferral still keys on the Schedule-A row
      only.
- [ ] Commit `feat(tax-engine): הורה יחיד stacks the §40(ב)(1א) column (§40(ב)(1ב), ita-030124 §3.3)`.

### Task 4 — engine version + golden scenario
**Files:** `src/calculate.ts`, `test/calculate.test.ts`.
- [ ] Failing golden test: 2025 salary + `marriedRegisteredSpouse` mother,
      children ages 2 and 8 (the il-0.6.0 plan's Task-5 scenario, now legal) —
      assert points/value/refund; a father `marriedOtherSpouse` counterpart.
- [ ] `ENGINE_VERSION` → `il-0.7.0`; comment block updated.
- [ ] Commit `feat(tax-engine): il-0.7.0 — parent-allocation enablement end-to-end`.

### Task 5 — shared schema + API ripple (rename only)
**Files:** `packages/shared/src/calculation.ts`, api type-drift guard +
route tests.
- [ ] `ParentContextSchema` regime enum: `singleFatherOfToddler` →
      `singleFather` (comment: statute covers all his children since ס"ח
      3048/3184); type-drift assertions re-prove engine↔schema alignment.
- [ ] Commit `feat(shared): rename singleFather regime — statute no longer פעוט-scoped`.

### Task 6 — web ripple
**Files:** `packages/web/src/i18n.ts`, `WorksheetPanel.tsx` + test.
- [ ] Regime option: key + label → `singleFather` / 'אב במשפחה חד-הורית';
      6-17 ages now submit cleanly (drop any test asserting the engine's
      6-17 400); the server-Hebrew-error path itself stays (still exercised
      by other invalid inputs).
- [ ] Commit `feat(web): singleFather regime label; 6-17 child band live`.

### Task 7 — docs
- [ ] CLAUDE.md current-state row: il-0.7.0 — father schedules + 6-17 band
      enabled (primary-verified), קצבה settled at statutory 0, הורה-יחיד
      stacking, `singleFather` rename; remaining gates unchanged.
- [ ] Root `pnpm test` + `pnpm typecheck` green; engine branch coverage ≥95%.
- [ ] Commit `docs: note il-0.7.0 parent-allocation enablement in CLAUDE.md`.

## ⚠️ Owner sign-off items for THIS increment

Everything enabled here is primary-sourced in the addendum, but two residues
deserve the owner's eye before filing a real return on il-0.7.0:

- [ ] **ס"ח 3048 רשומות-verbatim** (addendum §2 residue): the 6–17 counts are
      primary-administrative (binding ITA instruction) + enacted-corroborated
      (sah3184 presupposes and partially re-enacts them), but the 2023 law
      itself is login-walled. If desired: nevo `law_html/law11/090323.htm`
      (free login) or Knesset lawitemid 2202778.
- [ ] **הורה-יחיד stacking scope**: the addendum grades it CONFIRMED
      (ita-030124 §3.3 + §40(ב)(1ב)); this plan applies the stack to **all
      ages** (the (1א) column, 0–17), per the statutory cross-reference. The
      ITA instruction's own tables cover only 6–17 — confirm the 0–5 stacking
      reading matches practice (the worksheet row's explicit §40(ב)(1ב) label
      makes any correction a one-line table fix).
      **Corroborated 2026-07-16 (secondary):** kolzchut's dedicated הורה-אחד
      page states the 0–5 stack explicitly — a 2-year-old yields "9 נקודות
      (4.5 נקודות שמיועדות לאב ו-4.5 נקודות שמיועדות לאם)" plus the flat
      extra point, table valid 2024+ — exactly this plan's numbers (URL in
      `research/SOURCES.md`, ad-hoc rows). Residual owner-eye is now only
      the usual secondary-vs-practice caveat.
