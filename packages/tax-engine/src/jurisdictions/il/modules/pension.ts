import { addAgorot, type Agorot } from '@taxreturns/shared';
import { InvalidTaxInputError } from '../../../core/errors';
import { minAgorot, percentBp } from '../../../core/money';
import type { IlYearData, PensionResult, SalaryInput } from '../../../core/types';

/**
 * Section 45א credit for a salaried employee: 35% of employee pension
 * contributions (Form 106 box 045), where contributions are credited only
 * up to 7% of qualifying income (work income capped at the §47(א)(1)(1)
 * ceiling). §47 deductions for עמית מוטב beyond this are out of scope until
 * a real return needs them — the engine surfaces both caps so the reviewer
 * can see exactly what was and wasn't credited.
 */
export function computePensionCredit(
  salaries: SalaryInput[],
  yearData: IlYearData,
): PensionResult {
  salaries.forEach((s, i) => {
    if (s.grossSalaryAgorot < 0) {
      throw new InvalidTaxInputError(
        `salaries[${i}].grossSalaryAgorot`,
        `must be ≥ 0, got ${s.grossSalaryAgorot}`,
      );
    }
    if (s.pensionEmployeeContributionAgorot < 0) {
      throw new InvalidTaxInputError(
        `salaries[${i}].pensionEmployeeContributionAgorot`,
        `must be ≥ 0, got ${s.pensionEmployeeContributionAgorot}`,
      );
    }
  });

  const contributions = addAgorot(
    ...salaries.map((s) => s.pensionEmployeeContributionAgorot),
  );
  const workIncome = addAgorot(...salaries.map((s) => s.grossSalaryAgorot));
  const qualifyingIncome = minAgorot(
    workIncome,
    yearData.pension45a.qualifyingIncomeCeilingAgorot,
  );
  const contributionCap = percentBp(
    qualifyingIncome,
    yearData.pension45a.contributionCapShareBp,
  );
  const credited = minAgorot(contributions, contributionCap);

  return {
    totalEmployeeContributionsAgorot: contributions,
    qualifyingIncomeAgorot: qualifyingIncome,
    contributionCapAgorot: contributionCap,
    creditedContributionAgorot: credited,
    creditAgorot: percentBp(credited, yearData.pension45a.creditRateBp),
  };
}
