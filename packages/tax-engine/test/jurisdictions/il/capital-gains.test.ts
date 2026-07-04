import { agorot, type Agorot } from '@taxreturns/shared';
import { describe, expect, it } from 'vitest';
import { InvalidTaxInputError } from '../../../src/core/errors';
import { getIlYearData } from '../../../src/jurisdictions/il';
import { computeCapitalGains } from '../../../src/jurisdictions/il/modules/capital-gains';

const y2025 = getIlYearData(2025);
const sh = (n: number) => agorot(Math.round(n * 100)) as Agorot;

function entry(over: Partial<Parameters<typeof mk>[0]> = {}) {
  return mk({ gains: 0, losses: 0, interestDividend: 0, withheld: 0, ...over });
}
function mk(v: { gains: number; losses: number; interestDividend: number; withheld: number }) {
  return {
    brokerName: 'ברוקר',
    realGainAgorot: sh(v.gains),
    realLossAgorot: sh(v.losses),
    interestDividendAgorot: sh(v.interestDividend),
    taxWithheldAgorot: sh(v.withheld),
  };
}

describe('computeCapitalGains', () => {
  it('taxes plain gains at 25%', () => {
    const res = computeCapitalGains(
      { entries: [entry({ gains: 10_000, withheld: 2_500 })], lossCarryforwardInAgorot: sh(0) },
      y2025,
    );
    expect(res.taxableGainAgorot).toBe(sh(10_000));
    expect(res.taxAgorot).toBe(sh(2_500));
    expect(res.withheldAgorot).toBe(sh(2_500));
    expect(res.lossCarryforwardOutAgorot).toBe(0);
  });

  it('aggregates across brokers and offsets same-year losses against gains', () => {
    const res = computeCapitalGains(
      {
        entries: [
          entry({ gains: 8_000, withheld: 2_000 }),
          entry({ losses: 3_000 }),
        ],
        lossCarryforwardInAgorot: sh(0),
      },
      y2025,
    );
    expect(res.totalRealGainsAgorot).toBe(sh(8_000));
    expect(res.totalRealLossesAgorot).toBe(sh(3_000));
    expect(res.lossesOffsetAgainstGainsAgorot).toBe(sh(3_000));
    expect(res.taxableGainAgorot).toBe(sh(5_000));
    expect(res.taxAgorot).toBe(sh(1_250));
  });

  it('offsets leftover losses against interest/dividend income', () => {
    const res = computeCapitalGains(
      {
        entries: [entry({ gains: 1_000, losses: 4_000, interestDividend: 2_000 })],
        lossCarryforwardInAgorot: sh(0),
      },
      y2025,
    );
    expect(res.lossesOffsetAgainstGainsAgorot).toBe(sh(1_000));
    expect(res.lossesOffsetAgainstInterestDividendAgorot).toBe(sh(2_000));
    expect(res.taxableGainAgorot).toBe(0);
    expect(res.taxableInterestDividendAgorot).toBe(0);
    expect(res.taxAgorot).toBe(0);
    expect(res.lossCarryforwardOutAgorot).toBe(sh(1_000));
  });

  it('consumes prior-year carry-forward against remaining gains only', () => {
    const res = computeCapitalGains(
      {
        entries: [entry({ gains: 6_000, interestDividend: 1_000 })],
        lossCarryforwardInAgorot: sh(10_000),
      },
      y2025,
    );
    expect(res.carryforwardConsumedAgorot).toBe(sh(6_000));
    expect(res.taxableGainAgorot).toBe(0);
    // carry-forward does NOT absorb interest/dividend income
    expect(res.taxableInterestDividendAgorot).toBe(sh(1_000));
    expect(res.taxAgorot).toBe(sh(250));
    expect(res.lossCarryforwardOutAgorot).toBe(sh(4_000));
  });

  it('taxes interest/dividend at 25% alongside gains', () => {
    const res = computeCapitalGains(
      {
        entries: [entry({ gains: 2_000, interestDividend: 1_000 })],
        lossCarryforwardInAgorot: sh(0),
      },
      y2025,
    );
    expect(res.taxAgorot).toBe(sh(750));
  });

  it('never produces tax when a carry-forward leaves the year', () => {
    for (const gains of [0, 1_000, 5_000]) {
      for (const losses of [6_000, 20_000]) {
        const res = computeCapitalGains(
          { entries: [entry({ gains, losses })], lossCarryforwardInAgorot: sh(500) },
          y2025,
        );
        if (res.lossCarryforwardOutAgorot > 0) {
          expect(res.taxableGainAgorot).toBe(0);
        }
      }
    }
  });

  it('handles the empty case', () => {
    const res = computeCapitalGains(
      { entries: [], lossCarryforwardInAgorot: sh(0) },
      y2025,
    );
    expect(res.taxAgorot).toBe(0);
    expect(res.lossCarryforwardOutAgorot).toBe(0);
  });

  it('rejects negative amounts loudly', () => {
    expect(() =>
      computeCapitalGains(
        { entries: [entry({ losses: -1 })], lossCarryforwardInAgorot: sh(0) },
        y2025,
      ),
    ).toThrow(InvalidTaxInputError);
    expect(() =>
      computeCapitalGains({ entries: [], lossCarryforwardInAgorot: sh(-1) }, y2025),
    ).toThrow(InvalidTaxInputError);
  });
});
