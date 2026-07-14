import { describe, expect, it } from 'vitest';
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
  // Structured credit-point inputs (children / aliyah / degrees). The schema
  // is STRUCTURAL only — legal rules (6-17 ban, elective-year candidates,
  // completionYear >= 2014…) stay in the engine, which fails loudly.
  // -------------------------------------------------------------------------

  it('accepts children/aliyah/degrees structured inputs and passes them through', () => {
    const parsed = CalculateRequestSchema.parse({
      taxpayer: {
        gender: 'male',
        children: [
          { ageInTaxYear: 2, role: 'custodial' },
          { ageInTaxYear: 18, role: 'other' },
        ],
        aliyah: { aliyahYear: 2024, aliyahMonth: 7, scheduleVariant: 'from2022' },
        degrees: [{ track: 'bachelor', completionYear: 2023, studyYears: 3 }],
      },
    });
    expect(parsed.taxpayer.children).toEqual([
      { ageInTaxYear: 2, role: 'custodial' },
      { ageInTaxYear: 18, role: 'other' },
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
    expect('aliyah' in parsed.taxpayer).toBe(false);
    expect('degrees' in parsed.taxpayer).toBe(false);
  });

  it.each([
    ['child age above 18', { children: [{ ageInTaxYear: 19, role: 'custodial' }] }],
    ['negative child age', { children: [{ ageInTaxYear: -1, role: 'custodial' }] }],
    ['non-integer child age', { children: [{ ageInTaxYear: 2.5, role: 'custodial' }] }],
    ['unknown child role', { children: [{ ageInTaxYear: 2, role: 'guardian' }] }],
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
