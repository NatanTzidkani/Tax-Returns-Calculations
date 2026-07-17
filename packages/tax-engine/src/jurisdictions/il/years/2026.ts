import { agorot } from '@taxreturns/shared';
import type { IlYearData } from '../../../core/types';
import { il2025 } from './2025';

// ---------------------------------------------------------------------------
// Israel, tax year 2026. All amounts are ANNUAL integer agorot (₪ × 100).
//
// 2026 is NOT a plain freeze year. The freeze law (חוק ההתייעלות הכלכלית
// (הקפאת עדכוני מס ומס יסף), התשפ"ה-2024, ס"ח 3342) still suppresses §120ב
// indexation for 2025-2027, BUT on 31.3.2026 חוק ההתייעלות הכלכלית (תיקוני
// חקיקה להשגת יעדי התקציב לשנת התקציב 2026), התשפ"ו-2026, פרק ג ("ריווח
// מדרגות מס הכנסה") amended §121 itself, retroactive to 1.1.2026 — widening
// income-tax brackets 3 and 4 by statute. Everything else carries over from
// the 2025 file; the NI bands did update (CPI/average-wage driven).
//
// Primary source ("booklet-2026"): רשות המסים, לוח עזר לחישוב מס הכנסה
// ממשכורת ושכר עבודה לחודש ינואר 2026 ואילך — the APRIL-2026 re-publication
// ("מעודכן לאפריל 2026"; pre-April cached editions predate the §121 fix) —
// https://www.gov.il/BlobFolder/generalpage/income-tax-monthly-deductions-booklet/he/generalInformation_income-tax-monthly-deductions-booklet_monthly-deductions-booklet-2026.pdf
// All constants verified-primary in
// docs/superpowers/research/2026-07-17-il-2026-year-data.md.
// Owner MUST verify every constant before relying on results (spec §3).
// ---------------------------------------------------------------------------

export const il2026: IlYearData = {
  ...il2025,
  year: 2026,

  // Annual brackets, יגיעה אישית. The array is restated in full: brackets 3-4
  // were WIDENED by תשפ"ו-2026 (§121(ב) as amended; booklet-2026 פרק א §א +
  // פרק ב, monthly 7,010 / 10,060 / 19,000 / 25,100 / 46,690); brackets
  // 1/2/5 and the 47% marginal rate stay frozen at 2024 values (ס"ח 3342).
  brackets: [
    { upToAgorot: agorot(8_412_000), rateBp: 1_000 }, // עד 84,120 ₪ — 10% (frozen)
    { upToAgorot: agorot(12_072_000), rateBp: 1_400 }, // עד 120,720 ₪ — 14% (frozen)
    // "על כל שקל חדש מ-120,721 ש"ח עד 228,000 ש"ח – יחול שיעור מס 20%"
    { upToAgorot: agorot(22_800_000), rateBp: 2_000 }, // עד 228,000 ₪ — 20% (WIDENED)
    // "על כל שקל חדש מ-228,001 ש"ח עד 301,200 ש"ח – יחול שיעור מס 31%"
    { upToAgorot: agorot(30_120_000), rateBp: 3_100 }, // עד 301,200 ₪ — 31% (WIDENED)
    { upToAgorot: agorot(56_028_000), rateBp: 3_500 }, // עד 560,280 ₪ — 35% (frozen)
    { upToAgorot: null, rateBp: 4_700 }, // מכל שקל נוסף — 47% (§121(א)(3))
  ],

  surtax: {
    // Restated explicitly (not silently inherited) so the 2026 validity is
    // documented. Threshold 721,560 ₪ at 3% — booklet-2026 פרק ב; pakuda
    // §121ב(א) annotation "בשנים 2024–2027, 721,560 ש״ח".
    thresholdAgorot: agorot(72_156_000),
    rateBp: 300,
    // The 2% capital add-on PERSISTS in 2026: §121ב(א1) (תיקון תשפ"ה-2) is a
    // permanent provision with no sunset clause; booklet-2026 פרק ב restates
    // it for 2026. (Not modeled: §121ב(ה) counts dwelling-sale שבח toward
    // surtax only above a 5,385,285 ₪ sale value in 2026.)
    capitalAdditionalRateBp: 200,
  },

  nationalInsurance: {
    // Employee rates unchanged from 2025: the 2025 הוראת-שעה runs through
    // the end of 2026 (btl חוזר מעסיקים 1522, 01/01/2026: reduced 1.04% NI +
    // 3.23% health; full 7.00% + 5.17% — all 12 months, no January step).
    ...il2025.nationalInsurance,
    // Reduced band top: 7,703 ₪/mo. NOTE — the legal basis CHANGED in 2026:
    // no longer 60% × average wage. btl-1522-2026 defines a statutory
    // "מדרגת גביה מופחתת" — the 7,522 ₪ figure CPI-indexed in its own right
    // each 1 January ("בשנים 2026-2028 – לפי שיעור עליית המדד") → 7,703 ₪
    // for 2026 (≈55.9% of the new 13,769 ₪ average wage).
    reducedBandTopMonthlyAgorot: agorot(770_300),
    // 51,910 ₪/mo ceiling. source: btl-1522-2026 ("הכנסה מרבית לתשלום דמי
    // ביטוח היא 51,910 ₪ ברוטו לחודש"); בל/651 (01.2026) identical.
    ceilingMonthlyAgorot: agorot(5_191_000),
  },

  // Inherited unchanged from il2025 via the spread (all verified for 2026 in
  // the research report): credit point 2,904 ₪/yr (booklet-2026 פרק ג §א,
  // 242 ₪/mo), §46 charity 35% / 207 ₪ min / 10,354,816 ₪ ceiling / 30%
  // income share (booklet-2026 פרק ג §ג; §46(א)), §45א pension 35% / 7% /
  // 116,400 ₪ qualifying ceiling (booklet-2026 פרק ג §ב), capital gains 25%
  // (§91(ב)(1)) and non-linked interest 15% (§125ג(ג)(1), fixed statutory).
};
