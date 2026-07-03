import { describe, expect, it } from 'vitest';
import { addAgorot, agorot, formatILS, shekelsToAgorot } from '../src/money';

describe('agorot', () => {
  it('accepts safe integers', () => {
    expect(agorot(12345)).toBe(12345);
    expect(agorot(0)).toBe(0);
    expect(agorot(-5000)).toBe(-5000); // losses are negative amounts
  });

  it('rejects non-integers', () => {
    expect(() => agorot(1.5)).toThrow(TypeError);
  });

  it('rejects NaN and Infinity', () => {
    expect(() => agorot(Number.NaN)).toThrow(TypeError);
    expect(() => agorot(Number.POSITIVE_INFINITY)).toThrow(TypeError);
  });

  it('rejects unsafe integers', () => {
    expect(() => agorot(Number.MAX_SAFE_INTEGER + 1)).toThrow(TypeError);
  });
});

describe('shekelsToAgorot', () => {
  it('converts whole shekels', () => {
    expect(shekelsToAgorot(150)).toBe(15000);
  });

  it('converts fractional shekels without float drift', () => {
    expect(shekelsToAgorot(0.1 + 0.2)).toBe(30); // 0.30000000000000004 -> 30
  });
});

describe('addAgorot', () => {
  it('sums amounts', () => {
    expect(addAgorot(agorot(100), agorot(250), agorot(-50))).toBe(300);
  });

  it('returns 0 for no arguments', () => {
    expect(addAgorot()).toBe(0);
  });
});

describe('formatILS', () => {
  it('formats agorot as shekels in he-IL currency format', () => {
    const formatted = formatILS(agorot(1234500));
    expect(formatted).toContain('12,345');
    expect(formatted).toContain('₪');
  });
});
