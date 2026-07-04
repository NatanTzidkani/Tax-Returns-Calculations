import { agorot, type Agorot } from '@taxreturns/shared';
import { describe, expect, it } from 'vitest';
import { getIlYearData } from '../../../src/jurisdictions/il';
import { reconcileNationalInsurance } from '../../../src/jurisdictions/il/modules/national-insurance';

const sh = (n: number) => agorot(Math.round(n * 100)) as Agorot;

const salary = (gross: number, niWithheld?: number) => ({
  employerName: 'מעסיק',
  grossSalaryAgorot: sh(gross),
  taxWithheldAgorot: sh(0),
  pensionEmployeeContributionAgorot: sh(0),
  ...(niWithheld === undefined
    ? {}
    : { niEmployeeWithheldAgorot: sh(niWithheld) }),
});

describe('reconcileNationalInsurance (informational)', () => {
  it('is flagged informational and never null on expected side', () => {
    const res = reconcileNationalInsurance([salary(90_264)], getIlYearData(2025));
    expect(res.informational).toBe(true);
    // Entirely inside the reduced band (90,264 ₪ = 12 × 7,522 ₪):
    // 4.27% × 90,264 = 3,854.27 ₪
    expect(res.expectedEmployeeAgorot).toBe(385_427);
    expect(res.withheldEmployeeAgorot).toBeNull();
    expect(res.differenceAgorot).toBeNull();
  });

  it('applies the full rate above the reduced band (2025 rates)', () => {
    // 190,264 ₪: 90,264 at 4.27% + 100,000 at 12.17% = 3,854.27 + 12,170
    const res = reconcileNationalInsurance([salary(190_264)], getIlYearData(2025));
    expect(res.expectedEmployeeAgorot).toBe(385_427 + 1_217_000);
  });

  it('uses the softer 2024 rates for 2024', () => {
    // Reduced band 2024: 3.5% × 90,264 = 3,159.24 ₪
    const res = reconcileNationalInsurance([salary(90_264)], getIlYearData(2024));
    expect(res.expectedEmployeeAgorot).toBe(315_924);
  });

  it('stops charging at the annual ceiling', () => {
    const y = getIlYearData(2025);
    const atCeiling = reconcileNationalInsurance([salary(608_340)], y); // 12 × 50,695
    const aboveCeiling = reconcileNationalInsurance([salary(2_000_000)], y);
    expect(aboveCeiling.expectedEmployeeAgorot).toBe(atCeiling.expectedEmployeeAgorot);
  });

  it('reports the withheld difference when Form 106 provides it', () => {
    const res = reconcileNationalInsurance(
      [salary(90_264, 4_000)],
      getIlYearData(2025),
    );
    expect(res.withheldEmployeeAgorot).toBe(sh(4_000));
    // withheld 4,000 − expected 3,854.27 = 145.73 ₪ over-withheld
    expect(res.differenceAgorot).toBe(400_000 - 385_427);
  });
});
