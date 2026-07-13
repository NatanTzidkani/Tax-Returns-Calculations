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
import { computeNonLinkedInterest } from './jurisdictions/il/modules/non-linked-interest';
import { computePensionCredit } from './jurisdictions/il/modules/pension';
import { computeSurtax } from './jurisdictions/il/modules/surtax';

/** Bump on ANY rule or year-data change; stamped into calculations rows.
 * 0.2.0: form1301Fields corrected to owner-verified official codes
 * (037/040/166 added, donationsEligible removed) — the map is part of the
 * persisted result.
 * 0.3.0: added the 15% non-linked-interest branch (§125ג(ג)(1)) — new
 * `nonLinkedInterest` result section and Form 1301 fields 078/043; feeds
 * totalLiability, the surtax capital base, and totalWithheld. */
export const ENGINE_VERSION = 'il-0.3.0';

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
  if (input.nonLinkedInterest !== undefined) {
    assertMoney(input.nonLinkedInterest.amountAgorot, 'nonLinkedInterest.amountAgorot');
    assertMoney(input.nonLinkedInterest.taxWithheldAgorot, 'nonLinkedInterest.taxWithheldAgorot');
  }
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
  // 15% non-linked deposit/savings interest — a SEPARATE bucket from the
  // securities interest/dividend in computeCapitalGains: different rate and
  // (owner-confirmed default) NOT a §92 loss-offset target, so it is never
  // routed through the loss-offset waterfall. See the research report.
  const nonLinkedInterest = computeNonLinkedInterest(input.nonLinkedInterest, yearData);

  const capitalTaxable = addAgorot(
    capitalGains.taxableGainAgorot,
    capitalGains.taxableInterestDividendAgorot,
    // Capital-source income for surtax (base 3% + 2025 2% capital add-on).
    nonLinkedInterest.amountAgorot,
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
    nonLinkedInterest.taxAgorot,
    surtax.totalAgorot,
  );
  const totalWithheld = addAgorot(
    ...input.salaries.map((s) => s.taxWithheldAgorot),
    capitalGains.withheldAgorot,
    nonLinkedInterest.withheldAgorot,
  );
  const refund = subAgorot(totalWithheld, totalLiability);

  const pensionContributions = addAgorot(
    ...input.salaries.map((s) => s.pensionEmployeeContributionAgorot),
  );

  // Form 1301 field map. Numeric keys are OFFICIAL field codes, verified
  // 2026-07-12 against the 2024 and 2025 forms (codes identical both years)
  // and the Tax Authority's filling guide — full audit trail with per-field
  // sources in docs/superpowers/research/2026-07-12-form1301-codes-verification.md:
  //   • טופס 1301 לשנת 2024 (רשות המסים): https://www.gov.il/BlobFolder/service/reporting-and-payment-2024-annual-tax-report-for-individuals/he/Service_Pages_Income_tax_annual-report-2024_1301-2024.pdf
  //   • טופס 1301 לשנת 2025 (רשות המסים): https://www.gov.il/BlobFolder/service/reporting-and-payment-2025-annual-tax-report-for-individuals/he/Service_Pages_Income_tax_annual-report-2026_itc1301-2025.pdf
  //   • דע זכויותיך וחובותיך 2024 — מדריך מילוי הדוח: https://www.gov.il/BlobFolder/generalpage/income-tax-guide-knowyourright/he/Guides_IncomeTax_da-2024.pdf
  // '158'/'042'/'045' were CONFIRMED as-is by that report. Named keys are
  // engine worksheet outputs verified to have NO main-form 1301 field:
  // securities gain/tax detail is itemised on נספח ג (טופס 1322) — the main
  // form carries only proceeds/count fields 054/056/256 — and surtax (§121ב),
  // total liability and refund are computed by the Tax Authority in
  // assessment (the form has only a surtax-threshold checkbox and refund
  // bank-account fields 277/278). Every key is always present; values are 0
  // when the year has no such item. All values stay integer agorot — the
  // filing view formats them for display (formatILS); the whole-shekel
  // rounding the paper form expects is left to the human transcriber.
  const form1301Fields: Record<string, Agorot> = {
    '158': workIncome, // הכנסת עבודה ממשכורת/שכר עבודה (טופסי 106)
    // מס הכנסה שנוכה במקור ממשכורת בלבד (טופסי 106) — deliberately excludes
    // securities withholding, which belongs in 040 (da-2024 סעיפים 81, 83).
    '042': addAgorot(...input.salaries.map((s) => s.taxWithheldAgorot)),
    '045': pensionContributions, // תשלומים לקופת גמל לקצבה כ"עמית שכיר"
    // תרומות למוסדות ציבור בישראל — the RAW amount donated in the tax year;
    // the assessing system applies the §46 35% rate and ceilings itself
    // (da-2024 p. 68: "המחשב יחשב את הזיכוי המגיע בהתאם לרשום בשדות אלה").
    '037': charity.totalDonationsAgorot,
    // ניכוי במקור מהכנסות אחרות "לרבות במכירת ניירות ערך סחירים" (טופסי 867,
    // da-2024 סעיף 83) — NOT 043, which is deposit/savings interest only.
    '040': capitalGains.withheldAgorot,
    // ריבית על פקדונות ותוכניות חיסכון — מס בשיעור של 15% (חלק ה פריט 21).
    // source: §125ג(ג)(1); 1301-2024/2025 item 21; research report §4.
    '078': nonLinkedInterest.amountAgorot,
    // ניכוי במקור מריבית (מפריטים 21-23, פקדונות) — distinct from 040.
    // source: 1301-2024/2025 item 82; research report §4.
    '043': nonLinkedInterest.withheldAgorot,
    // הפסדי הון שלא קוזזו המועברים לשנים הבאות (ללא חו"ל), חלק יא סעיף 45ג.
    '166': capitalGains.lossCarryforwardOutAgorot,
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
    nonLinkedInterest,
    surtax,
    totalLiabilityAgorot: totalLiability,
    totalWithheldAgorot: totalWithheld,
    refundAgorot: refund,
    lossCarryforwardOutAgorot: capitalGains.lossCarryforwardOutAgorot,
    nationalInsurance: reconcileNationalInsurance(input.salaries, yearData),
    form1301Fields,
  };
}
