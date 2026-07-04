import { describe, expect, it } from 'vitest';
import { InvalidTaxInputError } from '../../../src/core/errors';
import { getIlYearData } from '../../../src/jurisdictions/il';
import { computeCreditPoints } from '../../../src/jurisdictions/il/modules/credit-points';

const y2025 = getIlYearData(2025);

describe('computeCreditPoints', () => {
  it('gives a resident man 2.25 points = 6,534 ₪', () => {
    const res = computeCreditPoints(
      { isIsraeliResident: true, gender: 'male' },
      y2025,
    );
    expect(res.points).toBe(2.25);
    expect(res.valueAgorot).toBe(653_400);
    expect(res.breakdown).toEqual([{ reason: 'resident', points: 2.25 }]);
  });

  it('gives a resident woman an extra half point (2.75 = 7,986 ₪)', () => {
    const res = computeCreditPoints(
      { isIsraeliResident: true, gender: 'female' },
      y2025,
    );
    expect(res.points).toBe(2.75);
    expect(res.valueAgorot).toBe(798_600);
    expect(res.breakdown).toEqual([
      { reason: 'resident', points: 2.25 },
      { reason: 'female', points: 0.5 },
    ]);
  });

  it('adds reviewer-entered additional points', () => {
    const res = computeCreditPoints(
      { isIsraeliResident: true, gender: 'male', additionalCreditPoints: 1.5 },
      y2025,
    );
    expect(res.points).toBe(3.75);
    expect(res.valueAgorot).toBe(1_089_000); // 3.75 × 2,904 ₪
    expect(res.breakdown).toContainEqual({ reason: 'additional', points: 1.5 });
  });

  it('gives a non-resident no resident/gender points', () => {
    const res = computeCreditPoints(
      { isIsraeliResident: false, gender: 'female' },
      y2025,
    );
    expect(res.points).toBe(0);
    expect(res.valueAgorot).toBe(0);
    expect(res.breakdown).toEqual([]);
  });

  it('rejects negative or non-quarter additional points loudly', () => {
    expect(() =>
      computeCreditPoints(
        { isIsraeliResident: true, gender: 'male', additionalCreditPoints: -1 },
        y2025,
      ),
    ).toThrow(InvalidTaxInputError);
    expect(() =>
      computeCreditPoints(
        { isIsraeliResident: true, gender: 'male', additionalCreditPoints: 0.3 },
        y2025,
      ),
    ).toThrow(InvalidTaxInputError);
  });
});
