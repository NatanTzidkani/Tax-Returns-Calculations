import { addAgorot, agorot, type Agorot } from '@taxreturns/shared';
import { minAgorot, percentBp, subAgorot } from '../../../core/money';
import type {
  IlYearData,
  NationalInsuranceResult,
  SalaryInput,
} from '../../../core/types';

/**
 * Informational reconciliation of the employee's NI + health contributions
 * (ביטוח לאומי ודמי בריאות). NEVER feeds the income-tax refund — NI refunds
 * go through btl, not the annual return. The bands are legally monthly; the
 * engine annualizes them (×12), which is exact for a stable monthly salary
 * and approximate otherwise — acceptable for an informational flag.
 */
export function reconcileNationalInsurance(
  salaries: SalaryInput[],
  yearData: IlYearData,
): NationalInsuranceResult {
  const { employee, reducedBandTopMonthlyAgorot, ceilingMonthlyAgorot } =
    yearData.nationalInsurance;
  const income = addAgorot(...salaries.map((s) => s.grossSalaryAgorot));
  const reducedBandTop = agorot(reducedBandTopMonthlyAgorot * 12);
  const ceiling = agorot(ceilingMonthlyAgorot * 12);

  const cappedIncome = minAgorot(income, ceiling);
  const reducedPart = minAgorot(cappedIncome, reducedBandTop);
  const fullPart = subAgorot(cappedIncome, reducedPart);

  const expected = agorot(
    percentBp(reducedPart, employee.reducedNiBp + employee.reducedHealthBp) +
      percentBp(fullPart, employee.fullNiBp + employee.fullHealthBp),
  );

  const withheldValues = salaries
    .map((s) => s.niEmployeeWithheldAgorot)
    .filter((v): v is Agorot => v !== undefined);
  const withheld =
    withheldValues.length > 0 ? addAgorot(...withheldValues) : null;

  return {
    informational: true,
    expectedEmployeeAgorot: expected,
    withheldEmployeeAgorot: withheld,
    differenceAgorot: withheld === null ? null : subAgorot(withheld, expected),
  };
}
