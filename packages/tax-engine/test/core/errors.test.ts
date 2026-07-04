import { describe, expect, it } from 'vitest';
import {
  InvalidTaxInputError,
  TaxEngineError,
  UnknownTaxYearError,
} from '../../src/core/errors';

describe('typed errors', () => {
  it('UnknownTaxYearError names the year and extends TaxEngineError', () => {
    const err = new UnknownTaxYearError(2019);
    expect(err).toBeInstanceOf(TaxEngineError);
    expect(err).toBeInstanceOf(Error);
    expect(err.year).toBe(2019);
    expect(err.message).toContain('2019');
  });

  it('InvalidTaxInputError names the offending field', () => {
    const err = new InvalidTaxInputError(
      'salaries[0].grossSalaryAgorot',
      'must be a non-negative integer',
    );
    expect(err).toBeInstanceOf(TaxEngineError);
    expect(err.field).toBe('salaries[0].grossSalaryAgorot');
    expect(err.message).toContain('salaries[0].grossSalaryAgorot');
    expect(err.message).toContain('must be a non-negative integer');
  });
});
