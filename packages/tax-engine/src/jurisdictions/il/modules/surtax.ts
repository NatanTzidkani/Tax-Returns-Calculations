import { agorot, type Agorot } from '@taxreturns/shared';
import { maxAgorot, minAgorot, percentBp, subAgorot } from '../../../core/money';
import type { IlYearData, SurtaxResult } from '../../../core/types';

/**
 * מס יסף (§121ב): 3% on total taxable income above the threshold; from 2025
 * an additional 2% on the CAPITAL-SOURCE part of the income above the
 * threshold (חוק ההתייעלות הכלכלית התשפ"ה-2024). The capital part above the
 * threshold is min(capital income, income above threshold) — work income
 * fills the band below the threshold first (owner-verify reading of §121ב(ה)).
 */
export function computeSurtax(
  totalTaxableAgorot: Agorot,
  capitalTaxableAgorot: Agorot,
  yearData: IlYearData,
): SurtaxResult {
  const threshold = yearData.surtax.thresholdAgorot;
  const base = maxAgorot(agorot(0), subAgorot(totalTaxableAgorot, threshold));
  const capitalBase = minAgorot(capitalTaxableAgorot, base);
  const basic = percentBp(base, yearData.surtax.rateBp);
  const capitalAdditional = percentBp(
    capitalBase,
    yearData.surtax.capitalAdditionalRateBp,
  );

  return {
    thresholdAgorot: threshold,
    baseAgorot: base,
    basicSurtaxAgorot: basic,
    capitalBaseAgorot: capitalBase,
    capitalAdditionalSurtaxAgorot: capitalAdditional,
    totalAgorot: agorot(basic + capitalAdditional),
  };
}
