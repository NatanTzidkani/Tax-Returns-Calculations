import { describe, expect, it } from 'vitest';
import { InvalidTaxInputError } from '../../../src/core/errors';
import {
  childPointTwelfths,
  olehTwelfthsForTaxYear,
} from '../../../src/jurisdictions/il/rules/credit-points-tables';

// Point counts under test come from the approved research reports —
// docs/superpowers/research/2026-07-13-credit-points-verification.md §1.1 and,
// for the 6-17 band, the primary-source addendum
// docs/superpowers/research/2026-07-14-sah3184-parent-allocation-addendum.md §2
// (custodial 2 pts / other 1 pt, permanent from 2024) — never from memory.
// Ages 0-5 give both roles the same count; age 18 is custodial-only.

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

  it('an unknown role throws loudly instead of falling back to a column', () => {
    // A typo'd role must never silently pick the other-parent count — for an
    // age-18 child that would turn 0.5 pt into a silent 0.
    expect(() =>
      childPointTwelfths(18, 'custodiaI' as Parameters<typeof childPointTwelfths>[1]),
    ).toThrow(InvalidTaxInputError);
    expect(() =>
      childPointTwelfths(2, '' as Parameters<typeof childPointTwelfths>[1]),
    ).toThrow(/children\[\]\.role/);
  });

  it.each([6, 7, 12, 16, 17])(
    'age %i (6-17 band) → custodial 24 twelfths (2 pts), other 12 (1 pt) — sah3184 addendum §2',
    (age) => {
      // il-0.7.0 enablement: sah3184 addendum §2 — enacted §40(ב)(1) tail /
      // §66(ג)(4)(א) ("ושתי נקודות זיכוי... שש שנים ועד לשנת המס שקדמה לשנת
      // בגרותו") and §66(ג)(5)(ג)/§40(ב)(1א)(ג) ("נקודת זיכוי אחת").
      expect(childPointTwelfths(age, 'custodial')).toBe(24);
      expect(childPointTwelfths(age, 'other')).toBe(12);
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

  it('throws on a non-integer aliyah year (fail-loud)', () => {
    expect(() =>
      olehTwelfthsForTaxYear('pre2022', 2024.5, 1, 2024),
    ).toThrow(InvalidTaxInputError);
  });
});
