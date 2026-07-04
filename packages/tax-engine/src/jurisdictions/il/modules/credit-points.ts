import { agorot } from '@taxreturns/shared';
import { InvalidTaxInputError } from '../../../core/errors';
import type {
  CreditPointsBreakdownRow,
  CreditPointsResult,
  IlYearData,
  TaxpayerInput,
} from '../../../core/types';

// Points are handled internally in quarter-point units so arithmetic stays
// integer (2.25 points = 9 quarters). sources:
// - Resident base 2.25 points (§34 + §36, נקודות זיכוי לתושב ישראל):
//   https://www.kolzchut.org.il/he/נקודות_זיכוי_ממס_הכנסה
// - Additional 0.5 point for a woman (§36א): same source.
// Children/degree/oleh tables are NOT computed here yet — the reviewer
// passes their verified total via additionalCreditPoints (plan 2, task 4).

const RESIDENT_QUARTERS = 9; // 2.25 points
const FEMALE_QUARTERS = 2; // 0.5 point

export function computeCreditPoints(
  taxpayer: TaxpayerInput,
  yearData: IlYearData,
): CreditPointsResult {
  const additional = taxpayer.additionalCreditPoints ?? 0;
  const additionalQuarters = additional * 4;
  if (additional < 0 || !Number.isSafeInteger(additionalQuarters)) {
    throw new InvalidTaxInputError(
      'taxpayer.additionalCreditPoints',
      `must be a non-negative multiple of 0.25, got ${additional}`,
    );
  }

  const breakdown: CreditPointsBreakdownRow[] = [];
  let quarters = 0;

  if (taxpayer.isIsraeliResident) {
    breakdown.push({ reason: 'resident', points: RESIDENT_QUARTERS / 4 });
    quarters += RESIDENT_QUARTERS;
    if (taxpayer.gender === 'female') {
      breakdown.push({ reason: 'female', points: FEMALE_QUARTERS / 4 });
      quarters += FEMALE_QUARTERS;
    }
  }

  if (additionalQuarters > 0) {
    breakdown.push({ reason: 'additional', points: additional });
    quarters += additionalQuarters;
  }

  return {
    points: quarters / 4,
    breakdown,
    valueAgorot: agorot(Math.round((quarters * yearData.creditPointValueAgorot) / 4)),
  };
}
