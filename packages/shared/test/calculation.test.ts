import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { CalculateRequestSchema, TaxYearStatusUpdateSchema } from '../src/calculation';

describe('CalculateRequestSchema', () => {
  it('accepts a full taxpayer and passes values through', () => {
    const parsed = CalculateRequestSchema.parse({
      taxpayer: {
        gender: 'female',
        isIsraeliResident: false,
        additionalCreditPoints: 2.25,
      },
    });
    expect(parsed.taxpayer).toEqual({
      gender: 'female',
      isIsraeliResident: false,
      additionalCreditPoints: 2.25,
    });
  });

  it('defaults isIsraeliResident=true and additionalCreditPoints=0', () => {
    const parsed = CalculateRequestSchema.parse({ taxpayer: { gender: 'male' } });
    expect(parsed.taxpayer.isIsraeliResident).toBe(true);
    expect(parsed.taxpayer.additionalCreditPoints).toBe(0);
  });

  it('rejects an unknown gender', () => {
    expect(() =>
      CalculateRequestSchema.parse({ taxpayer: { gender: 'x' } }),
    ).toThrow();
  });

  it('rejects negative additional credit points', () => {
    expect(() =>
      CalculateRequestSchema.parse({
        taxpayer: { gender: 'male', additionalCreditPoints: -0.25 },
      }),
    ).toThrow();
  });

  it('rejects additional credit points that are not a multiple of 0.25', () => {
    expect(() =>
      CalculateRequestSchema.parse({
        taxpayer: { gender: 'male', additionalCreditPoints: 1.1 },
      }),
    ).toThrow();
  });

  it('rejects a missing taxpayer object', () => {
    expect(() => CalculateRequestSchema.parse({})).toThrow();
  });

  it('accepts optional non-linked-interest fields (integer agorot)', () => {
    const parsed = CalculateRequestSchema.parse({
      taxpayer: { gender: 'male' },
      nonLinkedInterestAgorot: 1_000_000,
      nonLinkedInterestWithheldAgorot: 150_000,
    });
    expect(parsed.nonLinkedInterestAgorot).toBe(1_000_000);
    expect(parsed.nonLinkedInterestWithheldAgorot).toBe(150_000);
  });

  it('leaves non-linked-interest fields undefined when omitted', () => {
    const parsed = CalculateRequestSchema.parse({ taxpayer: { gender: 'male' } });
    expect(parsed.nonLinkedInterestAgorot).toBeUndefined();
    expect(parsed.nonLinkedInterestWithheldAgorot).toBeUndefined();
  });

  it('rejects a negative non-linked-interest amount', () => {
    expect(() =>
      CalculateRequestSchema.parse({
        taxpayer: { gender: 'male' },
        nonLinkedInterestAgorot: -1,
      }),
    ).toThrow();
  });

  it('rejects a non-integer (fractional agorot) non-linked-interest amount', () => {
    expect(() =>
      CalculateRequestSchema.parse({
        taxpayer: { gender: 'male' },
        nonLinkedInterestAgorot: 100.5,
      }),
    ).toThrow();
  });

  // -------------------------------------------------------------------------
  // Structured credit-point inputs (children+parentContext / aliyah /
  // degrees). The schema is STRUCTURAL only — legal rules (6-17 ban, which
  // regimes are enabled, maintenanceShare↔regime pairing, deferral
  // eligibility, children-require-parentContext, elective-year candidates,
  // completionYear >= 2014…) stay in the engine, which fails loudly.
  // -------------------------------------------------------------------------

  it('accepts children/parentContext/aliyah/degrees structured inputs and passes them through', () => {
    const parsed = CalculateRequestSchema.parse({
      taxpayer: {
        gender: 'male',
        parentContext: { regime: 'marriedRegisteredSpouse' },
        children: [{ ageInTaxYear: 2 }, { ageInTaxYear: 18 }],
        aliyah: { aliyahYear: 2024, aliyahMonth: 7, scheduleVariant: 'from2022' },
        degrees: [{ track: 'bachelor', completionYear: 2023, studyYears: 3 }],
      },
    });
    expect(parsed.taxpayer.parentContext).toEqual({
      regime: 'marriedRegisteredSpouse',
    });
    expect(parsed.taxpayer.children).toEqual([
      { ageInTaxYear: 2 },
      { ageInTaxYear: 18 },
    ]);
    expect(parsed.taxpayer.aliyah).toEqual({
      aliyahYear: 2024,
      aliyahMonth: 7,
      scheduleVariant: 'from2022',
    });
    expect(parsed.taxpayer.degrees).toEqual([
      { track: 'bachelor', completionYear: 2023, studyYears: 3 },
    ]);
  });

  it.each([
    'marriedRegisteredSpouse',
    'marriedOtherSpouse',
    'singleParent',
    'singleFather',
    'separatedEntitled',
    'separatedNonEntitled',
  ] as const)('accepts parentContext regime %s (enabling is the engine call)', (regime) => {
    const parsed = CalculateRequestSchema.parse({
      taxpayer: { gender: 'male', parentContext: { regime } },
    });
    expect(parsed.taxpayer.parentContext).toEqual({ regime });
  });

  it('passes the optional parentContext flags and per-child context through verbatim', () => {
    const parsed = CalculateRequestSchema.parse({
      taxpayer: {
        gender: 'female',
        parentContext: {
          regime: 'separatedNonEntitled',
          receivesChildAllowance: true,
          divorcedPaysMaintenanceRemarried: true,
          separateCalculation: false,
          motherClaimsUnderSection1: true,
        },
        children: [
          { ageInTaxYear: 8, maintenanceShare: 0.4 },
          { ageInTaxYear: 0, deferBirthYearPoint: true },
          { ageInTaxYear: 1, claimDeferredBirthYearPoint: true },
        ],
      },
    });
    expect(parsed.taxpayer.parentContext).toEqual({
      regime: 'separatedNonEntitled',
      receivesChildAllowance: true,
      divorcedPaysMaintenanceRemarried: true,
      separateCalculation: false,
      motherClaimsUnderSection1: true,
    });
    expect(parsed.taxpayer.children).toEqual([
      { ageInTaxYear: 8, maintenanceShare: 0.4 },
      { ageInTaxYear: 0, deferBirthYearPoint: true },
      { ageInTaxYear: 1, claimDeferredBirthYearPoint: true },
    ]);
  });

  it('does NOT require parentContext when children are supplied (engine-owned rule)', () => {
    // Structural-only boundary: the engine throws its own Hebrew-mapped 400
    // for children-without-parentContext; Zod must let it through.
    const parsed = CalculateRequestSchema.parse({
      taxpayer: { gender: 'male', children: [{ ageInTaxYear: 2 }] },
    });
    expect('parentContext' in parsed.taxpayer).toBe(false);
    expect(parsed.taxpayer.children).toEqual([{ ageInTaxYear: 2 }]);
  });

  it('does NOT pair maintenanceShare with a regime (engine-owned rule)', () => {
    // maintenanceShare under a non-separated regime is the ENGINE's loud
    // throw, not a Zod rejection.
    const parsed = CalculateRequestSchema.parse({
      taxpayer: {
        gender: 'male',
        parentContext: { regime: 'marriedRegisteredSpouse' },
        children: [{ ageInTaxYear: 2, maintenanceShare: 0.5 }],
      },
    });
    expect(parsed.taxpayer.children).toEqual([
      { ageInTaxYear: 2, maintenanceShare: 0.5 },
    ]);
  });

  it('accepts a degree with electedClaimYear and one with an internship', () => {
    const parsed = CalculateRequestSchema.parse({
      taxpayer: {
        gender: 'female',
        degrees: [
          {
            track: 'bachelor',
            completionYear: 2020,
            studyYears: 3,
            electedClaimYear: 2021,
          },
          {
            track: 'master',
            completionYear: 2023,
            studyYears: 2,
            internship: { startYear: 2023, endYear: 2024 },
          },
        ],
      },
    });
    expect(parsed.taxpayer.degrees).toEqual([
      { track: 'bachelor', completionYear: 2020, studyYears: 3, electedClaimYear: 2021 },
      {
        track: 'master',
        completionYear: 2023,
        studyYears: 2,
        internship: { startYear: 2023, endYear: 2024 },
      },
    ]);
  });

  it('keeps absent structured fields ABSENT as keys (engine must see undefined, never [])', () => {
    const parsed = CalculateRequestSchema.parse({ taxpayer: { gender: 'male' } });
    expect('children' in parsed.taxpayer).toBe(false);
    expect('parentContext' in parsed.taxpayer).toBe(false);
    expect('aliyah' in parsed.taxpayer).toBe(false);
    expect('degrees' in parsed.taxpayer).toBe(false);
  });

  it.each([
    ['child age above 18', { children: [{ ageInTaxYear: 19 }] }],
    ['negative child age', { children: [{ ageInTaxYear: -1 }] }],
    ['non-integer child age', { children: [{ ageInTaxYear: 2.5 }] }],
    [
      'maintenanceShare above 1',
      { children: [{ ageInTaxYear: 8, maintenanceShare: 1.5 }] },
    ],
    [
      'negative maintenanceShare',
      { children: [{ ageInTaxYear: 8, maintenanceShare: -0.1 }] },
    ],
    [
      'non-boolean deferBirthYearPoint',
      { children: [{ ageInTaxYear: 0, deferBirthYearPoint: 'yes' }] },
    ],
    ['unknown parentContext regime', { parentContext: { regime: 'jointCustody' } }],
    ['missing parentContext regime', { parentContext: {} }],
    [
      'non-boolean parentContext flag',
      { parentContext: { regime: 'singleParent', receivesChildAllowance: 1 } },
    ],
    [
      'aliyah month 0',
      { aliyah: { aliyahYear: 2024, aliyahMonth: 0, scheduleVariant: 'from2022' } },
    ],
    [
      'aliyah month 13',
      { aliyah: { aliyahYear: 2024, aliyahMonth: 13, scheduleVariant: 'from2022' } },
    ],
    [
      'non-integer aliyah year',
      { aliyah: { aliyahYear: 2024.5, aliyahMonth: 7, scheduleVariant: 'from2022' } },
    ],
    [
      'unknown aliyah schedule variant',
      { aliyah: { aliyahYear: 2024, aliyahMonth: 7, scheduleVariant: 'since2022' } },
    ],
    [
      'unknown degree track',
      { degrees: [{ track: 'phd', completionYear: 2023, studyYears: 3 }] },
    ],
    [
      'negative studyYears',
      { degrees: [{ track: 'bachelor', completionYear: 2023, studyYears: -3 }] },
    ],
    [
      'zero studyYears',
      { degrees: [{ track: 'bachelor', completionYear: 2023, studyYears: 0 }] },
    ],
    [
      'non-integer completionYear',
      { degrees: [{ track: 'bachelor', completionYear: 2023.5, studyYears: 3 }] },
    ],
    [
      'non-integer electedClaimYear',
      {
        degrees: [
          { track: 'bachelor', completionYear: 2020, studyYears: 3, electedClaimYear: 2021.5 },
        ],
      },
    ],
    [
      'non-integer internship years',
      {
        degrees: [
          {
            track: 'bachelor',
            completionYear: 2023,
            studyYears: 3,
            internship: { startYear: 2023.5, endYear: 2024 },
          },
        ],
      },
    ],
  ])('rejects %s', (_name, extra) => {
    expect(() =>
      CalculateRequestSchema.parse({ taxpayer: { gender: 'male', ...extra } }),
    ).toThrow();
  });

  // -------------------------------------------------------------------------
  // Strict: unknown keys are REJECTED, never silently stripped. A dropped key
  // (e.g. the removed children[].role, or a misspelled maintenanceShare)
  // would produce a wrong credit-point allocation with no error — exactly the
  // silent-default the engine's fail-loud contract forbids.
  // -------------------------------------------------------------------------

  it('rejects an unknown top-level key on the request (fail-loud, no silent drop)', () => {
    const res = CalculateRequestSchema.safeParse({
      taxpayer: { gender: 'male' },
      surprise: 1,
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toBeInstanceOf(ZodError);
      expect(res.error.issues[0].code).toBe('unrecognized_keys');
    }
  });

  it('rejects an unknown key inside taxpayer', () => {
    const res = CalculateRequestSchema.safeParse({
      taxpayer: { gender: 'male', maritalStatus: 'single' },
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].code).toBe('unrecognized_keys');
    }
  });

  it('rejects the removed children[].role key (was silently dropped before strict)', () => {
    const res = CalculateRequestSchema.safeParse({
      taxpayer: {
        gender: 'male',
        parentContext: { regime: 'separatedEntitled' },
        children: [{ ageInTaxYear: 8, role: 'custodial' }],
      },
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].code).toBe('unrecognized_keys');
    }
  });

  it('rejects a misspelled maintenanceShare inside a child (would mis-allocate silently)', () => {
    const res = CalculateRequestSchema.safeParse({
      taxpayer: {
        gender: 'male',
        parentContext: { regime: 'separatedNonEntitled' },
        children: [{ ageInTaxYear: 8, maintainanceShare: 0.5 }],
      },
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].code).toBe('unrecognized_keys');
    }
  });

  it('rejects an unknown key inside parentContext', () => {
    const res = CalculateRequestSchema.safeParse({
      taxpayer: {
        gender: 'male',
        parentContext: { regime: 'singleFather', motherClaims: true },
      },
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].code).toBe('unrecognized_keys');
    }
  });

  it('rejects an unknown key inside aliyah', () => {
    const res = CalculateRequestSchema.safeParse({
      taxpayer: {
        gender: 'male',
        aliyah: {
          aliyahYear: 2024,
          aliyahMonth: 7,
          scheduleVariant: 'from2022',
          country: 'US',
        },
      },
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].code).toBe('unrecognized_keys');
    }
  });

  it('rejects an unknown key inside a degree entry', () => {
    const res = CalculateRequestSchema.safeParse({
      taxpayer: {
        gender: 'male',
        degrees: [
          { track: 'bachelor', completionYear: 2023, studyYears: 3, institution: 'HUJI' },
        ],
      },
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].code).toBe('unrecognized_keys');
    }
  });
});

describe('TaxYearStatusUpdateSchema', () => {
  it.each(['draft', 'in_review', 'ready_to_file', 'filed', 'amended'] as const)(
    'accepts status %s',
    (status) => {
      expect(TaxYearStatusUpdateSchema.parse({ status })).toEqual({ status });
    },
  );

  it('rejects an unknown status', () => {
    expect(() => TaxYearStatusUpdateSchema.parse({ status: 'done' })).toThrow();
  });

  it('rejects a missing status', () => {
    expect(() => TaxYearStatusUpdateSchema.parse({})).toThrow();
  });
});
