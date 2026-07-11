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
