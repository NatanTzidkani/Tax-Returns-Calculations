import { agorot } from '@taxreturns/shared';
import { describe, expect, it } from 'vitest';
import {
  maxAgorot,
  minAgorot,
  percentBp,
  subAgorot,
} from '../../src/core/money';

describe('percentBp', () => {
  it('applies whole percents exactly', () => {
    // 25% of 100.00 ₪
    expect(percentBp(agorot(10_000), 2_500)).toBe(2_500);
    // 10% of 84,120 ₪
    expect(percentBp(agorot(8_412_000), 1_000)).toBe(841_200);
  });

  it('rounds half up on fractional agorot', () => {
    // 35% of 207 ₪ = 72.45 ₪ → 7,245 agorot exactly
    expect(percentBp(agorot(20_700), 3_500)).toBe(7_245);
    // 1.04% of 33.33 ₪ = 34.6632 agorot → 35
    expect(percentBp(agorot(3_333), 104)).toBe(35);
    // 0.5 agora rounds up: 1% of 0.50 ₪ = 0.5 → 1
    expect(percentBp(agorot(50), 100)).toBe(1);
  });

  it('returns 0 for a 0 rate or 0 amount', () => {
    expect(percentBp(agorot(123_456), 0)).toBe(0);
    expect(percentBp(agorot(0), 4_700)).toBe(0);
  });

  it('rejects invalid basis points', () => {
    expect(() => percentBp(agorot(100), -1)).toThrow(TypeError);
    expect(() => percentBp(agorot(100), 12.5)).toThrow(TypeError);
    expect(() => percentBp(agorot(100), Number.NaN)).toThrow(TypeError);
  });
});

describe('subAgorot / minAgorot / maxAgorot', () => {
  it('subtracts', () => {
    expect(subAgorot(agorot(500), agorot(200))).toBe(300);
    expect(subAgorot(agorot(200), agorot(500))).toBe(-300);
  });

  it('takes min and max', () => {
    expect(minAgorot(agorot(3), agorot(7))).toBe(3);
    expect(maxAgorot(agorot(3), agorot(7), agorot(5))).toBe(7);
  });
});
