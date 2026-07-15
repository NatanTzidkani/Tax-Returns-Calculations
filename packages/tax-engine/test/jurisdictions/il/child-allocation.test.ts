import { describe, expect, it } from 'vitest';
import { InvalidTaxInputError } from '../../../src/core/errors';
import {
  allocateChildTwelfths,
  type ParentContextInput,
  type ParentRegime,
} from '../../../src/jurisdictions/il/rules/child-allocation';

const ctx = (
  regime: ParentRegime,
  over: Partial<ParentContextInput> = {},
): ParentContextInput => ({ regime, ...over });

describe('allocateChildTwelfths — Schedule A (§66(ג)(4) / §40(ב)(1) / §40(ב)(2))', () => {
  it('marriedRegisteredSpouse age 2 → 54 twelfths under §66(ג)(4)', () => {
    expect(allocateChildTwelfths({ ageInTaxYear: 2 }, ctx('marriedRegisteredSpouse'))).toEqual([
      { reason: 'child', twelfths: 54, label: 'ילד בן 2 (§66(ג)(4) — אם)' },
    ]);
  });

  it('singleParent age 2 → the same Schedule-A 54 twelfths under §40(ב)(1)', () => {
    expect(allocateChildTwelfths({ ageInTaxYear: 2 }, ctx('singleParent'))).toEqual([
      { reason: 'child', twelfths: 54, label: 'ילד בן 2 (§40(ב)(1) — הורה במשפחה חד-הורית)' },
    ]);
  });

  it('separatedEntitled age 2 → the same Schedule-A 54 twelfths under §40(ב)(2)', () => {
    expect(allocateChildTwelfths({ ageInTaxYear: 2 }, ctx('separatedEntitled'))).toEqual([
      { reason: 'child', twelfths: 54, label: 'ילד בן 2 (§40(ב)(2) — הורה זכאי)' },
    ]);
  });

  it('covers the Schedule-A age spread: birth year 30, age 18 → 6 twelfths', () => {
    expect(allocateChildTwelfths({ ageInTaxYear: 0 }, ctx('marriedRegisteredSpouse'))).toEqual([
      { reason: 'child', twelfths: 30, label: 'ילד שנולד בשנת המס (§66(ג)(4) — אם)' },
    ]);
    expect(allocateChildTwelfths({ ageInTaxYear: 18 }, ctx('marriedRegisteredSpouse'))).toEqual([
      { reason: 'child', twelfths: 6, label: 'ילד בן 18 (§66(ג)(4) — אם)' },
    ]);
  });

  it('propagates the loud 6-17 disabled-band throw from the count table', () => {
    // The plan's Task-1 sketch listed 6→24, but the 6-17 band ships DISABLED
    // (secondary sources only — base-plan owner-verify item); the allocator
    // must not bypass the table's guard.
    expect(() =>
      allocateChildTwelfths({ ageInTaxYear: 6 }, ctx('marriedRegisteredSpouse')),
    ).toThrow(/not yet owner-verified/);
  });

  it('propagates the loud out-of-range age throw from the count table', () => {
    expect(() =>
      allocateChildTwelfths({ ageInTaxYear: 19 }, ctx('singleParent')),
    ).toThrow(InvalidTaxInputError);
  });

  it('separateCalculation changes the label suffix only, never the count', () => {
    const rows = allocateChildTwelfths(
      { ageInTaxYear: 2 },
      ctx('marriedRegisteredSpouse', { separateCalculation: true }),
    );
    expect(rows).toEqual([
      {
        reason: 'child',
        twelfths: 54,
        label: 'ילד בן 2 (§66(ג)(4) — אם) — חישוב נפרד (§66(ג)(1א))',
      },
    ]);
  });
});

describe('allocateChildTwelfths — separatedNonEntitled (§40(ב)(2) split כלכלה)', () => {
  it('grants round(12 × maintenanceShare) twelfths per child (0.4 → 5)', () => {
    expect(
      allocateChildTwelfths(
        { ageInTaxYear: 8, maintenanceShare: 0.4 },
        ctx('separatedNonEntitled'),
      ),
    ).toEqual([
      {
        reason: 'maintenanceShare',
        twelfths: 5,
        label: 'ילד בן 8 (§40(ב)(2) — הורה שאינו זכאי, 40% כלכלה)',
      },
    ]);
  });

  it('a full share yields the whole point; a zero share yields a legitimate 0', () => {
    expect(
      allocateChildTwelfths(
        { ageInTaxYear: 3, maintenanceShare: 1 },
        ctx('separatedNonEntitled'),
      )[0],
    ).toMatchObject({ reason: 'maintenanceShare', twelfths: 12 });
    expect(
      allocateChildTwelfths(
        { ageInTaxYear: 18, maintenanceShare: 0 },
        ctx('separatedNonEntitled'),
      )[0],
    ).toMatchObject({ reason: 'maintenanceShare', twelfths: 0 });
  });

  it('throws when maintenanceShare is absent in this regime', () => {
    expect(() =>
      allocateChildTwelfths({ ageInTaxYear: 8 }, ctx('separatedNonEntitled')),
    ).toThrow(InvalidTaxInputError);
  });

  it('throws when maintenanceShare is out of [0,1] or not finite', () => {
    for (const bad of [-0.1, 1.5, Number.NaN]) {
      expect(() =>
        allocateChildTwelfths(
          { ageInTaxYear: 8, maintenanceShare: bad },
          ctx('separatedNonEntitled'),
        ),
      ).toThrow(InvalidTaxInputError);
    }
  });

  it('throws when maintenanceShare is supplied under any other regime', () => {
    expect(() =>
      allocateChildTwelfths(
        { ageInTaxYear: 8, maintenanceShare: 0.4 },
        ctx('marriedRegisteredSpouse'),
      ),
    ).toThrow(InvalidTaxInputError);
  });

  it('still validates the child age loudly (integer 0-18)', () => {
    expect(() =>
      allocateChildTwelfths(
        { ageInTaxYear: 19, maintenanceShare: 0.5 },
        ctx('separatedNonEntitled'),
      ),
    ).toThrow(InvalidTaxInputError);
    expect(() =>
      allocateChildTwelfths(
        { ageInTaxYear: 2.5, maintenanceShare: 0.5 },
        ctx('separatedNonEntitled'),
      ),
    ).toThrow(InvalidTaxInputError);
  });
});

describe('allocateChildTwelfths — regime guard', () => {
  it('throws loudly on an unknown regime', () => {
    expect(() =>
      allocateChildTwelfths(
        { ageInTaxYear: 2 },
        ctx('jointCustody' as ParentRegime),
      ),
    ).toThrow(InvalidTaxInputError);
  });
});
