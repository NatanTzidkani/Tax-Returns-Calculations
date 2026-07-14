import { describe, expect, it } from 'vitest';
import { InvalidTaxInputError } from '../../../src/core/errors';
import { childPointTwelfths } from '../../../src/jurisdictions/il/rules/credit-points-tables';

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
