import { describe, expect, it } from 'vitest';
import { InvalidTaxInputError } from '../../../src/core/errors';
import {
  allocateChildTwelfths,
  assertSeparatedNonEntitledMultiplicity,
  flatAdditionTwelfths,
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

  it('6-17 band enabled: Schedule A age 6 → 24 twelfths (2 pts, sah3184 addendum §2)', () => {
    expect(allocateChildTwelfths({ ageInTaxYear: 6 }, ctx('marriedRegisteredSpouse'))).toEqual([
      { reason: 'child', twelfths: 24, label: 'ילד בן 6 (§66(ג)(4) — אם)' },
    ]);
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

describe('allocateChildTwelfths — טופס 116ד birth-year deferral (mother only)', () => {
  it('deferBirthYearPoint at age 0 nets −12 twelfths via a negative birthYearDeferral row', () => {
    const rows = allocateChildTwelfths(
      { ageInTaxYear: 0, deferBirthYearPoint: true },
      ctx('marriedRegisteredSpouse'),
    );
    expect(rows).toEqual([
      { reason: 'child', twelfths: 30, label: 'ילד שנולד בשנת המס (§66(ג)(4) — אם)' },
      {
        reason: 'birthYearDeferral',
        twelfths: -12,
        label: 'דחיית נקודת זיכוי אחת משנת הלידה לשנת המס הבאה (טופס 116ד)',
      },
    ]);
    expect(rows.reduce((sum, r) => sum + r.twelfths, 0)).toBe(30 - 12);
  });

  it('claimDeferredBirthYearPoint at age 1 adds +12 twelfths', () => {
    const rows = allocateChildTwelfths(
      { ageInTaxYear: 1, claimDeferredBirthYearPoint: true },
      ctx('marriedRegisteredSpouse'),
    );
    expect(rows).toEqual([
      { reason: 'child', twelfths: 54, label: 'ילד בן 1 (§66(ג)(4) — אם)' },
      {
        reason: 'birthYearDeferral',
        twelfths: 12,
        label: 'נקודת זיכוי שנדחתה משנת הלידה (טופס 116ד)',
      },
    ]);
  });

  it('the deferral works under the other Schedule-A (mother) regimes too', () => {
    const rows = allocateChildTwelfths(
      { ageInTaxYear: 0, deferBirthYearPoint: true },
      ctx('singleParent'),
    );
    expect(rows.map((r) => r.reason)).toEqual(['child', 'birthYearDeferral']);
  });

  it('throws when deferBirthYearPoint is set for a child not born this year', () => {
    expect(() =>
      allocateChildTwelfths(
        { ageInTaxYear: 2, deferBirthYearPoint: true },
        ctx('marriedRegisteredSpouse'),
      ),
    ).toThrow(InvalidTaxInputError);
  });

  it('throws when claimDeferredBirthYearPoint is set for a child not aged 1', () => {
    // The deferral is exactly one year (gov-116d): the deferred point is
    // claimed the following tax year, when the child reaches age 1.
    expect(() =>
      allocateChildTwelfths(
        { ageInTaxYear: 0, claimDeferredBirthYearPoint: true },
        ctx('marriedRegisteredSpouse'),
      ),
    ).toThrow(InvalidTaxInputError);
  });

  it('either flag on a father regime throws — non-transferable', () => {
    expect(() =>
      allocateChildTwelfths(
        { ageInTaxYear: 0, deferBirthYearPoint: true },
        ctx('marriedOtherSpouse'),
      ),
    ).toThrow(/non-transferable/);
    expect(() =>
      allocateChildTwelfths(
        { ageInTaxYear: 1, claimDeferredBirthYearPoint: true },
        ctx('singleFather', { motherClaimsUnderSection1: false }),
      ),
    ).toThrow(/non-transferable/);
  });

  it('either flag under separatedNonEntitled throws (mother Schedule-A regimes only)', () => {
    expect(() =>
      allocateChildTwelfths(
        { ageInTaxYear: 0, maintenanceShare: 0.5, deferBirthYearPoint: true },
        ctx('separatedNonEntitled'),
      ),
    ).toThrow(InvalidTaxInputError);
  });
});

describe('allocateChildTwelfths — father regimes (§66(ג)(5) / §40(ב)(1א))', () => {
  // Schedule B enabled il-0.7.0: the father column is the tables' `other`
  // column, ALL ages 0-17 — no פעוט gate exists in 2024/2025 law (sah3184
  // addendum §1b/§1c: the definition was deleted from §40(ב)(3)).
  it.each([
    [0, 30, 'ילד שנולד בשנת המס'],
    [1, 54, 'ילד בן 1'],
    [3, 42, 'ילד בן 3'],
    [5, 30, 'ילד בן 5'],
    [6, 12, 'ילד בן 6'],
    [17, 12, 'ילד בן 17'],
  ] as Array<[number, number, string]>)(
    'marriedOtherSpouse age %i → %i twelfths (§66(ג)(5), sah3184 addendum §1c)',
    (age, twelfths, descriptor) => {
      expect(allocateChildTwelfths({ ageInTaxYear: age }, ctx('marriedOtherSpouse'))).toEqual([
        { reason: 'child', twelfths, label: `${descriptor} (§66(ג)(5) — אב)` },
      ]);
    },
  );

  it('marriedOtherSpouse age 18 → legitimate 0 (§66(ג)(5) has no adulthood-year row)', () => {
    expect(allocateChildTwelfths({ ageInTaxYear: 18 }, ctx('marriedOtherSpouse'))).toEqual([
      { reason: 'child', twelfths: 0, label: 'ילד בן 18 (§66(ג)(5) — אב)' },
    ]);
  });

  it('singleFather computes the same column under §40(ב)(1א) (mother-claims true or undeclared)', () => {
    expect(allocateChildTwelfths({ ageInTaxYear: 1 }, ctx('singleFather'))).toEqual([
      { reason: 'child', twelfths: 54, label: 'ילד בן 1 (§40(ב)(1א) — אב במשפחה חד-הורית)' },
    ]);
    expect(
      allocateChildTwelfths(
        { ageInTaxYear: 6 },
        ctx('singleFather', { motherClaimsUnderSection1: true }),
      ),
    ).toEqual([
      { reason: 'child', twelfths: 12, label: 'ילד בן 6 (§40(ב)(1א) — אב במשפחה חד-הורית)' },
    ]);
  });

  it('singleFather with motherClaimsUnderSection1:false → 0 with an explanatory label', () => {
    // §40(ב)(1א) proviso: when the child's resident mother is not entitled
    // under (1), the points attach to HER income — this filer gets none.
    const rows = allocateChildTwelfths(
      { ageInTaxYear: 1 },
      ctx('singleFather', { motherClaimsUnderSection1: false }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ reason: 'child', twelfths: 0 });
    expect(rows[0]!.label).toContain('§40(ב)(1א)');
    expect(rows[0]!.label).toContain('האם');
  });

  it('the mother-claims-false path still validates the age (fail-loud standalone)', () => {
    // Reviewer finding: this was the only allocator path with no age guard —
    // a nonsense age must throw, never silently yield the 0-row.
    for (const age of [42, 2.5, -1]) {
      expect(() =>
        allocateChildTwelfths(
          { ageInTaxYear: age },
          ctx('singleFather', { motherClaimsUnderSection1: false }),
        ),
      ).toThrow(InvalidTaxInputError);
    }
  });
});

describe('assertSeparatedNonEntitledMultiplicity — §40(ב)(2) singular-point gate', () => {
  it('more than one child under separatedNonEntitled throws (disputed multiplicity)', () => {
    expect(() =>
      assertSeparatedNonEntitledMultiplicity(2, 'separatedNonEntitled'),
    ).toThrow(InvalidTaxInputError);
    expect(() =>
      assertSeparatedNonEntitledMultiplicity(3, 'separatedNonEntitled'),
    ).toThrow(/not yet owner-verified/);
    expect(() =>
      assertSeparatedNonEntitledMultiplicity(2, 'separatedNonEntitled'),
    ).toThrow(/additionalCreditPoints/);
  });

  it('a single child under separatedNonEntitled, and any count elsewhere, pass', () => {
    expect(() =>
      assertSeparatedNonEntitledMultiplicity(1, 'separatedNonEntitled'),
    ).not.toThrow();
    expect(() =>
      assertSeparatedNonEntitledMultiplicity(0, 'separatedNonEntitled'),
    ).not.toThrow();
    expect(() =>
      assertSeparatedNonEntitledMultiplicity(5, 'marriedRegisteredSpouse'),
    ).not.toThrow();
  });
});

describe('flatAdditionTwelfths — §40(ב)(1ב) / §40(ב)(2) / §40א / §66(ג)(3)', () => {
  it('singleParent regime adds one extra point (§40(ב)(1ב))', () => {
    expect(flatAdditionTwelfths(ctx('singleParent'))).toEqual([
      {
        reason: 'singleParentBonus',
        twelfths: 12,
        label: 'נקודת זיכוי נוספת — משפחה חד-הורית (§40(ב)(1ב))',
      },
    ]);
  });

  it('separatedEntitled regime adds one extra point (§40(ב)(2))', () => {
    expect(flatAdditionTwelfths(ctx('separatedEntitled'))).toEqual([
      {
        reason: 'separatedBonus',
        twelfths: 12,
        label: 'נקודת זיכוי נוספת — הורים החיים בנפרד (§40(ב)(2))',
      },
    ]);
  });

  it('divorcedPaysMaintenanceRemarried adds §40א on top of the regime bonus', () => {
    const rows = flatAdditionTwelfths(
      ctx('separatedEntitled', { divorcedPaysMaintenanceRemarried: true }),
    );
    expect(rows).toEqual([
      {
        reason: 'separatedBonus',
        twelfths: 12,
        label: 'נקודת זיכוי נוספת — הורים החיים בנפרד (§40(ב)(2))',
      },
      {
        reason: 'section40aBonus',
        twelfths: 12,
        label: 'נקודת זיכוי — גרוש המשלם מזונות והנשוי לבן זוג אחר (§40א)',
      },
    ]);
  });

  it('receivesChildAllowance yields the §66(ג)(3) row at the VERIFIED statutory 0 (NII-paid)', () => {
    // il-0.7.0: no longer an owner-verify placeholder — §40(א) קצבה points
    // are paid by the NII inside קצבת הילדים (תיקון 99/1994, sah3184 addendum
    // §3), never a return-side credit. The row stays as an audit line.
    const rows = flatAdditionTwelfths(
      ctx('marriedRegisteredSpouse', { receivesChildAllowance: true }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ reason: 'childAllowance', twelfths: 0 });
    expect(rows[0]!.label).toContain('§66(ג)(3)');
    expect(rows[0]!.label).toContain('ביטוח לאומי');
    expect(rows[0]!.label).not.toContain('טרם אומתה');
  });

  it('regimes without flat additions yield no rows', () => {
    expect(flatAdditionTwelfths(ctx('marriedRegisteredSpouse'))).toEqual([]);
    expect(flatAdditionTwelfths(ctx('separatedNonEntitled'))).toEqual([]);
  });

  it('throws loudly on an unknown regime', () => {
    expect(() => flatAdditionTwelfths(ctx('widowed' as ParentRegime))).toThrow(
      InvalidTaxInputError,
    );
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
