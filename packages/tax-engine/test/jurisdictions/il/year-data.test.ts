import { describe, expect, it } from 'vitest';
import { UnknownTaxYearError } from '../../../src/core/errors';
import { getIlYearData, SUPPORTED_IL_YEARS } from '../../../src/jurisdictions/il';

describe('getIlYearData', () => {
  it('supports exactly 2024 and 2025', () => {
    expect(SUPPORTED_IL_YEARS).toEqual([2024, 2025]);
    expect(getIlYearData(2024).year).toBe(2024);
    expect(getIlYearData(2025).year).toBe(2025);
  });

  it('throws UnknownTaxYearError for unsupported years', () => {
    expect(() => getIlYearData(2023)).toThrow(UnknownTaxYearError);
    expect(() => getIlYearData(2026)).toThrow(UnknownTaxYearError);
    try {
      getIlYearData(2019);
    } catch (err) {
      expect((err as UnknownTaxYearError).year).toBe(2019);
    }
  });

  for (const year of [2024, 2025]) {
    describe(`year data ${year} (2025 frozen at 2024 values)`, () => {
      const data = getIlYearData(year);

      it('has the official bracket table in agorot', () => {
        expect(data.brackets).toEqual([
          { upToAgorot: 8_412_000, rateBp: 1_000 },
          { upToAgorot: 12_072_000, rateBp: 1_400 },
          { upToAgorot: 19_380_000, rateBp: 2_000 },
          { upToAgorot: 26_928_000, rateBp: 3_100 },
          { upToAgorot: 56_028_000, rateBp: 3_500 },
          { upToAgorot: null, rateBp: 4_700 },
        ]);
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

      it('charges the extra 2% capital surtax only from 2025', () => {
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

      it('taxes real capital gains at 25%', () => {
        expect(data.capitalGains.realGainRateBp).toBe(2_500);
      });
    });
  }

  it('uses the 2025 NI/health employee rates only in 2025', () => {
    expect(getIlYearData(2024).nationalInsurance.employee).toEqual({
      reducedNiBp: 40,
      reducedHealthBp: 310,
      fullNiBp: 700,
      fullHealthBp: 500,
    });
    expect(getIlYearData(2025).nationalInsurance.employee).toEqual({
      reducedNiBp: 104,
      reducedHealthBp: 323,
      fullNiBp: 700,
      fullHealthBp: 517,
    });
  });
});
