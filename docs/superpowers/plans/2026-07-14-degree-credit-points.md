# Degree / Vocational Credit-Points Plan — §40ג–§40ה (follow-on increment)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This plan is a **planning document — no code is written by writing it.**

**This is a follow-on increment to
`docs/superpowers/plans/2026-07-13-credit-points.md`** (the "safe first
increment", children + oleh). That base plan creates the
`src/jurisdictions/il/rules/credit-points-tables.ts` rules module, switches the
credit-points accumulator to **integer twelfths of a point**, and adds the
optional `label` to `CreditPointsBreakdownRow` — and it **explicitly defers**
academic degrees, keeping `'degree'` out of the breakdown `reason` union on
purpose. **This plan lands that deferred item** for the three tracks the
primary-source addendum declares unblockable: **bachelor, master, and
vocational certificate**. It requires the base plan's Tasks 1–4 to be merged
first (twelfths accumulator + `label` + rules directory). It does **not**
depend on the parent-allocation follow-on
(`docs/superpowers/plans/2026-07-13-parent-allocation.md`) — the two are
independent siblings on top of the base plan.

**Goal:** Given a reviewer-supplied structured description of the filer's
degree/certificate (track, completion year, study years, and — where the law
gives a choice — the elected claim year or internship deferral), have the
engine derive **whether the tax year being calculated falls inside the
statutory claim window** and, if so, emit the §40ג–§40ה credit points with a
Hebrew-labelled breakdown row (`reason: 'degree'`). 2023+ completions get the
**fixed** consecutive window; 2014–2022 completions get the **single elective
year**; internship professions get the §6 start-shift election. Everything
else — medicine/dentistry PhD, direct-track PhD, pre-2014 completions — stays
on the `additionalCreditPoints` reviewer escape hatch (see "Out of scope /
deferred").

---

## Source of truth for every point count and rule in this plan

`docs/superpowers/research/2026-07-13-degrees-40g-addendum.md` (the
**primary-source** degrees addendum): the Form 119 דברי הסבר (רשות המסים,
updated 11.2024, covering tax years 2024 & 2025) read line by line — bachelor
§1, master §2, vocational §3, internship deferral §4, PhD tracks §5, verdict
§6. It resolves the items the earlier draft
(`docs/superpowers/research/2026-07-13-credit-points-verification.md` §2)
left UNRESOLVED — most importantly **fixed-vs-elective claim years** (2023+ is
FIXED; the election belongs to the 2014–2022 cohort only) and the **master's
`min(study years, 2)` correction** (not a flat 2). **Do not copy point counts
or window rules from anywhere else and do not "remember" them** — read them
from the addendum tables; the engine's `// source:` comments cite the
addendum, and the addendum cites Form 119 verbatim.

**Sub-letter caveat carried from the addendum's header:** Form 119 groups all
tracks under "סעיפים 40ג עד 40ה" without printing which sub-letter governs
which track; the conventional "degrees → §40ג, vocational → §40ד" split is
secondary-sourced. The engine's `// source:` comments therefore cite **the
addendum section**, not a bare ordinance sub-letter; finalizing the sub-letter
labels is an owner-verify item (substance unaffected).

**Why this is now unblockable (addendum §6):** the 2023+ fixed
`min(study years, cap)` windows, the 2014–2022 elective single year, the
internship start-shift, and the §7(ב)/§7(ג) exclusivity rules are all
**primary-confirmed** for bachelor/master/vocational. The remaining open items
(sub-letter labels, "study years" edge definition) do not change any number
this plan encodes — they are carried in the checklist.

**Spec / house rules:** `docs/superpowers/specs/2026-07-03-tax-returns-app-design.md`
§3, §9; CLAUDE.md ("Tax-law constants must cite official sources"; engine
"fails loudly, never silently defaults a number"; money is integer agorot).

---

## Architecture decision: a sibling rules module; the engine derives the window, the reviewer supplies the facts

**Rules module, not year data.** The track point rates, year caps, and cohort
boundaries are *statutory* (not §120ב-indexed money) and identical for 2024 and
2025, so — mirroring the base plan — they live in the jurisdiction-level rules
directory the base plan creates: a new
**`src/jurisdictions/il/rules/degree-credit-points.ts`** beside
`credit-points-tables.ts`. The per-year `years/*.ts` files are NOT touched.

**The engine derives the window; it never derives eligibility.** The reviewer
attests the *facts* (the degree is a recognized degree per §7(ה), the
vocational studies meet the ≥1,700-hour / government-ministry-recognized
certificate conditions of §7(ו), proof of completion per §7(א) exists, the
profession genuinely requires an internship for §6) — none of that is
machine-checkable from documents we hold. What the engine **does** own is the
pure arithmetic the addendum confirmed: which tax years the benefit occupies
and how many points per year. This keeps the auditable calculation in code and
the un-auditable attestations with the human, exactly like the
parent-allocation plan's "the engine does NOT decide custody" boundary.

**Integer twelfths throughout** (base plan's unit): 1 point = 12 twelfths,
0.5 point = 6 twelfths. Every degree rate is an exact twelfth multiple, so the
accumulator stays float-free with no new rounding rules.

**Window edge semantics — 0 vs throw (deliberate).** A degree whose claim
window does not include the tax year being calculated yields **0 points and no
breakdown row — not an error**. Rationale: the `degrees` input describes the
filer's education *history*, which is legitimate, unchanging input for any tax
year — a BA whose window was 2021 must not force the reviewer to strip the
entry from the 2024 profile; it simply contributes nothing in 2024 (and would
contribute in a year it does cover). By contrast, input that is *contradictory
in every year* — unknown track, non-positive/absurd `studyYears`, an elective
year supplied for a 2023+ completion, internship parameters violating the
addendum-§4 conditions, §7(ב)/§7(ג) exclusivity violations — is a loud
`InvalidTaxInputError` (fail-loud convention: a wrong input must never
silently become a plausible number).

---

## Confirmed rules to encode (from the addendum — do not alter)

### Track table — points per benefit year and window length (addendum §1, §2, §3)

| Track | Points/benefit-year | Twelfths/yr | 2023+ window length | 2014–2022 benefit | Source |
|---|---|---|---|---|---|
| `bachelor` (תואר ראשון) | 1 | 12 | `min(studyYears, 3)` | 1 pt, single elective year | addendum §1 (form119-2024 §1) |
| `master` (תואר שני) | 0.5 | 6 | `min(studyYears, 2)` | 0.5 pt, single elective year | addendum §2 (form119-2024 §2) |
| `vocational` (תעודת מקצוע) | 1 | 12 | `min(studyYears, 3)` | 1 pt, single elective year | addendum §3 (form119-2024 §5) |

Note the master's correction the addendum makes to the earlier draft: the
2023+ master's window is `min(studyYears, 2)` — a one-year master's program
yields only **one** year of the 0.5 point, not two (addendum §2).

### Claim-window mechanics (addendum §1, §2, §3, §6-verdict)

| Cohort (by `completionYear`) | Window | Election? |
|---|---|---|
| **2023 onward** | **FIXED** consecutive tax years, starting the tax year **after** studies (or internship, see below) ended, running for the track's window length | **None** — "החל משנת המס שלאחר"; supplying `electedClaimYear` for this cohort is contradictory input → throw |
| **2014–2022** | **Single** benefit year: the tax year after completion **or** the following year, taxpayer's choice ("לפי בחירתו") | **Required** — `electedClaimYear` must be supplied and must be one of the two candidates |
| **Before 2014** | not researched (older regimes) | → loud throw directing the reviewer to `additionalCreditPoints` (out of scope) |

### Internship deferral — §6 of Form 119 (addendum §4)

For a **bachelor's or master's** in a profession that requires an internship
(degree completion a condition of the internship — law, accountancy, …), where
the **internship ended in 2012 or later** and **began no later than the tax
year after** degree completion, the taxpayer may **elect** the benefit start to
be the tax year after the **internship** ended instead of the tax year after
the degree studies ended. This is the only election surviving into the 2023+
regime, and it **shifts the window start only — it never adds years**
(addendum §4). Never applicable to `vocational`.

### Exclusivity — §7(ב) and §7(ג) (addendum §3 table, §6-verdict item 4)

- **§7(ב) one benefit per level:** at most one `bachelor` entry, one `master`
  entry, one `vocational` entry (two bachelor's ⇒ still one benefit, per the
  form's own example). Duplicate track in the input → throw.
- **§7(ג) degree XOR vocational:** the taxpayer must **choose** between the
  degree benefit and the vocational benefit — a `degrees` array containing
  `vocational` together with `bachelor` or `master` is contradictory input →
  throw. The engine does **not** pick the cheaper option for the taxpayer
  (that is the reviewer's/taxpayer's election, like every other election in
  this plan).
- `bachelor` + `master` **together is valid** (different levels, e.g. a
  2014–2022 BA elective year overlapping a 2023+ MA window) — flagged in the
  checklist for owner confirmation of the per-level reading.

---

## Engine shape (concrete)

### `src/core/types.ts` — new optional structured input (additive)

Extend `TaxpayerInput` (existing callers keep working; API/web continue to
send only `additionalCreditPoints`):

```
/** §40ג–§40ה degree/vocational credit points. Reviewer-supplied; the reviewer
 *  attests eligibility (recognized degree §7(ה), vocational conditions §7(ו),
 *  proof §7(א)); the engine derives the claim window and points for the tax
 *  year. Absent → no degree points from structured input
 *  (additionalCreditPoints remains the fallback).
 *  source: docs/superpowers/research/2026-07-13-degrees-40g-addendum.md */
degrees?: Array<{
  track: 'bachelor' | 'master' | 'vocational';
  /** Tax year in which the studies for this degree/certificate ended. ≥ 2014
   *  (earlier cohorts are out of scope → loud throw). */
  completionYear: number;
  /** Academic study years (integer ≥ 1; window length = min(studyYears, cap)). */
  studyYears: number;
  /** 2014–2022 cohort ONLY: the single elected benefit year — base+1 or base+2
   *  (base = internship end year if internship supplied, else completionYear).
   *  Required for that cohort; forbidden (loud throw) for 2023+. */
  electedClaimYear?: number;
  /** Form 119 §6 internship deferral (bachelor/master only). Presence = the
   *  taxpayer ELECTS the internship-based start (window/candidates run from
   *  endYear + 1 instead of completionYear + 1). */
  internship?: { startYear: number; endYear: number };
}>;
```

Widen `CreditPointsBreakdownRow.reason` with `'degree'` (the value the base
plan deliberately left out).

### New file — `src/jurisdictions/il/rules/degree-credit-points.ts`

- `DEGREE_TRACKS: Record<'bachelor' | 'master' | 'vocational', { twelfthsPerYear: number; capYears: number }>`
  — frozen: `bachelor {12, 3}`, `master {6, 2}`, `vocational {12, 3}`, each
  line annotated
  `// source: docs/.../2026-07-13-degrees-40g-addendum.md §1/§2/§3 (form119-2024)`.
  (Sub-letter §40ג/§40ד labels deferred to the owner-verify item — comments
  cite the addendum, not a bare sub-letter.)
- Pure `assertDegreeExclusivity(degrees): void` — throws
  `InvalidTaxInputError('taxpayer.degrees', …)` on a duplicate track (§7(ב))
  or on `vocational` mixed with `bachelor`/`master` (§7(ג)); Hebrew-free
  machine message but citing the paragraph, per existing error style.
- Pure `degreeTwelfthsForTaxYear(degree, taxYear): { twelfths: number; label: string }`:
  1. **Guards (throw `InvalidTaxInputError`):** unknown `track`; `studyYears`
     not a safe integer, `< 1`, or `> 10` (absurdity bound); `completionYear
     < 2014`; `electedClaimYear` supplied when `completionYear >= 2023`;
     `electedClaimYear` absent when `completionYear` in 2014–2022;
     `internship` on `vocational`; `internship.endYear < 2012` (§6 applies to
     internships ending 2012+); `internship.startYear > completionYear + 1`
     (§6 condition "תחל לא יאוחר משנת המס שלאחר"); `internship.endYear <
     internship.startYear`; `internship.endYear < completionYear` (a deferral
     cannot move the start earlier).
  2. `base = internship?.endYear ?? completionYear`.
  3. **2023+:** `windowStart = base + 1`,
     `windowLength = min(studyYears, capYears)`; if
     `windowStart <= taxYear <= windowStart + windowLength - 1` →
     `twelfths = twelfthsPerYear`, else `0`.
  4. **2014–2022:** candidates `{base + 1, base + 2}`; `electedClaimYear`
     outside the candidate set → throw; `taxYear === electedClaimYear` →
     `twelfths = twelfthsPerYear`, else `0`.
  5. `label` (Hebrew, for the worksheet audit trail), e.g.
     `"תואר ראשון — נקודת זיכוי, שנה 2 מתוך 3 (סיום לימודים 2023)"`,
     `"תואר שני — חצי נקודת זיכוי (שנת מס נבחרת 2024)"`,
     with an internship suffix `"(נדחה לאחר התמחות שהסתיימה ב-2024)"` when
     the deferral applies.

### `src/jurisdictions/il/modules/credit-points.ts`

- After the base plan's children/oleh handling: if `taxpayer.degrees` is
  present, call `assertDegreeExclusivity(taxpayer.degrees)` once, then for each
  degree call `degreeTwelfthsForTaxYear(degree, yearData.year)`; push a
  `{ reason: 'degree', points: twelfths / 12, label }` row **only when
  `twelfths > 0`** (out-of-window degrees add nothing — no zero rows), and add
  the twelfths to the accumulator. No new accumulator work — the base plan
  already switched to twelfths.

### `src/calculate.ts`

- No new orchestration — `computeCreditPoints(input.taxpayer, yearData)`
  already receives the whole taxpayer and the year. **Bump `ENGINE_VERSION`
  to the next free minor — expected `il-0.5.0`** (currently shipped:
  `il-0.3.0`, the 15% non-linked-interest branch; the base credit-points plan
  lands as `il-0.4.0`). Note: the parent-allocation follow-on also targets the
  next free minor after the base — **confirm the actual predecessor version at
  implementation time and take the next free minor** (if parent-allocation
  landed first as `il-0.5.0`, this becomes `il-0.6.0`); record the change in
  the `ENGINE_VERSION` comment block.

**Downstream, NOT in this plan (note only):** `degrees` is optional and
additive, so the API `CalculateRequestSchema` / `map-confirmed-data` and the
web worksheet form keep working unchanged (they still send only
`additionalCreditPoints`). Wiring `degrees` through the shared Zod schemas,
the API, and a reviewer UI (track picker, cohort-aware elected-year field,
internship fields) is a **separate future plan** — same boundary as the base
plan's downstream note. Until then the reviewer keeps entering a verified
total via `additionalCreditPoints`.

---

## TDD step sequence (failing test → run red → implement → green → commit)

Per CLAUDE.md: failing test first, run it red, implement, green, commit. Root
`pnpm test` + `pnpm typecheck` stay green; the engine ≥95% branch-coverage
gate applies to all new branches (there are many guards — cover each).
**Prerequisite: the base credit-points plan (twelfths accumulator, rules
directory, breakdown `label`) is merged.**

### Task 1 — track table + 2023+ fixed-window derivation
**Files:** `src/jurisdictions/il/rules/degree-credit-points.ts` (new),
`test/jurisdictions/il/degree-credit-points.test.ts` (new).
- [ ] Failing tests for `degreeTwelfthsForTaxYear`, 2023+ cohort:
      bachelor completed 2023, `studyYears: 3` → 12 twelfths in each of
      2024/2025/2026, 0 in 2023 and 2027; bachelor `studyYears: 4` → still 3
      years (cap); master completed 2023, `studyYears: 2` → 6 twelfths in
      2024 and 2025 only; master `studyYears: 1` → 6 twelfths in 2024 only
      (the addendum-§2 `min(studyYears, 2)` correction — load-bearing);
      vocational completed 2024, `studyYears: 2` → 12 twelfths in 2025 and
      2026; labels present. Guards: unknown track, `studyYears` 0 / −1 / 2.5
      / 11, and `completionYear: 2013` all throw `InvalidTaxInputError`.
- [ ] Implement `DEGREE_TRACKS` + the 2023+ branch with `// source:` comments
      citing addendum §1/§2/§3.
- [ ] Green; commit `feat(tax-engine): §40ג degree/vocational claim-window table (2023+ regime)`.

### Task 2 — 2014–2022 elective cohort
**Files:** same rules file + test (extend).
- [ ] Failing tests: bachelor completed 2022, `electedClaimYear: 2024` →
      12 twelfths in 2024, 0 in 2023/2025; master completed 2020,
      `electedClaimYear: 2021` → 6 twelfths in 2021, 0 in 2024 (history entry
      contributes nothing later — the 0-not-throw semantics). Guards:
      `electedClaimYear` **absent** for a 2014–2022 completion throws;
      `electedClaimYear` outside `{completionYear+1, completionYear+2}`
      throws; `electedClaimYear` **supplied** for a 2023 completion throws.
- [ ] Implement the elective branch with `// source:` comments (addendum
      §1/§2/§3, "לפי בחירתו").
- [ ] Green; commit `feat(tax-engine): 2014–2022 elective degree claim year (§40ג)`.

### Task 3 — internship (התמחות) start deferral, §6
**Files:** same rules file + test (extend).
- [ ] Failing tests: bachelor completed 2023, `internship: { startYear: 2024,
      endYear: 2024 }`, `studyYears: 3` → window 2025–2027 (0 in 2024, 12 in
      2025) — start shifted, length unchanged; 2014–2022 + internship:
      bachelor completed 2021, `internship: { startYear: 2022, endYear: 2023 }`,
      `electedClaimYear: 2024` → 12 twelfths in 2024 (candidates run from the
      internship end — see checklist item on this interaction). Guards:
      `internship` on `vocational` throws; `endYear: 2011` throws (pre-2012);
      `startYear > completionYear + 1` throws; `endYear < startYear` throws;
      `endYear < completionYear` throws.
- [ ] Implement the `base = internship?.endYear ?? completionYear` shift +
      guards with `// source:` comments (addendum §4).
- [ ] Green; commit `feat(tax-engine): internship (התמחות) start deferral for degree credit points`.

### Task 4 — §7(ב)/§7(ג) exclusivity guards
**Files:** same rules file + test (extend).
- [ ] Failing tests for `assertDegreeExclusivity`: two `bachelor` entries
      throw (§7(ב)); `vocational` + `bachelor` throws and `vocational` +
      `master` throws (§7(ג)); `[bachelor, master]`, `[vocational]`, and `[]`
      pass.
- [ ] Implement with `// source:` comments (addendum §3 table, form119-2024
      §7(ב)/(ג)).
- [ ] Green; commit `feat(tax-engine): §7(ב)/§7(ג) degree-benefit exclusivity guards`.

### Task 5 — wire degrees into `computeCreditPoints`
**Files:** `src/core/types.ts`, `src/jurisdictions/il/modules/credit-points.ts`,
`test/jurisdictions/il/credit-points.test.ts` (extend; all existing cases —
including the base plan's children/oleh cases — must stay green unchanged).
- [ ] Failing tests: resident man + bachelor (completed 2023, `studyYears: 3`)
      for tax year 2024 → 2.25 + 1 = 3.25 points with a labelled `'degree'`
      row; resident woman + bachelor (2014–2022, elected 2024) + master
      (completed 2023, `studyYears: 2`) for 2024 → 2.75 + 1 + 0.5 = 4.25 with
      two `'degree'` rows; an out-of-window degree adds **no** row and leaves
      points unchanged; `vocational` + `bachelor` in the array propagates the
      loud throw; degrees combine with `additionalCreditPoints` and children
      to an exact twelfth-integer `valueAgorot` (assert exact agorot).
- [ ] Extend `TaxpayerInput` with `degrees`, widen the breakdown `reason`
      union with `'degree'`, consume the two helpers in the module.
- [ ] Green; commit `feat(tax-engine): compute §40ג–§40ה degree credit points from structured input`.

### Task 6 — end-to-end golden scenario + ENGINE_VERSION bump
**Files:** `src/calculate.ts`, `test/calculate.test.ts` (extend).
- [ ] Failing golden test: full `calculate()` for 2025 with a salary and a
      bachelor (completed 2023, `studyYears: 3` — 2025 is window year 2 → 1
      point), asserting `creditPoints.points`, `creditPoints.valueAgorot`,
      and the resulting `refundAgorot`.
- [ ] Bump `ENGINE_VERSION` to the next free minor (expected `il-0.5.0` —
      confirm the actual predecessor first, see engine-shape note) and update
      the comment block.
- [ ] Green; full root `pnpm test` + `pnpm typecheck`; engine branch coverage
      ≥95%. Commit `feat(tax-engine): degree credit points end-to-end (il-0.5.0)`.

### Task 7 — docs
- [ ] Update the CLAUDE.md tax-engine current-state row (credit points now
      compute §40ג–§40ה bachelor/master/vocational windows from structured
      input; medicine/direct-track PhD and pre-2014 completions still on
      `additionalCreditPoints`; new `ENGINE_VERSION`). Commit
      `docs: note degree credit points in CLAUDE.md`.

---

## ⚠️ Owner must verify before merge

**These gate the merge — the plan is built so every open item either fails
loud or routes to `additionalCreditPoints` rather than guessing.**

- [ ] **§40ג vs §40ד sub-letter allocation per track** (addendum header +
      §6-verdict). Form 119 groups the tracks under "40ג עד 40ה" without
      sub-attribution; "degrees → §40ג, vocational → §40ד" is secondary
      (CPA/כל-זכות). Read the ordinance text (nevo / consolidated gov.il PDF)
      and finalize the `// source:` sub-letter labels. **Substance (counts,
      windows) is unaffected** — this gates only the citation comments.
- [ ] **"Study years" definition** (addendum §6-verdict). Form 119 says
      "שנות לימודיו האקדמיות" — confirm whether part-years / repeated years
      count. Until then the reviewer supplies `studyYears` as a whole integer
      per their reading of the record; the engine's ≥1 / ≤10 guard is a
      sanity bound, not a legal rule.
- [ ] **2014–2022 cohort × internship interaction.** The plan derives the two
      elective candidates from the internship end (`{endYear+1, endYear+2}`)
      when the deferral is elected. The addendum confirms the §6 start-shift
      and the cohort's two-candidate election separately but not their
      combined verbatim reading — confirm the candidate set before trusting a
      2014–2022 + internship input (rare; `additionalCreditPoints` covers it
      meanwhile).
- [ ] **§7(ב) per-level reading (BA + MA stacking).** The plan allows one
      `bachelor` and one `master` together (one benefit *per level*). The
      form's own example covers only two bachelor's ⇒ one benefit; confirm the
      per-level (not one-total) reading against the form/ordinance.
- [ ] **Reviewer-attested eligibility is acceptable.** The engine does not
      check §7(ה) degree recognition, §7(ו) vocational conditions (≥1,700
      hours, government-ministry-recognized certificate), §7(א) proof, or
      whether a profession genuinely requires an internship — the reviewer
      attests these before supplying the input. Confirm this process
      boundary.
- [ ] **ENGINE_VERSION predecessor.** Confirm which of the base /
      parent-allocation plans have shipped and take the next free minor
      (expected `il-0.5.0`).

---

## Out of scope / deferred (explicitly not built here)

- **Medicine/dentistry PhD and direct-track PhD schedules** — addendum §5
  records their primary numbers (3×1 pt + 2×0.5 pt etc.), but the owner has
  not yet decided whether to model them; they stay on
  `additionalCreditPoints`. The `track` union deliberately omits them —
  supplying an unknown track is a loud throw, never a silent 0. Includes the
  §7(ד) bachelor-then-medicine top-up interaction.
- **Pre-2014 completions** — older regimes not researched; `completionYear <
  2014` throws with a message directing the reviewer to
  `additionalCreditPoints`.
- **Choosing for the taxpayer.** The engine never optimises the 2014–2022
  elected year, the internship-start election, or the §7(ג) degree-vs-
  vocational choice — all are reviewer inputs; contradictions fail loud.
- **Downstream wiring** — shared Zod schema, API `CalculateRequestSchema` /
  `map-confirmed-data`, and the web worksheet form for `degrees` are a
  separate future plan (same boundary as the base plan).
- **Children/oleh internals, parent allocation, returning residents** —
  untouched here (owned by the base plan / their own plans).

`additionalCreditPoints` remains the catch-all reviewer input for every
category above and for any degree edge case this increment does not model.
