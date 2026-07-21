import { describe, expect, it } from 'vitest';
import { TaxpayerProfileSchema } from '../src';

// The profile is a PRE-FILL convenience store (plan:
// docs/superpowers/plans/2026-07-14-taxpayer-profile.md): year-independent
// facts only, structural validation only. The one deliberate difference from
// CalculateRequestSchema.taxpayer — children carry yearOfBirth, never
// ageInTaxYear — is what these tests pin.

describe('TaxpayerProfileSchema', () => {
  it('accepts a full profile (children by yearOfBirth, parentContext, aliyah, degrees)', () => {
    const parsed = TaxpayerProfileSchema.parse({
      gender: 'female',
      isIsraeliResident: true,
      children: [
        { yearOfBirth: 2020 },
        { yearOfBirth: 2017, maintenanceShare: 0.4 },
      ],
      parentContext: { regime: 'separatedNonEntitled' },
      aliyah: { aliyahYear: 2023, aliyahMonth: 7, scheduleVariant: 'from2022' },
      degrees: [{ track: 'bachelor', completionYear: 2023, studyYears: 3 }],
    });
    expect(parsed.children).toEqual([
      { yearOfBirth: 2020 },
      { yearOfBirth: 2017, maintenanceShare: 0.4 },
    ]);
    expect(parsed.parentContext).toEqual({ regime: 'separatedNonEntitled' });
  });

  it('accepts a minimal profile — gender only, isIsraeliResident defaults true', () => {
    const parsed = TaxpayerProfileSchema.parse({ gender: 'male' });
    expect(parsed.gender).toBe('male');
    expect(parsed.isIsraeliResident).toBe(true);
  });

  it('absent optional sections stay absent as keys (never [] / null)', () => {
    const parsed = TaxpayerProfileSchema.parse({ gender: 'male' });
    expect('children' in parsed).toBe(false);
    expect('parentContext' in parsed).toBe(false);
    expect('aliyah' in parsed).toBe(false);
    expect('degrees' in parsed).toBe(false);
  });

  it('rejects ageInTaxYear on a child — the profile stores yearOfBirth ONLY', () => {
    // The deliberate schema difference: an age is year-dependent and must be
    // derived at pre-fill time, never persisted.
    const res = TaxpayerProfileSchema.safeParse({
      gender: 'male',
      children: [{ yearOfBirth: 2020, ageInTaxYear: 5 }],
    });
    expect(res.success).toBe(false);
  });

  it('rejects a child with no yearOfBirth', () => {
    expect(
      TaxpayerProfileSchema.safeParse({ gender: 'male', children: [{}] }).success,
    ).toBe(false);
  });

  it.each([[1899], [2101], [2020.5]])(
    'rejects yearOfBirth %p (absurdity bounds / integer only)',
    (yearOfBirth) => {
      expect(
        TaxpayerProfileSchema.safeParse({
          gender: 'male',
          children: [{ yearOfBirth }],
        }).success,
      ).toBe(false);
    },
  );

  it.each([[-0.1], [1.5]])('rejects maintenanceShare %p outside [0,1]', (share) => {
    expect(
      TaxpayerProfileSchema.safeParse({
        gender: 'male',
        children: [{ yearOfBirth: 2020, maintenanceShare: share }],
      }).success,
    ).toBe(false);
  });

  it('rejects unknown enum values (regime, gender, schedule variant)', () => {
    expect(
      TaxpayerProfileSchema.safeParse({
        gender: 'male',
        parentContext: { regime: 'singleFatherOfToddler' }, // renamed il-0.7.0
      }).success,
    ).toBe(false);
    expect(TaxpayerProfileSchema.safeParse({ gender: 'other' }).success).toBe(false);
    expect(
      TaxpayerProfileSchema.safeParse({
        gender: 'male',
        aliyah: { aliyahYear: 2023, aliyahMonth: 7, scheduleVariant: 'from2023' },
      }).success,
    ).toBe(false);
  });

  it('rejects per-year fields at the top level (additionalCreditPoints is not stored)', () => {
    expect(
      TaxpayerProfileSchema.safeParse({
        gender: 'male',
        additionalCreditPoints: 2.25,
      }).success,
    ).toBe(false);
  });

  it('rejects an unknown key inside a reused sub-object (parentContext is now strict)', () => {
    // The profile top-level was already strict; making the SHARED
    // ParentContextSchema/AliyahInputSchema/DegreeInputSchema strict makes the
    // guarantee real all the way down — an unknown nested key is a loud reject,
    // not silent stored drift.
    const res = TaxpayerProfileSchema.safeParse({
      gender: 'male',
      parentContext: { regime: 'singleParent', bogus: true },
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0]?.code).toBe('unrecognized_keys');
    }
  });
});
