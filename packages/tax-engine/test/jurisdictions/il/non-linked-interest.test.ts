import { agorot, type Agorot } from '@taxreturns/shared';
import { describe, expect, it } from 'vitest';
import { InvalidTaxInputError } from '../../../src/core/errors';
import { getIlYearData } from '../../../src/jurisdictions/il';
import { computeNonLinkedInterest } from '../../../src/jurisdictions/il/modules/non-linked-interest';

const y2025 = getIlYearData(2025);
const y2024 = getIlYearData(2024);
const sh = (n: number) => agorot(Math.round(n * 100)) as Agorot;

describe('computeNonLinkedInterest', () => {
  it('taxes deposit/savings interest at a flat 15% (§125ג(ג)(1))', () => {
    const res = computeNonLinkedInterest(
      { amountAgorot: sh(10_000), taxWithheldAgorot: sh(1_500) },
      y2025,
    );
    expect(res.reason).toBe('nonLinkedInterest');
    expect(res.rateBp).toBe(1_500);
    expect(res.amountAgorot).toBe(sh(10_000));
    expect(res.taxAgorot).toBe(sh(1_500));
    expect(res.withheldAgorot).toBe(sh(1_500));
  });

  it('uses the same 15% rate in 2024', () => {
    const res = computeNonLinkedInterest(
      { amountAgorot: sh(20_000), taxWithheldAgorot: sh(0) },
      y2024,
    );
    expect(res.rateBp).toBe(1_500);
    expect(res.taxAgorot).toBe(sh(3_000));
  });

  it('returns a zero result when there is no such income (undefined input)', () => {
    const res = computeNonLinkedInterest(undefined, y2025);
    expect(res.amountAgorot).toBe(0);
    expect(res.taxAgorot).toBe(0);
    expect(res.withheldAgorot).toBe(0);
    expect(res.reason).toBe('nonLinkedInterest');
  });

  it('rounds the 15% half-up like every other engine rate', () => {
    // 15% of 3.33 ₪ = 0.4995 ₪ → rounds to 0.50 ₪ (50 agorot)
    const res = computeNonLinkedInterest(
      { amountAgorot: sh(3.33), taxWithheldAgorot: sh(0) },
      y2025,
    );
    expect(res.taxAgorot).toBe(sh(0.5));
  });

  it('throws InvalidTaxInputError on negative interest amount', () => {
    expect(() =>
      computeNonLinkedInterest(
        { amountAgorot: sh(-1), taxWithheldAgorot: sh(0) },
        y2025,
      ),
    ).toThrow(InvalidTaxInputError);
  });

  it('throws InvalidTaxInputError on negative withholding', () => {
    expect(() =>
      computeNonLinkedInterest(
        { amountAgorot: sh(0), taxWithheldAgorot: sh(-5) },
        y2025,
      ),
    ).toThrow(InvalidTaxInputError);
  });
});
