import { describe, expect, it } from 'vitest';
import { UnknownTaxYearError } from '../../../src/core/errors';
import { getIlYearData, SUPPORTED_IL_YEARS } from '../../../src/jurisdictions/il';

// Official bracket tables (annual agorot). 2024/2025 share one table (freeze
// law ס"ח 3342); 2026 widened brackets 3-4 by statute (חוק ההתייעלות
// הכלכלית תשפ"ו-2026, retroactive to 1.1.2026) — booklet-2026 פרק ב, see
// docs/superpowers/research/2026-07-17-il-2026-year-data.md §1.1.
const BRACKETS_2024_2025 = [
  { upToAgorot: 8_412_000, rateBp: 1_000 },
  { upToAgorot: 12_072_000, rateBp: 1_400 },
  { upToAgorot: 19_380_000, rateBp: 2_000 },
  { upToAgorot: 26_928_000, rateBp: 3_100 },
  { upToAgorot: 56_028_000, rateBp: 3_500 },
  { upToAgorot: null, rateBp: 4_700 },
];
const BRACKETS_2026 = [
  { upToAgorot: 8_412_000, rateBp: 1_000 }, // עד 84,120 ₪ — frozen
  { upToAgorot: 12_072_000, rateBp: 1_400 }, // עד 120,720 ₪ — frozen
  { upToAgorot: 22_800_000, rateBp: 2_000 }, // עד 228,000 ₪ — WIDENED
  { upToAgorot: 30_120_000, rateBp: 3_100 }, // עד 301,200 ₪ — WIDENED
  { upToAgorot: 56_028_000, rateBp: 3_500 }, // עד 560,280 ₪ — frozen
  { upToAgorot: null, rateBp: 4_700 },
];

describe('getIlYearData', () => {
  it('supports exactly 2024, 2025 and 2026', () => {
    expect(SUPPORTED_IL_YEARS).toEqual([2024, 2025, 2026]);
    expect(getIlYearData(2024).year).toBe(2024);
    expect(getIlYearData(2025).year).toBe(2025);
    expect(getIlYearData(2026).year).toBe(2026);
  });

  it('throws UnknownTaxYearError for unsupported years', () => {
    expect(() => getIlYearData(2023)).toThrow(UnknownTaxYearError);
    expect(() => getIlYearData(2030)).toThrow(UnknownTaxYearError);
    try {
      getIlYearData(2019);
    } catch (err) {
      expect((err as UnknownTaxYearError).year).toBe(2019);
    }
  });

  for (const year of [2024, 2025, 2026]) {
    describe(`year data ${year}`, () => {
      const data = getIlYearData(year);

      it('has the official bracket table in agorot', () => {
        expect(data.brackets).toEqual(
          year >= 2026 ? BRACKETS_2026 : BRACKETS_2024_2025,
        );
      });

      it('has strictly increasing bracket boundaries and rates', () => {
        for (let i = 1; i < data.brackets.length; i += 1) {
          const prev = data.brackets[i - 1]!;
          const cur = data.brackets[i]!;
          if (cur.upToAgorot !== null) {
            expect(cur.upToAgorot).toBeGreaterThan(prev.upToAgorot ?? 0);
          }
          expect(cur.rateBp).toBeGreaterThan(prev.rateBp);
        }
        expect(data.brackets.at(-1)!.upToAgorot).toBeNull();
      });

      it('has credit point value 2,904 ₪', () => {
        expect(data.creditPointValueAgorot).toBe(290_400);
      });

      it('has surtax threshold 721,560 ₪ at 3%', () => {
        expect(data.surtax.thresholdAgorot).toBe(72_156_000);
        expect(data.surtax.rateBp).toBe(300);
      });

      it('charges the extra 2% capital surtax from 2025 onward (§121ב(א1) permanent)', () => {
        expect(data.surtax.capitalAdditionalRateBp).toBe(year >= 2025 ? 200 : 0);
      });

      it('has section 46 charity parameters', () => {
        expect(data.charity).toEqual({
          creditRateBp: 3_500,
          minTotalAgorot: 20_700,
          ceilingAgorot: 1_035_481_600,
          ceilingIncomeShareBp: 3_000,
        });
      });

      it('has section 45a pension credit parameters', () => {
        expect(data.pension45a).toEqual({
          creditRateBp: 3_500,
          contributionCapShareBp: 700,
          qualifyingIncomeCeilingAgorot: 11_640_000,
        });
      });

      it('taxes real capital gains at 25% and non-linked interest at 15%', () => {
        expect(data.capitalGains.realGainRateBp).toBe(2_500);
        expect(data.capitalGains.nonLinkedInterestRateBp).toBe(1_500);
      });
    });
  }

  it('uses the 2025 NI/health employee rates from 2025 onward (הוראת שעה through 2026)', () => {
    expect(getIlYearData(2024).nationalInsurance.employee).toEqual({
      reducedNiBp: 40,
      reducedHealthBp: 310,
      fullNiBp: 700,
      fullHealthBp: 500,
    });
    const rates2025 = {
      reducedNiBp: 104,
      reducedHealthBp: 323,
      fullNiBp: 700,
      fullHealthBp: 517,
    };
    expect(getIlYearData(2025).nationalInsurance.employee).toEqual(rates2025);
    expect(getIlYearData(2026).nationalInsurance.employee).toEqual(rates2025);
  });

  it('updates the NI bands for 2026 (btl-1522-2026: 7,703 ₪ reduced band, 51,910 ₪ ceiling)', () => {
    expect(getIlYearData(2025).nationalInsurance.reducedBandTopMonthlyAgorot).toBe(752_200);
    expect(getIlYearData(2025).nationalInsurance.ceilingMonthlyAgorot).toBe(5_069_500);
    expect(getIlYearData(2026).nationalInsurance.reducedBandTopMonthlyAgorot).toBe(770_300);
    expect(getIlYearData(2026).nationalInsurance.ceilingMonthlyAgorot).toBe(5_191_000);
  });
});
