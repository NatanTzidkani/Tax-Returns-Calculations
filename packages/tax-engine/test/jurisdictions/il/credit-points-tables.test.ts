import { describe, expect, it } from 'vitest';
import { InvalidTaxInputError } from '../../../src/core/errors';
import {
  childPointTwelfths,
  olehTwelfthsForTaxYear,
} from '../../../src/jurisdictions/il/rules/credit-points-tables';

// Point counts under test come from the approved research report
// docs/superpowers/research/2026-07-13-credit-points-verification.md §1.1 —
// never from memory. Ages 0-5 give both roles the same count; age 18 is
// custodial-only. The 6-17 band (2 custodial / 1 other) is still
// secondary-source-only (plan owner-verify item "6-17 band: count (1 vs 2)"),
// so it ships DISABLED: the helper throws loudly instead of encoding it.

describe('childPointTwelfths — §40 child age→point table (report §1.1)', () => {
  // report §1.1: born this year 2.5 / 1→4.5 / 2→4.5 / 3→3.5 / 4→2.5 / 5→2.5
  // points per eligible parent, both roles equal, in twelfths of a point.
  const equalBands: Array<[age: number, twelfths: number]> = [
    [0, 30],
    [1, 54],
    [2, 54],
    [3, 42],
    [4, 30],
    [5, 30],
  ];

  it.each(equalBands)(
    'age %i → %i twelfths for BOTH roles (report §1.1, ages 0-5 equal)',
    (age, twelfths) => {
      expect(childPointTwelfths(age, 'custodial')).toBe(twelfths);
      expect(childPointTwelfths(age, 'other')).toBe(twelfths);
    },
  );

  it('age 18 → custodial 6 twelfths (0.5 pt), other 0 (report §1.1)', () => {
    expect(childPointTwelfths(18, 'custodial')).toBe(6);
    expect(childPointTwelfths(18, 'other')).toBe(0);
  });

  it.each([6, 12, 17])(
    'age %i (6-17 band) throws loudly — count not yet owner-verified',
    (age) => {
      // Delta 2: the 6-17 per-child count is secondary-source-only; the
      // reviewer must use additionalCreditPoints for these children.
      expect(() => childPointTwelfths(age, 'custodial')).toThrow(
        InvalidTaxInputError,
      );
      expect(() => childPointTwelfths(age, 'other')).toThrow(
        /not yet owner-verified/,
      );
      expect(() => childPointTwelfths(age, 'custodial')).toThrow(
        /additionalCreditPoints/,
      );
    },
  );

  it.each([-1, 19])('age %i is out of range → InvalidTaxInputError', (age) => {
    expect(() => childPointTwelfths(age, 'custodial')).toThrow(
      InvalidTaxInputError,
    );
    expect(() => childPointTwelfths(age, 'other')).toThrow(
      InvalidTaxInputError,
    );
  });

  it('rejects a non-integer age loudly (fail-loud, never rounds)', () => {
    expect(() => childPointTwelfths(2.5, 'custodial')).toThrow(
      InvalidTaxInputError,
    );
  });
});

describe('olehTwelfthsForTaxYear — §35 oleh monthly schedules (report §3.1)', () => {
  // Load-bearing arithmetic from report §3.1 (which corrects a bad fetched
  // summary that said 3.5 / 4.5): summing every schedule year must total
  // exactly 7.5 pts (90 twelfths) for pre2022 and 8.5 pts (102 twelfths)
  // for from2022.
  it('pre2022 full 42-month sweep totals 7.5 points = 90 twelfths', () => {
    // Aliyah January 2024: schedule spans 2024-2027 (42 months).
    const total = [2024, 2025, 2026, 2027, 2028].reduce(
      (sum, taxYear) => sum + olehTwelfthsForTaxYear('pre2022', 2024, 1, taxYear),
      0,
    );
    expect(total).toBe(90);
    // Per-year apportionment: ¼×12 / (¼×6 + ⅙×6) / (⅙×6 + 1/12×6) / 1/12×6.
    expect(olehTwelfthsForTaxYear('pre2022', 2024, 1, 2024)).toBe(36);
    expect(olehTwelfthsForTaxYear('pre2022', 2024, 1, 2025)).toBe(30);
    expect(olehTwelfthsForTaxYear('pre2022', 2024, 1, 2026)).toBe(18);
    expect(olehTwelfthsForTaxYear('pre2022', 2024, 1, 2027)).toBe(6);
  });

  it('from2022 full 54-month sweep totals 8.5 points = 102 twelfths', () => {
    // Aliyah January 2024: schedule spans 2024-2028 (54 months).
    const total = [2024, 2025, 2026, 2027, 2028, 2029].reduce(
      (sum, taxYear) => sum + olehTwelfthsForTaxYear('from2022', 2024, 1, taxYear),
      0,
    );
    expect(total).toBe(102);
    // First-year band is the low 1/12 rate: 1/12×12 = 12 twelfths = 1 pt.
    expect(olehTwelfthsForTaxYear('from2022', 2024, 1, 2024)).toBe(12);
  });

  it('mid-year aliyah apportions the first year (pre2022, 2024-07 → 18 twelfths)', () => {
    // Schedule months 1-6 fall in Jul-Dec 2024 at ¼/month = 6×3 twelfths.
    expect(olehTwelfthsForTaxYear('pre2022', 2024, 7, 2024)).toBe(18);
  });

  it('a tax year entirely past the schedule window → 0', () => {
    // pre2022 aliyah Jan 2020: months 49-60 fall in 2024, all past month 42.
    expect(olehTwelfthsForTaxYear('pre2022', 2020, 1, 2024)).toBe(0);
  });

  it('a tax year entirely before the aliyah → 0', () => {
    expect(olehTwelfthsForTaxYear('from2022', 2025, 3, 2024)).toBe(0);
  });

  it('throws on an unknown schedule variant', () => {
    expect(() =>
      olehTwelfthsForTaxYear(
        'from2020' as unknown as 'pre2022',
        2024,
        1,
        2024,
      ),
    ).toThrow(InvalidTaxInputError);
  });

  it.each([0, 13])('throws on aliyahMonth %i (outside 1-12)', (month) => {
    expect(() =>
      olehTwelfthsForTaxYear('pre2022', 2024, month, 2024),
    ).toThrow(InvalidTaxInputError);
  });
});
