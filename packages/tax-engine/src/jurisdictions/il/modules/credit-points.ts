import { agorot } from '@taxreturns/shared';
import { InvalidTaxInputError } from '../../../core/errors';
import type {
  CreditPointsBreakdownRow,
  CreditPointsResult,
  IlYearData,
  TaxpayerInput,
} from '../../../core/types';
import {
  childPointTwelfths,
  olehQualifyingMonthsInTaxYear,
  olehTwelfthsForTaxYear,
} from '../rules/credit-points-tables';

// Points are handled internally in TWELFTHS of a point so arithmetic stays
// integer: the oleh §35 schedule uses ¼ / ⅙ / 1/12 per-month rates, and 12 is
// the least common denominator of {4, 6, 12} (2.25 pts = 27 twelfths;
// 0.25 = 3 twelfths). sources:
// - Resident base 2.25 points (§34 + §36, נקודות זיכוי לתושב ישראל):
//   https://www.kolzchut.org.il/he/נקודות_זיכוי_ממס_הכנסה
// - Additional 0.5 point for a woman (§36א): same source.
// - Children (§40) and oleh (§35) tables: ../rules/credit-points-tables.ts,
//   citing docs/superpowers/research/2026-07-13-credit-points-verification.md
//   §1.1 / §3.1.
// Degree tables (§40ג), the 6-17 child band, and parent allocation are NOT
// computed here yet — the reviewer passes their verified total via
// additionalCreditPoints.

const RESIDENT_TWELFTHS = 27; // 2.25 points
const FEMALE_TWELFTHS = 6; // 0.5 point

function childLabel(ageInTaxYear: number, role: 'custodial' | 'other'): string {
  const who = role === 'custodial' ? 'הורה משמורן' : 'הורה אחר';
  const child = ageInTaxYear === 0 ? 'ילד שנולד בשנת המס' : `ילד בן ${ageInTaxYear}`;
  return `${child} (${who})`;
}

export function computeCreditPoints(
  taxpayer: TaxpayerInput,
  yearData: IlYearData,
): CreditPointsResult {
  const additional = taxpayer.additionalCreditPoints ?? 0;
  // Still restricted to non-negative multiples of 0.25 (= 3 twelfths).
  if (additional < 0 || !Number.isSafeInteger(additional * 4)) {
    throw new InvalidTaxInputError(
      'taxpayer.additionalCreditPoints',
      `must be a non-negative multiple of 0.25, got ${additional}`,
    );
  }
  const additionalTwelfths = additional * 12;

  const breakdown: CreditPointsBreakdownRow[] = [];
  let twelfths = 0;

  if (taxpayer.isIsraeliResident) {
    breakdown.push({ reason: 'resident', points: RESIDENT_TWELFTHS / 12 });
    twelfths += RESIDENT_TWELFTHS;
    if (taxpayer.gender === 'female') {
      breakdown.push({ reason: 'female', points: FEMALE_TWELFTHS / 12 });
      twelfths += FEMALE_TWELFTHS;
    }
  }

  for (const child of taxpayer.children ?? []) {
    // Eligibility (age band) is enforced by the helper — it throws loudly
    // outside 0-18 and for the not-yet-owner-verified 6-17 band.
    const childTwelfths = childPointTwelfths(child.ageInTaxYear, child.role);
    breakdown.push({
      reason: 'child',
      points: childTwelfths / 12,
      label: childLabel(child.ageInTaxYear, child.role),
    });
    twelfths += childTwelfths;
  }

  if (taxpayer.aliyah !== undefined) {
    const { scheduleVariant, aliyahYear, aliyahMonth } = taxpayer.aliyah;
    const olehTwelfths = olehTwelfthsForTaxYear(
      scheduleVariant,
      aliyahYear,
      aliyahMonth,
      yearData.year,
    );
    if (olehTwelfths > 0) {
      const months = olehQualifyingMonthsInTaxYear(
        scheduleVariant,
        aliyahYear,
        aliyahMonth,
        yearData.year,
      );
      breakdown.push({
        reason: 'oleh',
        points: olehTwelfths / 12,
        label: `עולה חדש — ${months} חודשים בשנת המס`,
      });
      twelfths += olehTwelfths;
    }
  }

  if (additionalTwelfths > 0) {
    breakdown.push({ reason: 'additional', points: additional });
    twelfths += additionalTwelfths;
  }

  return {
    points: twelfths / 12,
    breakdown,
    valueAgorot: agorot(Math.round((twelfths * yearData.creditPointValueAgorot) / 12)),
  };
}
