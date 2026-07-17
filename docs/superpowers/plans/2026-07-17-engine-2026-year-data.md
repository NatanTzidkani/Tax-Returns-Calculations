# Engine 2026 year data — il-0.8.0

**Date:** 2026-07-17 · **Status:** COMPLETE 2026-07-17 (all TDD steps as
written; awaiting the owner's constants-verification pass and merge review
on branch `feat/engine-2026-year-data`)
**Research anchor:** `docs/superpowers/research/2026-07-17-il-2026-year-data.md`
— every constant an `IlYearData` file needs, all **verified-primary**
(booklet-2026 April-edition, btl 1522/בל-651 2026 circulars, consolidated
פקודה incl. תיקון תשפ"ו-6). Per house rule the constants still await the
**owner's verification pass** before results are relied on, exactly as
`docs/superpowers/research/2026-07-05-tax-constants-verification.md` did for
the 2024/2025 files.

## Design

**One new year file, `packages/tax-engine/src/jurisdictions/il/years/2026.ts`,
registered in the existing map.** 2026 is **NOT a plain freeze-spread of
2025**: חוק ההתייעלות הכלכלית (תיקוני חקיקה להשגת יעדי התקציב לשנת התקציב
2026), התשפ"ו-2026 (enacted 31.3.2026, retroactive to 1.1.2026) amended §121
itself and **widened brackets 3 and 4**:

| Changed vs 2025 | 2025 | 2026 | Agorot |
|---|---|---|---|
| Bracket 3 top (20%) | 193,800 ₪ | **228,000 ₪** | 22,800,000 |
| Bracket 4 top (31%) | 269,280 ₪ | **301,200 ₪** | 30,120,000 |
| NI reduced-band top | 7,522 ₪/mo | **7,703 ₪/mo** | 770,300 |
| NI monthly ceiling | 50,695 ₪/mo | **51,910 ₪/mo** | 5,191,000 |

Everything else carries over from 2025 (frozen by ס"ח 3342 or fixed statutory
rates): brackets 1/2/5 tops + 47%, credit point 2,904 ₪/yr, surtax 721,560 ₪
@ 3% **plus the 2% capital add-on — §121ב(א1) is permanent law, it persists
in 2026**, §46 (35% / 207 ₪ / 10,354,816 ₪ / 30%), §45א (35% / 7% /
116,400 ₪), §91(ב)(1) 25%, §125ג(ג)(1) 15%, NI employee rates
1.04/3.23/7.00/5.17 (the 2025 הוראת-שעה runs through 2026).

Structure mirrors `2025.ts` (`...il2025` spread + explicit overrides), except:

- the **brackets array is overridden in full** (arrays can't be partially
  spread; a naive `...il2025` would silently keep the old band 3/4 tops);
- the **surtax block is restated explicitly** with the §121ב(א1)-is-permanent
  citation, so the add-on's 2026 validity is documented rather than silently
  inherited;
- the NI reduced-band comment is **rewritten, not copied**: from 2026 the
  band is no longer derived as 60% × average wage — btl-1522-2026 defines a
  statutory "מדרגת גביה מופחתת" CPI-indexed in its own right (7,703 ₪ ≈ 55.9%
  of the new 13,769 ₪ average wage).

Registration: add `il2026` to the `YEAR_DATA` map in
`src/jurisdictions/il/index.ts` — `SUPPORTED_IL_YEARS` derives from the map,
and no api/web code hardcodes a supported-years list (the dashboard caps
add-year at the current calendar year; the api validates year shape only and
surfaces the engine's `UnknownTaxYearError` as Hebrew 400), so no changes
outside the engine.

`ENGINE_VERSION` → **il-0.8.0** (new year data = minor), with a changelog
line in the version comment block.

## TDD steps

- [x] **Red — year data:** rework `test/jurisdictions/il/year-data.test.ts`:
      `SUPPORTED_IL_YEARS` = `[2024, 2025, 2026]` (unsupported-year probe
      moves 2026 → 2030); bracket-table expectation parametrized per year
      (2024/2025 table vs the widened 2026 table); frozen constants loop runs
      over all three years (credit point, surtax threshold/rate, §46, §45א,
      25%, §125ג 15%); capital add-on `year >= 2025 ? 200 : 0` (2026 = 200);
      NI block: 2026 keeps the 2025 employee rates but reduced band 770,300
      and ceiling 5,191,000 agorot/mo.
- [x] **Red — modules:** `income-tax.test.ts` 2026 cases against the official
      table, incl. divergence cases landing in the widened bands (200,000 ₪ →
      29,392 ₪ in 3 rows; 250,000 ₪ → 41,812 ₪ vs 45,574 ₪ in 2025; boundary
      301,200 ₪ → 57,684 ₪; 800,000 ₪ → 261,030.40 ₪ vs 266,069.20 ₪ — the
      full statutory saving 5,038.80 ₪). `national-insurance.test.ts` 2026
      cases: reduced band 12×7,703 = 92,436 ₪ → 394,702 agorot at 4.27%,
      full-rate band above it, ceiling 12×51,910. `calculate.test.ts`: golden
      2026 salary scenario in the widened band (same input priced under 2025
      vs 2026 shows the 3,762 ₪ saving) + high-earner 2026 surtax scenario
      proving the 2% capital add-on persists (same figures as the 2025 golden:
      basic 2,353.20 ₪, capital add-on 1,568.80 ₪, total 3,922 ₪).
- [x] **Green:** write `years/2026.ts` (every constant carries its
      official-source citation adapted from the research report), register in
      `il/index.ts`, bump `ENGINE_VERSION` to `il-0.8.0` + changelog line,
      update the `il-0.7.1` assertions in `calculate.test.ts`.
- [x] **Gates:** `pnpm --filter @taxreturns/tax-engine test:coverage` ≥95%
      branches; root `pnpm typecheck` + root `pnpm test` green. Commit
      `feat(tax-engine): il-0.8.0 — 2026 year data`.

## Out of scope (research-report watch list — NOT year-file constants)

- **§39ב combat-reserve credit points** (ס"ח 3461 + the 2026-2027 הוראת שעה
  scale) — a new rules module if ever needed; until modeled the reviewer
  fallback is `additionalCreditPoints`.
- **חוק עידוד עלייה (הוראת שעה)** yigia-ishit exemption for 2025-2026
  arrivals (600,000 ₪ cap in 2026) — irrelevant to the owner's profile;
  own module if ever needed.
- **§9א(ז) pension exemption** step to 57.5% — engine has no
  pension-exemption module.
- Shift-work credit regulations extension; **dwelling-sale surtax threshold**
  5,385,285 ₪ (§121ב(ה)) — the engine doesn't model מקרקעין.
- Any CLAUDE.md / api / web change (no hardcoded year lists found; CLAUDE.md
  update happens on merge, not on this review branch).
