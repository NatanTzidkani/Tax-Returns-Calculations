import { agorot, addAgorot, type Agorot } from '@taxreturns/shared';
import { InvalidTaxInputError } from '../../../core/errors';
import { minAgorot, percentBp, subAgorot } from '../../../core/money';
import type { BracketRow, IlYearData, IncomeTaxResult } from '../../../core/types';

/** Progressive income tax on personal-exertion income (§121). */
export function computeIncomeTax(
  taxableIncomeAgorot: Agorot,
  yearData: IlYearData,
): IncomeTaxResult {
  if (taxableIncomeAgorot < 0) {
    throw new InvalidTaxInputError(
      'taxableIncomeAgorot',
      `must be ≥ 0, got ${taxableIncomeAgorot}`,
    );
  }

  const rows: BracketRow[] = [];
  let from = agorot(0);

  for (const bracket of yearData.brackets) {
    if (taxableIncomeAgorot <= from) break;
    const to =
      bracket.upToAgorot === null
        ? taxableIncomeAgorot
        : minAgorot(bracket.upToAgorot, taxableIncomeAgorot);
    const taxedAmount = subAgorot(to, from);
    rows.push({
      fromAgorot: from,
      toAgorot: bracket.upToAgorot,
      rateBp: bracket.rateBp,
      taxedAmountAgorot: taxedAmount,
      taxAgorot: percentBp(taxedAmount, bracket.rateBp),
    });
    if (bracket.upToAgorot === null) break;
    from = bracket.upToAgorot;
  }

  return {
    taxableIncomeAgorot,
    rows,
    totalAgorot: addAgorot(...rows.map((r) => r.taxAgorot)),
  };
}
