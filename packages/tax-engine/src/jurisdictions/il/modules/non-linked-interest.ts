import { agorot, type Agorot } from '@taxreturns/shared';
import { InvalidTaxInputError } from '../../../core/errors';
import { percentBp } from '../../../core/money';
import type {
  IlYearData,
  NonLinkedInterestInput,
  NonLinkedInterestResult,
} from '../../../core/types';

/**
 * Interest on a non-index-linked asset (deposits / savings plans) taxed at a
 * flat 15% (§125ג(ג)(1); Form 1301 item 21 field 078, withholding field 043).
 *
 * This is a DISTINCT bucket from securities interest/dividend
 * (`computeCapitalGains`): a bank deposit is not a נייר ערך, so a current-year
 * capital loss does NOT offset it (owner-confirmed default per §92(א)(4);
 * see the research report §3). It is therefore taxed on its own, never routed
 * through the loss-offset waterfall. It IS capital-source income for surtax
 * (§5) — the caller folds `amountAgorot` into the surtax capital base.
 *
 * Absent input → a zero-valued result (no such income), never a silent guess.
 */
export function computeNonLinkedInterest(
  input: NonLinkedInterestInput | undefined,
  yearData: IlYearData,
): NonLinkedInterestResult {
  const amount = input?.amountAgorot ?? agorot(0);
  const withheld = input?.taxWithheldAgorot ?? agorot(0);

  for (const [key, value] of [
    ['amountAgorot', amount],
    ['taxWithheldAgorot', withheld],
  ] as const) {
    if (value < 0) {
      throw new InvalidTaxInputError(
        `nonLinkedInterest.${key}`,
        `must be ≥ 0, got ${value}`,
      );
    }
  }

  const rateBp = yearData.capitalGains.nonLinkedInterestRateBp;
  return {
    reason: 'nonLinkedInterest',
    amountAgorot: amount as Agorot,
    rateBp,
    taxAgorot: percentBp(amount as Agorot, rateBp),
    withheldAgorot: withheld as Agorot,
  };
}
