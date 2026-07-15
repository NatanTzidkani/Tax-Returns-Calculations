import { describe, expect, it } from 'vitest';
import { InvalidTaxInputError } from '../../../src/core/errors';
import {
  allocateChildTwelfths,
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
        ctx('singleFatherOfToddler', { motherClaimsUnderSection1: false }),
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
  it('marriedOtherSpouse throws: Schedule B ships disabled until the owner fixes the פעוט range', () => {
    expect(() =>
      allocateChildTwelfths({ ageInTaxYear: 1 }, ctx('marriedOtherSpouse')),
    ).toThrow(/not yet owner-verified/);
    expect(() =>
      allocateChildTwelfths({ ageInTaxYear: 1 }, ctx('marriedOtherSpouse')),
    ).toThrow(/additionalCreditPoints/);
  });

  it('singleFatherOfToddler without the mother-claims guard zeroing it also throws', () => {
    expect(() =>
      allocateChildTwelfths({ ageInTaxYear: 1 }, ctx('singleFatherOfToddler')),
    ).toThrow(/not yet owner-verified/);
    expect(() =>
      allocateChildTwelfths(
        { ageInTaxYear: 1 },
        ctx('singleFatherOfToddler', { motherClaimsUnderSection1: true }),
      ),
    ).toThrow(/not yet owner-verified/);
  });

  it('singleFatherOfToddler with motherClaimsUnderSection1:false → 0 with an explanatory label', () => {
    // §40(ב)(1א) proviso: when the toddler's resident mother is not entitled
    // under (1), the points attach to HER income — this filer gets none.
    const rows = allocateChildTwelfths(
      { ageInTaxYear: 1 },
      ctx('singleFatherOfToddler', { motherClaimsUnderSection1: false }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ reason: 'child', twelfths: 0 });
    expect(rows[0]!.label).toContain('§40(ב)(1א)');
    expect(rows[0]!.label).toContain('האם');
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

  it('receivesChildAllowance yields the §66(ג)(3) row as 0 + TODO label (count owner-verify)', () => {
    // Routing is primary-confirmed (בן-זוג-רשום only) but the current קצבה
    // point COUNT is not — ships as 0 with a loud placeholder label, never a
    // guessed number (plan owner-verify checklist).
    const rows = flatAdditionTwelfths(
      ctx('marriedRegisteredSpouse', { receivesChildAllowance: true }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ reason: 'childAllowance', twelfths: 0 });
    expect(rows[0]!.label).toContain('§66(ג)(3)');
    expect(rows[0]!.label).toContain('טרם אומתה');
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
