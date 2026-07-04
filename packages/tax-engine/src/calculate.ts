import { addAgorot, agorot, type Agorot } from '@taxreturns/shared';
import { InvalidTaxInputError } from './core/errors';
import { minAgorot, subAgorot } from './core/money';
import type { TaxReturnResult, TaxYearInput } from './core/types';
import { getIlYearData } from './jurisdictions/il';
import { computeCapitalGains } from './jurisdictions/il/modules/capital-gains';
import { computeCharityCredit } from './jurisdictions/il/modules/charity';
import { computeCreditPoints } from './jurisdictions/il/modules/credit-points';
import { computeIncomeTax } from './jurisdictions/il/modules/income-tax';
import { reconcileNationalInsurance } from './jurisdictions/il/modules/national-insurance';
import { computePensionCredit } from './jurisdictions/il/modules/pension';
import { computeSurtax } from './jurisdictions/il/modules/surtax';

/** Bump on ANY rule or year-data change; stamped into calculations rows. */
export const ENGINE_VERSION = 'il-0.1.0';

/** Every money field must arrive as a safe integer (agorot) — JSON gives us
 * plain numbers, so the boundary re-checks what the type system cannot. */
function assertMoney(value: number, field: string, allowNegative = false): void {
  if (!Number.isSafeInteger(value) || (!allowNegative && value < 0)) {
    throw new InvalidTaxInputError(
      field,
      `must be a ${allowNegative ? '' : 'non-negative '}safe integer in agorot, got ${value}`,
    );
  }
}

function validate(input: TaxYearInput): void {
  input.salaries.forEach((s, i) => {
    assertMoney(s.grossSalaryAgorot, `salaries[${i}].grossSalaryAgorot`);
    assertMoney(s.taxWithheldAgorot, `salaries[${i}].taxWithheldAgorot`);
    assertMoney(
      s.pensionEmployeeContributionAgorot,
      `salaries[${i}].pensionEmployeeContributionAgorot`,
    );
    if (s.niEmployeeWithheldAgorot !== undefined) {
      assertMoney(s.niEmployeeWithheldAgorot, `salaries[${i}].niEmployeeWithheldAgorot`);
    }
  });
  input.donations.forEach((d, i) => {
    assertMoney(d.amountAgorot, `donations[${i}].amountAgorot`);
  });
  input.capital.entries.forEach((e, i) => {
    assertMoney(e.realGainAgorot, `capital.entries[${i}].realGainAgorot`);
    assertMoney(e.realLossAgorot, `capital.entries[${i}].realLossAgorot`);
    assertMoney(e.interestDividendAgorot, `capital.entries[${i}].interestDividendAgorot`);
    assertMoney(e.taxWithheldAgorot, `capital.entries[${i}].taxWithheldAgorot`);
  });
  assertMoney(input.capital.lossCarryforwardInAgorot, 'capital.lossCarryforwardInAgorot');
}

/**
 * The one entry point (spec §3): deterministic, no I/O. Order of operations:
 * work income → bracket tax → capital gains (needed for the charity ceiling
 * and surtax) → credits (points, pension, charity; capped at the income tax)
 * → surtax → liability vs. withholding.
 */
export function calculate(input: TaxYearInput): TaxReturnResult {
  const yearData = getIlYearData(input.year); // throws UnknownTaxYearError
  validate(input);

  const workIncome = addAgorot(...input.salaries.map((s) => s.grossSalaryAgorot));
  const incomeTax = computeIncomeTax(workIncome, yearData);
  const capitalGains = computeCapitalGains(input.capital, yearData);

  const capitalTaxable = addAgorot(
    capitalGains.taxableGainAgorot,
    capitalGains.taxableInterestDividendAgorot,
  );
  const totalTaxable = addAgorot(workIncome, capitalTaxable);

  const creditPoints = computeCreditPoints(input.taxpayer, yearData);
  const pension = computePensionCredit(input.salaries, yearData);
  const charity = computeCharityCredit(input.donations, totalTaxable, yearData);

  const creditsTotal = addAgorot(
    creditPoints.valueAgorot,
    pension.creditAgorot,
    charity.creditAgorot,
  );
  const creditsApplied = minAgorot(creditsTotal, incomeTax.totalAgorot);
  const incomeTaxAfterCredits = subAgorot(incomeTax.totalAgorot, creditsApplied);

  const surtax = computeSurtax(totalTaxable, capitalTaxable, yearData);

  const totalLiability = addAgorot(
    incomeTaxAfterCredits,
    capitalGains.taxAgorot,
    surtax.totalAgorot,
  );
  const totalWithheld = addAgorot(
    ...input.salaries.map((s) => s.taxWithheldAgorot),
    capitalGains.withheldAgorot,
  );
  const refund = subAgorot(totalWithheld, totalLiability);

  const pensionContributions = addAgorot(
    ...input.salaries.map((s) => s.pensionEmployeeContributionAgorot),
  );

  // Numeric keys mirror the shared Form 106 box codes that map 1:1 onto the
  // printed Form 1301 fields; named keys are engine outputs whose official
  // 1301 codes the owner verifies in Plan 5's filing view.
  const form1301Fields: Record<string, Agorot> = {
    '158': workIncome, // הכנסת עבודה
    '042': addAgorot(...input.salaries.map((s) => s.taxWithheldAgorot)), // מס שנוכה
    '045': pensionContributions, // תשלומי עובד לקופת גמל
    donationsEligible: charity.eligibleAgorot,
    capitalTaxableGain: capitalGains.taxableGainAgorot,
    capitalTax: capitalGains.taxAgorot,
    surtax: surtax.totalAgorot,
    totalLiability,
    refund,
  };

  return {
    engineVersion: ENGINE_VERSION,
    year: input.year,
    incomeTax,
    creditPoints,
    pension,
    charity,
    creditsAppliedAgorot: creditsApplied,
    creditsUnusedAgorot: subAgorot(creditsTotal, creditsApplied),
    incomeTaxAfterCreditsAgorot: incomeTaxAfterCredits,
    capitalGains,
    surtax,
    totalLiabilityAgorot: totalLiability,
    totalWithheldAgorot: totalWithheld,
    refundAgorot: refund,
    lossCarryforwardOutAgorot: capitalGains.lossCarryforwardOutAgorot,
    nationalInsurance: reconcileNationalInsurance(input.salaries, yearData),
    form1301Fields,
  };
}
