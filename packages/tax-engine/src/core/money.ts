import { agorot, type Agorot } from '@taxreturns/shared';

/**
 * Apply a rate expressed in integer basis points (1 bp = 0.01%) to an
 * agorot amount, rounding half up. All tax rates in the engine are basis
 * points so no float ever touches a monetary value.
 */
export function percentBp(amount: Agorot, bp: number): Agorot {
  if (!Number.isSafeInteger(bp) || bp < 0) {
    throw new TypeError(`rate must be a non-negative integer in basis points, got: ${bp}`);
  }
  return agorot(Math.round((amount * bp) / 10_000));
}

export function subAgorot(a: Agorot, b: Agorot): Agorot {
  return agorot(a - b);
}

export function minAgorot(first: Agorot, ...rest: Agorot[]): Agorot {
  return agorot(Math.min(first, ...rest));
}

export function maxAgorot(first: Agorot, ...rest: Agorot[]): Agorot {
  return agorot(Math.max(first, ...rest));
}
