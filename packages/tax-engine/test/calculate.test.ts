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

  it('golden 2025: salary + two children (2, 4) + oleh first year (il-0.4.0)', () => {
    // Credit points in twelfths: resident 27 + child age 2 → 54 + child age 4
    // → 30 (report §1.1) + from2022 oleh full first year 1/12×12 = 12 (report
    // §3.1) = 123 twelfths = 10.25 points = 123 × 242 ₪ = 29,766 ₪.
    const res = calculate(
      baseInput({
        salaries: [salary(120_000, 12_000, 7_200)],
        taxpayer: {
          isIsraeliResident: true,
          gender: 'male',
          parentContext: { regime: 'marriedRegisteredSpouse' },
          children: [{ ageInTaxYear: 2 }, { ageInTaxYear: 4 }],
          aliyah: { aliyahYear: 2025, aliyahMonth: 1, scheduleVariant: 'from2022' },
        },
      }),
    );
    // Structured children/oleh inputs are stamped as a new rule set
    // (il-0.4.0; the current version also carries the degree and
    // parent-allocation increments).
    expect(ENGINE_VERSION).toBe('il-0.7.1');
    expect(res.engineVersion).toBe('il-0.7.1');
    expect(res.creditPoints.points).toBe(10.25);
    expect(res.creditPoints.valueAgorot).toBe(sh(29_766));
    expect(res.creditPoints.breakdown.map((r) => r.reason)).toEqual([
      'resident',
      'child',
      'child',
      'oleh',
    ]);
    // Income tax 13,435.2 ₪ < credits (29,766 + pension 2,520) → tax zeroed,
    // full withholding refunded.
    expect(res.incomeTaxAfterCreditsAgorot).toBe(0);
    expect(res.creditsAppliedAgorot).toBe(sh(13_435.2));
    expect(res.refundAgorot).toBe(sh(12_000));
  });

  it('golden 2025: salary + bachelor in window year 2 (il-0.5.0)', () => {
    // Bachelor completed 2023, 3 study years → fixed window 2024-2026
    // (addendum §1); 2025 is window year 2 → 1 point. Credit points in
    // twelfths: resident 27 + degree 12 = 39 = 3.25 points = 9,438 ₪.
    const res = calculate(
      baseInput({
        salaries: [salary(120_000, 12_000, 7_200)],
        taxpayer: {
          isIsraeliResident: true,
          gender: 'male',
          degrees: [{ track: 'bachelor', completionYear: 2023, studyYears: 3 }],
        },
      }),
    );
    // Structured degree input is stamped as a new rule set (il-0.5.0; the
    // current version also carries the parent-allocation increment).
    expect(ENGINE_VERSION).toBe('il-0.7.1');
    expect(res.engineVersion).toBe('il-0.7.1');
    expect(res.creditPoints.points).toBe(3.25);
    expect(res.creditPoints.valueAgorot).toBe(sh(9_438));
    expect(res.creditPoints.breakdown).toContainEqual({
      reason: 'degree',
      points: 1,
      label: 'תואר ראשון — נקודת זיכוי, שנה 2 מתוך 3 (סיום לימודים 2023)',
    });
    // Income tax 13,435.2 ₪ − credits (9,438 + pension 2,520 = 11,958) →
    // 1,477.2 ₪ liability; 12,000 withheld → 10,522.8 ₪ refund.
    expect(res.creditsAppliedAgorot).toBe(sh(11_958));
    expect(res.incomeTaxAfterCreditsAgorot).toBe(sh(1_477.2));
    expect(res.totalLiabilityAgorot).toBe(sh(1_477.2));
    expect(res.refundAgorot).toBe(sh(10_522.8));
  });

  it('golden 2025: mother §66(ג)(4) with children 0 & 2, טופס 116ד deferral and קצבה placeholder (il-0.6.0)', () => {
    // Credit points in twelfths: resident 27 + woman 6 + child age 2 → 54 +
    // child born this year → 30 − 12 (טופס 116ד birth-year deferral) +
    // §66(ג)(3) קצבה placeholder 0 (count owner-verify) = 105 twelfths =
    // 8.75 points = 105 × 242 ₪ / 12... = 25,410 ₪.
    const res = calculate(
      baseInput({
        salaries: [salary(120_000, 12_000, 7_200)],
        taxpayer: {
          isIsraeliResident: true,
          gender: 'female',
          parentContext: {
            regime: 'marriedRegisteredSpouse',
            receivesChildAllowance: true,
          },
          children: [
            { ageInTaxYear: 2 },
            { ageInTaxYear: 0, deferBirthYearPoint: true },
          ],
        },
      }),
    );
    // Regime-aware child-point allocation is stamped as a new rule set.
    expect(ENGINE_VERSION).toBe('il-0.7.1');
    expect(res.engineVersion).toBe('il-0.7.1');
    expect(res.creditPoints.points).toBe(8.75);
    expect(res.creditPoints.valueAgorot).toBe(sh(25_410));
    expect(res.creditPoints.breakdown.map((r) => r.reason)).toEqual([
      'resident',
      'female',
      'child',
      'child',
      'birthYearDeferral',
      'childAllowance',
    ]);
    // The קצבה row surfaces at 0 points with its owner-verify TODO label.
    expect(res.creditPoints.breakdown.at(-1)?.points).toBe(0);
    // Income tax 13,435.2 ₪ < credits (25,410 + pension 2,520) → tax zeroed,
    // full withholding refunded.
    expect(res.incomeTaxAfterCreditsAgorot).toBe(0);
    expect(res.creditsAppliedAgorot).toBe(sh(13_435.2));
    expect(res.refundAgorot).toBe(sh(12_000));
  });

  it('golden 2025: mother §66(ג)(4) with children 2 & 8 — the 6-17 band computes (il-0.7.0)', () => {
    // The base parent-allocation plan's Task-5 scenario, legal since the
    // sah3184 addendum verified the 6-17 band. Credit points in twelfths:
    // resident 27 + woman 6 + child age 2 → 54 + child age 8 → 24 = 111
    // twelfths = 9.25 points = 111 × 242 ₪ = 26,862 ₪.
    const res = calculate(
      baseInput({
        salaries: [salary(120_000, 12_000, 7_200)],
        taxpayer: {
          isIsraeliResident: true,
          gender: 'female',
          parentContext: { regime: 'marriedRegisteredSpouse' },
          children: [{ ageInTaxYear: 2 }, { ageInTaxYear: 8 }],
        },
      }),
    );
    expect(res.creditPoints.points).toBe(9.25);
    expect(res.creditPoints.valueAgorot).toBe(sh(26_862));
    expect(res.creditPoints.breakdown).toContainEqual({
      reason: 'child',
      points: 2,
      label: 'ילד בן 8 (§66(ג)(4) — אם)',
    });
    // Income tax 13,435.2 ₪ < credits → tax zeroed, full withholding back.
    expect(res.incomeTaxAfterCreditsAgorot).toBe(0);
    expect(res.refundAgorot).toBe(sh(12_000));
  });

  it('a father regime with structured children computes end-to-end (Schedule B enabled, il-0.7.0)', () => {
    const res = calculate(
      baseInput({
        taxpayer: {
          isIsraeliResident: true,
          gender: 'male',
          parentContext: { regime: 'marriedOtherSpouse' },
          children: [{ ageInTaxYear: 1 }, { ageInTaxYear: 7 }],
        },
      }),
    );
    // resident 27 + age-1 child 54 + age-7 child 12 (§66(ג)(5), sah3184
    // addendum §1c) = 93 twelfths = 7.75 points.
    expect(res.creditPoints.points).toBe(7.75);
    expect(res.creditPoints.breakdown).toContainEqual({
      reason: 'child',
      points: 1,
      label: 'ילד בן 7 (§66(ג)(5) — אב)',
    });
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
    // 15% non-linked interest — zero when absent.
    expect(res.form1301Fields['078']).toBe(0);
    expect(res.form1301Fields['043']).toBe(0);
    expect(res.nonLinkedInterest.amountAgorot).toBe(0);
    expect(res.nonLinkedInterest.taxAgorot).toBe(0);
  });
});

describe('calculate — 15% non-linked deposit interest (§125ג(ג)(1))', () => {
  it('taxes deposit interest at a flat 15% into liability, withholding and refund', () => {
    const res = calculate(
      baseInput({
        nonLinkedInterest: {
          amountAgorot: sh(10_000),
          taxWithheldAgorot: sh(1_500),
        },
      }),
    );
    // No salary/credits/brackets involved — the interest is its own flat line.
    expect(res.nonLinkedInterest.rateBp).toBe(1_500);
    expect(res.nonLinkedInterest.taxAgorot).toBe(sh(1_500));
    expect(res.totalLiabilityAgorot).toBe(sh(1_500));
    expect(res.totalWithheldAgorot).toBe(sh(1_500));
    expect(res.refundAgorot).toBe(0);
    // Official Form 1301 codes 078 (income) / 043 (withholding).
    expect(res.form1301Fields['078']).toBe(sh(10_000));
    expect(res.form1301Fields['043']).toBe(sh(1_500));
  });

  it('does NOT feed the salary bracket table (§125ג overrides §121)', () => {
    const withInterest = calculate(
      baseInput({
        salaries: [salary(120_000, 12_000, 7_200)],
        nonLinkedInterest: { amountAgorot: sh(50_000), taxWithheldAgorot: sh(0) },
      }),
    );
    const withoutInterest = calculate(
      baseInput({ salaries: [salary(120_000, 12_000, 7_200)] }),
    );
    // Bracket tax on work income is identical; the interest is taxed flat 15%
    // on the side, never pushed through the marginal brackets.
    expect(withInterest.incomeTax.totalAgorot).toBe(
      withoutInterest.incomeTax.totalAgorot,
    );
    expect(withInterest.totalLiabilityAgorot).toBe(
      withoutInterest.totalLiabilityAgorot + sh(50_000) * 0.15,
    );
  });

  it('is a SEPARATE bucket — a capital loss does NOT offset deposit interest', () => {
    // 5,000 ₪ current-year loss, 1,000 ₪ gain, plus 10,000 ₪ deposit interest.
    const res = calculate(
      baseInput({
        capital: {
          entries: [
            {
              brokerName: 'ברוקר',
              realGainAgorot: sh(1_000),
              realLossAgorot: sh(5_000),
              interestDividendAgorot: sh(0),
              taxWithheldAgorot: sh(0),
            },
          ],
          lossCarryforwardInAgorot: sh(0),
        },
        nonLinkedInterest: { amountAgorot: sh(10_000), taxWithheldAgorot: sh(0) },
      }),
    );
    // The loss stays entirely within the securities bucket and carries forward
    // (4,000 ₪) — it does NOT absorb the 15% deposit interest.
    expect(res.lossCarryforwardOutAgorot).toBe(sh(4_000));
    expect(res.nonLinkedInterest.amountAgorot).toBe(sh(10_000));
    expect(res.nonLinkedInterest.taxAgorot).toBe(sh(1_500));
    // Full 15% is still owed on the deposit interest.
    expect(res.totalLiabilityAgorot).toBe(sh(1_500));
  });

  it('2025: deposit interest is capital-source income for the 2% surtax add-on', () => {
    // Push total taxable just past the 721,560 ₪ threshold using salary, then
    // add deposit interest — it must land in the capital surtax base.
    const withInterest = calculate(
      baseInput({
        salaries: [salary(700_000, 0)],
        nonLinkedInterest: { amountAgorot: sh(100_000), taxWithheldAgorot: sh(0) },
      }),
    );
    // total taxable 800,000 ₪; base above threshold 78,440 ₪; the capital part
    // is min(100,000 interest, 78,440) = 78,440 → full 2% add-on applies.
    expect(withInterest.surtax.baseAgorot).toBe(sh(78_440));
    expect(withInterest.surtax.capitalBaseAgorot).toBe(sh(78_440));
    expect(withInterest.surtax.capitalAdditionalSurtaxAgorot).toBe(sh(1_568.8));
  });

  it('2024: no 2% capital add-on on deposit interest (add-on is 2025+)', () => {
    const res = calculate(
      baseInput({
        year: 2024,
        salaries: [salary(700_000, 0)],
        nonLinkedInterest: { amountAgorot: sh(100_000), taxWithheldAgorot: sh(0) },
      }),
    );
    expect(res.surtax.capitalAdditionalSurtaxAgorot).toBe(0);
    // Basic 3% surtax still applies on the whole band above the threshold.
    expect(res.surtax.basicSurtaxAgorot).toBeGreaterThan(0);
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
