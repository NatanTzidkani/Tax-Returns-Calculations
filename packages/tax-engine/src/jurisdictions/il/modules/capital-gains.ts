import { addAgorot, agorot, type Agorot } from '@taxreturns/shared';
import { InvalidTaxInputError } from '../../../core/errors';
import { minAgorot, percentBp, subAgorot } from '../../../core/money';
import type {
  BrokerEntryInput,
  CapitalGainsResult,
  IlYearData,
} from '../../../core/types';

/**
 * Capital-market income across brokers (Form 867 aggregation).
 *
 * Offsetting order (§92 — owner-verify):
 * 1. Current-year real losses net against current-year real gains.
 * 2. Leftover current-year securities losses net against same-year
 *    interest/dividend income from securities (§92(א)(4)).
 * 3. Prior-year carry-forward nets against remaining GAINS ONLY (§92(ב) —
 *    carried-forward losses do not absorb interest/dividend income).
 * 4. Whatever loss remains leaves as next year's carry-forward.
 *
 * Tax: 25% on remaining real gains (§91(ב)(1)) and 25% on remaining
 * interest/dividend from securities (§125ב/§125ג(ב) — owner-verify; 15%
 * non-linked interest cases are out of scope until a real 867 needs them).
 */
export function computeCapitalGains(
  capital: { entries: BrokerEntryInput[]; lossCarryforwardInAgorot: Agorot },
  yearData: IlYearData,
): CapitalGainsResult {
  capital.entries.forEach((e, i) => {
    for (const key of [
      'realGainAgorot',
      'realLossAgorot',
      'interestDividendAgorot',
      'taxWithheldAgorot',
    ] as const) {
      if (e[key] < 0) {
        throw new InvalidTaxInputError(
          `capital.entries[${i}].${key}`,
          `must be ≥ 0, got ${e[key]}`,
        );
      }
    }
  });
  if (capital.lossCarryforwardInAgorot < 0) {
    throw new InvalidTaxInputError(
      'capital.lossCarryforwardInAgorot',
      `must be ≥ 0, got ${capital.lossCarryforwardInAgorot}`,
    );
  }

  const gains = addAgorot(...capital.entries.map((e) => e.realGainAgorot));
  const losses = addAgorot(...capital.entries.map((e) => e.realLossAgorot));
  const interestDividend = addAgorot(
    ...capital.entries.map((e) => e.interestDividendAgorot),
  );
  const withheld = addAgorot(...capital.entries.map((e) => e.taxWithheldAgorot));

  const offsetVsGains = minAgorot(losses, gains);
  const lossAfterGains = subAgorot(losses, offsetVsGains);
  const gainsAfterLosses = subAgorot(gains, offsetVsGains);

  const offsetVsInterestDividend = minAgorot(lossAfterGains, interestDividend);
  const lossRemaining = subAgorot(lossAfterGains, offsetVsInterestDividend);
  const taxableInterestDividend = subAgorot(
    interestDividend,
    offsetVsInterestDividend,
  );

  const carryConsumed = minAgorot(
    capital.lossCarryforwardInAgorot,
    gainsAfterLosses,
  );
  const taxableGain = subAgorot(gainsAfterLosses, carryConsumed);
  const carryOut = addAgorot(
    lossRemaining,
    subAgorot(capital.lossCarryforwardInAgorot, carryConsumed),
  );

  const rate = yearData.capitalGains.realGainRateBp;
  return {
    totalRealGainsAgorot: gains,
    totalRealLossesAgorot: losses,
    totalInterestDividendAgorot: interestDividend,
    lossCarryforwardInAgorot: capital.lossCarryforwardInAgorot,
    lossesOffsetAgainstGainsAgorot: offsetVsGains,
    lossesOffsetAgainstInterestDividendAgorot: offsetVsInterestDividend,
    carryforwardConsumedAgorot: carryConsumed,
    taxableGainAgorot: taxableGain,
    taxableInterestDividendAgorot: taxableInterestDividend,
    taxAgorot: agorot(
      percentBp(taxableGain, rate) + percentBp(taxableInterestDividend, rate),
    ),
    withheldAgorot: withheld,
    lossCarryforwardOutAgorot: carryOut,
  };
}
