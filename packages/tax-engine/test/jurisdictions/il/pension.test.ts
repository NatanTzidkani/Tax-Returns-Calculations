import { agorot, type Agorot } from '@taxreturns/shared';
import { describe, expect, it } from 'vitest';
import { InvalidTaxInputError } from '../../../src/core/errors';
import { getIlYearData } from '../../../src/jurisdictions/il';
import { computePensionCredit } from '../../../src/jurisdictions/il/modules/pension';

const y2025 = getIlYearData(2025);
const sh = (n: number) => agorot(Math.round(n * 100)) as Agorot;

const salary = (gross: number, pension: number) => ({
  employerName: 'מעסיק',
  grossSalaryAgorot: sh(gross),
  taxWithheldAgorot: sh(0),
  pensionEmployeeContributionAgorot: sh(pension),
});

describe('computePensionCredit (§45א)', () => {
  it('credits 35% of contributions when under all caps', () => {
    // 100,000 ₪ income, 6,000 ₪ contributed; cap = 7% × 100,000 = 7,000
    const res = computePensionCredit([salary(100_000, 6_000)], y2025);
    expect(res.qualifyingIncomeAgorot).toBe(sh(100_000));
    expect(res.contributionCapAgorot).toBe(sh(7_000));
    expect(res.creditedContributionAgorot).toBe(sh(6_000));
    expect(res.creditAgorot).toBe(sh(2_100));
  });

  it('caps contributions at 7% of qualifying income', () => {
    const res = computePensionCredit([salary(100_000, 9_000)], y2025);
    expect(res.creditedContributionAgorot).toBe(sh(7_000));
    expect(res.creditAgorot).toBe(sh(2_450));
  });

  it('caps qualifying income at 116,400 ₪ (high earner)', () => {
    // 240,000 ₪ income, 14,400 ₪ contributed → cap 7% × 116,400 = 8,148
    const res = computePensionCredit([salary(240_000, 14_400)], y2025);
    expect(res.qualifyingIncomeAgorot).toBe(sh(116_400));
    expect(res.contributionCapAgorot).toBe(sh(8_148));
    expect(res.creditedContributionAgorot).toBe(sh(8_148));
    expect(res.creditAgorot).toBe(sh(2_851.8));
  });

  it('aggregates several employers', () => {
    const res = computePensionCredit(
      [salary(60_000, 3_600), salary(40_000, 2_400)],
      y2025,
    );
    expect(res.totalEmployeeContributionsAgorot).toBe(sh(6_000));
    expect(res.creditAgorot).toBe(sh(2_100));
  });

  it('returns zeros with no salaries', () => {
    const res = computePensionCredit([], y2025);
    expect(res.creditAgorot).toBe(0);
    expect(res.creditedContributionAgorot).toBe(0);
  });

  it('rejects negative amounts loudly', () => {
    expect(() => computePensionCredit([salary(100_000, -1)], y2025)).toThrow(
      InvalidTaxInputError,
    );
    expect(() => computePensionCredit([salary(-1, 0)], y2025)).toThrow(
      InvalidTaxInputError,
    );
  });
});
