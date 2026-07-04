import { agorot, addAgorot, type Agorot } from '@taxreturns/shared';
import { InvalidTaxInputError } from '../../../core/errors';
import { minAgorot, percentBp, subAgorot } from '../../../core/money';
import type { CharityResult, DonationInput, IlYearData } from '../../../core/types';

/**
 * Section 46 donation credit: 35% of donations to approved institutions,
 * when the yearly total passes the statutory minimum, capped at the lower
 * of the absolute ceiling and 30% of taxable income. The part above the
 * ceiling is reported as carry-forward (the DB tracks its 3-year window).
 */
export function computeCharityCredit(
  donations: DonationInput[],
  taxableIncomeAgorot: Agorot,
  yearData: IlYearData,
): CharityResult {
  donations.forEach((d, i) => {
    if (d.amountAgorot < 0) {
      throw new InvalidTaxInputError(
        `donations[${i}].amountAgorot`,
        `must be ≥ 0, got ${d.amountAgorot}`,
      );
    }
  });

  const total = addAgorot(...donations.map((d) => d.amountAgorot));
  const appliedCeiling = minAgorot(
    yearData.charity.ceilingAgorot,
    percentBp(taxableIncomeAgorot, yearData.charity.ceilingIncomeShareBp),
  );

  if (total < yearData.charity.minTotalAgorot) {
    return {
      totalDonationsAgorot: total,
      appliedCeilingAgorot: appliedCeiling,
      eligibleAgorot: agorot(0),
      creditAgorot: agorot(0),
      carryforwardOutAgorot: agorot(0),
      belowMinimum: true,
    };
  }

  const eligible = minAgorot(total, appliedCeiling);
  return {
    totalDonationsAgorot: total,
    appliedCeilingAgorot: appliedCeiling,
    eligibleAgorot: eligible,
    creditAgorot: percentBp(eligible, yearData.charity.creditRateBp),
    carryforwardOutAgorot: subAgorot(total, eligible),
    belowMinimum: false,
  };
}
