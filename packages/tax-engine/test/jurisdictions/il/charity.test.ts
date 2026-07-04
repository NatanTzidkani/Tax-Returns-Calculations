import { agorot, type Agorot } from '@taxreturns/shared';
import { describe, expect, it } from 'vitest';
import { InvalidTaxInputError } from '../../../src/core/errors';
import { getIlYearData } from '../../../src/jurisdictions/il';
import { computeCharityCredit } from '../../../src/jurisdictions/il/modules/charity';

const y2025 = getIlYearData(2025);
const donate = (sh: number) => ({
  institutionName: 'עמותה מאושרת',
  amountAgorot: agorot(sh * 100) as Agorot,
});

describe('computeCharityCredit', () => {
  it('gives 35% of donations in the normal case', () => {
    // 1,000 ₪ donated, ample income → 350 ₪ credit
    const res = computeCharityCredit([donate(1_000)], agorot(20_000_000), y2025);
    expect(res.totalDonationsAgorot).toBe(100_000);
    expect(res.eligibleAgorot).toBe(100_000);
    expect(res.creditAgorot).toBe(35_000);
    expect(res.carryforwardOutAgorot).toBe(0);
    expect(res.belowMinimum).toBe(false);
  });

  it('sums multiple receipts', () => {
    const res = computeCharityCredit(
      [donate(150), donate(100)],
      agorot(20_000_000),
      y2025,
    );
    expect(res.totalDonationsAgorot).toBe(25_000);
    expect(res.creditAgorot).toBe(8_750);
  });

  it('gives no credit below the 207 ₪ minimum', () => {
    const res = computeCharityCredit([donate(200)], agorot(20_000_000), y2025);
    expect(res.belowMinimum).toBe(true);
    expect(res.creditAgorot).toBe(0);
    expect(res.eligibleAgorot).toBe(0);
    expect(res.carryforwardOutAgorot).toBe(0);
  });

  it('exactly 207 ₪ qualifies', () => {
    const res = computeCharityCredit([donate(207)], agorot(20_000_000), y2025);
    expect(res.belowMinimum).toBe(false);
    expect(res.creditAgorot).toBe(7_245); // 72.45 ₪
  });

  it('caps at 30% of taxable income and carries the excess forward', () => {
    // kolzchut worked example: taxable 120,000 ₪, donated 40,000 ₪
    const res = computeCharityCredit([donate(40_000)], agorot(12_000_000), y2025);
    expect(res.appliedCeilingAgorot).toBe(3_600_000); // 36,000 ₪
    expect(res.eligibleAgorot).toBe(3_600_000);
    expect(res.creditAgorot).toBe(1_260_000); // 12,600 ₪
    expect(res.carryforwardOutAgorot).toBe(400_000); // 4,000 ₪
  });

  it('uses the absolute ceiling when 30% of income exceeds it', () => {
    // taxable 40M ₪ → 30% = 12M ₪ > absolute ceiling 10,354,816 ₪
    const res = computeCharityCredit(
      [donate(11_000_000)],
      agorot(4_000_000_000),
      y2025,
    );
    expect(res.appliedCeilingAgorot).toBe(1_035_481_600);
    expect(res.eligibleAgorot).toBe(1_035_481_600);
    expect(res.carryforwardOutAgorot).toBe(1_100_000_000 - 1_035_481_600);
  });

  it('handles no donations', () => {
    const res = computeCharityCredit([], agorot(10_000_000), y2025);
    expect(res.creditAgorot).toBe(0);
    expect(res.belowMinimum).toBe(true);
  });

  it('rejects a negative donation loudly', () => {
    expect(() =>
      computeCharityCredit([donate(-5)], agorot(10_000_000), y2025),
    ).toThrow(InvalidTaxInputError);
  });
});
