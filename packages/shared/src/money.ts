/** Integer agorot (1/100 ILS). Branded so plain numbers can't sneak in. */
export type Agorot = number & { readonly __brand: 'Agorot' };

export function agorot(value: number): Agorot {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`Agorot must be a safe integer, got: ${value}`);
  }
  return value as Agorot;
}

/** Convert a shekel amount (possibly fractional) to integer agorot. */
export function shekelsToAgorot(shekels: number): Agorot {
  return agorot(Math.round(shekels * 100));
}

export function addAgorot(...values: Agorot[]): Agorot {
  return agorot(values.reduce<number>((sum, v) => sum + v, 0));
}

const ilsFormatter = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
});

export function formatILS(value: Agorot): string {
  return ilsFormatter.format(value / 100);
}
