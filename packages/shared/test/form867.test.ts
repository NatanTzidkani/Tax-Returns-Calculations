import { describe, expect, it } from 'vitest';
import { Form867Schema } from '../src/documents/form867';

const valid = {
  taxYear: 2025,
  brokerName: 'בנק הפועלים',
  accountId: '123456',
  realGainsAgorot: 1_500_000,
  realLossesAgorot: 0,
  interestDividendAgorot: 250_000,
  taxWithheldAgorot: 375_000,
  uncertainFields: ['interestDividendAgorot'],
};

describe('Form867Schema', () => {
  it('accepts a valid aggregated 867', () => {
    const parsed = Form867Schema.parse(valid);
    expect(parsed.realGainsAgorot).toBe(1_500_000);
  });

  it('defaults uncertainFields to empty and allows omitting accountId', () => {
    const { uncertainFields: _u, accountId: _a, ...rest } = valid;
    const parsed = Form867Schema.parse(rest);
    expect(parsed.uncertainFields).toEqual([]);
    expect(parsed.accountId).toBeUndefined();
  });

  it('rejects negative amounts', () => {
    expect(() =>
      Form867Schema.parse({ ...valid, realLossesAgorot: -100 }),
    ).toThrow();
  });

  it('rejects non-integer agorot', () => {
    expect(() =>
      Form867Schema.parse({ ...valid, realGainsAgorot: 150.5 }),
    ).toThrow();
  });

  it('round-trips through JSON', () => {
    const parsed = Form867Schema.parse(valid);
    expect(Form867Schema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
  });
});
