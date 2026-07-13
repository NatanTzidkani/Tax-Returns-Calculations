import { agorot, type Agorot } from '@taxreturns/shared';
import { describe, expect, it } from 'vitest';
import { calculate, ENGINE_VERSION } from '../src';
import { InvalidTaxInputError, UnknownTaxYearError } from '../src/core/errors';
import type { TaxYearInput } from '../src/core/types';

const sh = (n: number) => agorot(Math.round(n * 100)) as Agorot;

function baseInput(over: Partial<TaxYearInput> = {}): TaxYearInput {
  return {
    year: 2025,
    taxpayer: { isIsraeliResident: true, gender: 'male' },
    salaries: [],
    donations: [],
    capital: { entries: [], lossCarryforwardInAgorot: sh(0) },
    ...over,
  };
}

const salary = (gross: number, withheld: number, pension = 0) => ({
  employerName: 'אקמי בע"מ',
  grossSalaryAgorot: sh(gross),
  taxWithheldAgorot: sh(withheld),
  pensionEmployeeContributionAgorot: sh(pension),
});

describe('calculate — golden scenarios', () => {
  it('salary-only refund (120,000 ₪, over-withheld)', () => {
    const res = calculate(
      baseInput({ salaries: [salary(120_000, 12_000, 7_200)] }),
    );

    expect(res.engineVersion).toBe(ENGINE_VERSION);
    expect(res.incomeTax.totalAgorot).toBe(sh(13_435.2));
    expect(res.creditPoints.valueAgorot).toBe(sh(6_534));
    expect(res.pension.creditAgorot).toBe(sh(2_520));
    expect(res.charity.creditAgorot).toBe(0);
    expect(res.creditsAppliedAgorot).toBe(sh(9_054));
    expect(res.creditsUnusedAgorot).toBe(0);
    expect(res.incomeTaxAfterCreditsAgorot).toBe(sh(4_381.2));
    expect(res.surtax.totalAgorot).toBe(0);
    expect(res.totalLiabilityAgorot).toBe(sh(4_381.2));
    expect(res.totalWithheldAgorot).toBe(sh(12_000));
    expect(res.refundAgorot).toBe(sh(7_618.8));
  });

  it('credits cannot push income tax below zero — unused is reported', () => {
    const res = calculate(baseInput({ salaries: [salary(50_000, 1_000, 0)] }));
    // tax 5,000 ₪ < credit points 6,534 ₪
    expect(res.incomeTaxAfterCreditsAgorot).toBe(0);
    expect(res.creditsAppliedAgorot).toBe(sh(5_000));
    expect(res.creditsUnusedAgorot).toBe(sh(1_534));
    expect(res.refundAgorot).toBe(sh(1_000)); // full withholding back
  });

  it('salary + donations scenario', () => {
    const res = calculate(
      baseInput({
        salaries: [salary(120_000, 12_000, 7_200)],
        donations: [{ institutionName: 'עמותה', amountAgorot: sh(1_000) }],
      }),
    );
    expect(res.charity.creditAgorot).toBe(sh(350));
    expect(res.refundAgorot).toBe(sh(7_618.8 + 350));
  });

  it('capital loss carry-forward flows out of the result', () => {
    const res = calculate(
      baseInput({
        capital: {
          entries: [
            {
              brokerName: 'ברוקר',
              realGainAgorot: sh(1_000),
              realLossAgorot: sh(5_000),
              interestDividendAgorot: sh(0),
              taxWithheldAgorot: sh(250),
            },
          ],
          lossCarryforwardInAgorot: sh(0),
        },
      }),
    );
    expect(res.capitalGains.taxAgorot).toBe(0);
    expect(res.lossCarryforwardOutAgorot).toBe(sh(4_000));
    expect(res.refundAgorot).toBe(sh(250)); // capital withholding comes back
  });

  it('high earner 2025: surtax 3% plus 2% on the capital part', () => {
    const res = calculate(
      baseInput({
        salaries: [salary(700_000, 250_000)],
        capital: {
          entries: [
            {
              brokerName: 'ברוקר',
              realGainAgorot: sh(100_000),
              realLossAgorot: sh(0),
              interestDividendAgorot: sh(0),
              taxWithheldAgorot: sh(25_000),
            },
          ],
          lossCarryforwardInAgorot: sh(0),
        },
      }),
    );
    // total taxable 800,000 ₪; threshold 721,560 ₪
    expect(res.surtax.baseAgorot).toBe(sh(78_440));
    expect(res.surtax.basicSurtaxAgorot).toBe(sh(2_353.2));
    // capital part above threshold: min(100,000, 78,440)
    expect(res.surtax.capitalBaseAgorot).toBe(sh(78_440));
    expect(res.surtax.capitalAdditionalSurtaxAgorot).toBe(sh(1_568.8));
    expect(res.surtax.totalAgorot).toBe(sh(3_922));
  });

  it('the same high earner in 2024 pays no extra capital surtax', () => {
    const res = calculate(
      baseInput({
        year: 2024,
        salaries: [salary(700_000, 250_000)],
        capital: {
          entries: [
            {
              brokerName: 'ברוקר',
              realGainAgorot: sh(100_000),
              realLossAgorot: sh(0),
              interestDividendAgorot: sh(0),
              taxWithheldAgorot: sh(25_000),
            },
          ],
          lossCarryforwardInAgorot: sh(0),
        },
      }),
    );
    expect(res.surtax.basicSurtaxAgorot).toBe(sh(2_353.2));
    expect(res.surtax.capitalAdditionalSurtaxAgorot).toBe(0);
  });

  it('exposes a form 1301 field map with verified official codes', () => {
    // Codes verified 2026-07-12:
    // docs/superpowers/research/2026-07-12-form1301-codes-verification.md
    const res = calculate(
      baseInput({
        salaries: [salary(120_000, 12_000, 7_200)],
        donations: [{ institutionName: 'עמותה', amountAgorot: sh(1_000) }],
        capital: {
          entries: [
            {
              brokerName: 'ברוקר',
              realGainAgorot: sh(1_000),
              realLossAgorot: sh(5_000),
              interestDividendAgorot: sh(0),
              taxWithheldAgorot: sh(250),
            },
          ],
          lossCarryforwardInAgorot: sh(0),
        },
      }),
    );
    expect(res.form1301Fields['158']).toBe(sh(120_000));
    // 042 is salary (Form 106) withholding ONLY — securities withholding
    // deliberately excluded (it goes to 040).
    expect(res.form1301Fields['042']).toBe(sh(12_000));
    expect(res.form1301Fields['045']).toBe(sh(7_200));
    // 037 takes the raw amount donated in the tax year; the Tax Authority
    // applies the §46 35% rate and ceilings itself.
    expect(res.form1301Fields['037']).toBe(sh(1_000));
    expect(res.form1301Fields['037']).toBe(res.charity.totalDonationsAgorot);
    expect(res.form1301Fields).not.toHaveProperty('donationsEligible');
    // 040 — withholding on securities (Form 867), not 043 (deposit interest).
    expect(res.form1301Fields['040']).toBe(sh(250));
    // 166 — capital losses not offset, carried to future years.
    expect(res.form1301Fields['166']).toBe(sh(4_000));
    expect(res.form1301Fields['166']).toBe(res.lossCarryforwardOutAgorot);
    expect(res.form1301Fields['refund']).toBe(res.refundAgorot);
  });

  it('form 1301 map keys are always present, zero-valued without input', () => {
    const res = calculate(
      baseInput({ salaries: [salary(120_000, 12_000, 7_200)] }),
    );
    expect(res.form1301Fields['037']).toBe(0);
    expect(res.form1301Fields['040']).toBe(0);
    expect(res.form1301Fields['166']).toBe(0);
  });
});

describe('calculate — loud failures', () => {
  it('throws UnknownTaxYearError for an unsupported year', () => {
    expect(() => calculate(baseInput({ year: 2023 }))).toThrow(
      UnknownTaxYearError,
    );
  });

  it('throws InvalidTaxInputError on negative withheld tax', () => {
    expect(() =>
      calculate(baseInput({ salaries: [salary(100_000, -5)] })),
    ).toThrow(InvalidTaxInputError);
  });

  it('throws InvalidTaxInputError on negative NI withheld', () => {
    const bad = { ...salary(100_000, 0), niEmployeeWithheldAgorot: sh(-1) };
    expect(() => calculate(baseInput({ salaries: [bad] }))).toThrow(
      InvalidTaxInputError,
    );
  });

  it('throws InvalidTaxInputError on non-integer money (floats never sneak in)', () => {
    const input = baseInput();
    input.salaries = [
      {
        employerName: 'אקמי',
        grossSalaryAgorot: 100.5 as Agorot,
        taxWithheldAgorot: sh(0),
        pensionEmployeeContributionAgorot: sh(0),
      },
    ];
    expect(() => calculate(input)).toThrow(InvalidTaxInputError);
  });
});

describe('calculate — invariants', () => {
  it('refund never exceeds total withheld when only withholding funds it', () => {
    for (let gross = 0; gross <= 900_000; gross += 61_111) {
      const withheld = Math.round(gross * 0.2);
      const res = calculate(baseInput({ salaries: [salary(gross, withheld)] }));
      expect(res.refundAgorot).toBeLessThanOrEqual(res.totalWithheldAgorot);
    }
  });

  it('income tax is monotonic non-decreasing in income', () => {
    let prev = -1;
    for (let gross = 0; gross <= 1_200_000; gross += 17_351) {
      const res = calculate(baseInput({ salaries: [salary(gross, 0)] }));
      expect(res.incomeTax.totalAgorot).toBeGreaterThanOrEqual(prev);
      prev = res.incomeTax.totalAgorot;
    }
  });

  it('liability + refund always reconciles to withholding', () => {
    for (const gross of [0, 84_120, 120_000, 269_280, 800_000]) {
      const res = calculate(baseInput({ salaries: [salary(gross, 30_000)] }));
      expect(res.totalWithheldAgorot - res.totalLiabilityAgorot).toBe(
        res.refundAgorot,
      );
    }
  });
});
