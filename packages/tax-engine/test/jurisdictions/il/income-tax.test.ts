import { agorot } from '@taxreturns/shared';
import { describe, expect, it } from 'vitest';
import { InvalidTaxInputError } from '../../../src/core/errors';
import { getIlYearData } from '../../../src/jurisdictions/il';
import { computeIncomeTax } from '../../../src/jurisdictions/il/modules/income-tax';

const y2025 = getIlYearData(2025);

describe('computeIncomeTax', () => {
  it('is 0 on 0 income and produces no rows', () => {
    const res = computeIncomeTax(agorot(0), y2025);
    expect(res.totalAgorot).toBe(0);
    expect(res.rows).toEqual([]);
  });

  it('taxes entirely inside the first bracket at 10%', () => {
    const res = computeIncomeTax(agorot(5_000_000), y2025); // 50,000 ₪
    expect(res.totalAgorot).toBe(500_000); // 5,000 ₪
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0]).toEqual({
      fromAgorot: 0,
      toAgorot: 8_412_000,
      rateBp: 1_000,
      taxedAmountAgorot: 5_000_000,
      taxAgorot: 500_000,
    });
  });

  it('matches the official tax-on-boundary value at 84,120 ₪', () => {
    const res = computeIncomeTax(agorot(8_412_000), y2025);
    expect(res.totalAgorot).toBe(841_200); // 8,412 ₪
    expect(res.rows).toHaveLength(1);
  });

  it('computes a mid-bracket income (100,000 ₪ → 10,635.20 ₪)', () => {
    const res = computeIncomeTax(agorot(10_000_000), y2025);
    expect(res.totalAgorot).toBe(1_063_520);
    expect(res.rows).toHaveLength(2);
    expect(res.rows[1]!.taxedAmountAgorot).toBe(1_588_000);
    expect(res.rows[1]!.taxAgorot).toBe(222_320);
  });

  it('computes across four brackets (200,000 ₪ → 30,074 ₪)', () => {
    const res = computeIncomeTax(agorot(20_000_000), y2025);
    expect(res.totalAgorot).toBe(3_007_400);
    expect(res.rows).toHaveLength(4);
  });

  it('reaches the open-ended 47% bracket (800,000 ₪ → 266,069.20 ₪)', () => {
    const res = computeIncomeTax(agorot(80_000_000), y2025);
    expect(res.totalAgorot).toBe(26_606_920);
    expect(res.rows.at(-1)).toEqual({
      fromAgorot: 56_028_000,
      toAgorot: null,
      rateBp: 4_700,
      taxedAmountAgorot: 23_972_000,
      taxAgorot: 11_266_840,
    });
  });

  it('exposes the taxable income it was given', () => {
    expect(computeIncomeTax(agorot(123), y2025).taxableIncomeAgorot).toBe(123);
  });

  it('rejects negative income loudly', () => {
    expect(() => computeIncomeTax(agorot(-1), y2025)).toThrow(InvalidTaxInputError);
  });

  it('total equals the sum of its rows for a sweep of incomes', () => {
    for (let sh = 0; sh <= 1_000_000; sh += 37_777) {
      const res = computeIncomeTax(agorot(sh * 100), y2025);
      const rowSum = res.rows.reduce((s, r) => s + r.taxAgorot, 0);
      expect(res.totalAgorot).toBe(rowSum);
      const amountSum = res.rows.reduce((s, r) => s + r.taxedAmountAgorot, 0);
      expect(amountSum).toBe(sh * 100);
    }
  });
});
