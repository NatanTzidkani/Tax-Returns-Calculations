import { agorot } from '@taxreturns/shared';
import { InvalidTaxInputError } from '../../../core/errors';
import type {
  CreditPointsBreakdownRow,
  CreditPointsResult,
  IlYearData,
  TaxpayerInput,
} from '../../../core/types';
import {
  allocateChildTwelfths,
  assertSeparatedNonEntitledMultiplicity,
  flatAdditionTwelfths,
} from '../rules/child-allocation';
import {
  olehQualifyingMonthsInTaxYear,
  olehTwelfthsForTaxYear,
} from '../rules/credit-points-tables';
import {
  assertDegreeExclusivity,
  degreeTwelfthsForTaxYear,
} from '../rules/degree-credit-points';

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
// - Child-point parent allocation (§66(ג)/§40(ב)/§40א regime → schedule,
//   flat additions, טופס 116ד deferral): ../rules/child-allocation.ts, citing
//   docs/superpowers/research/2026-07-13-credit-points-allocation-addendum.md
//   and the 2026-07-14 sah3184 addendum (il-0.7.0: all age bands and both
//   parent columns enabled; קצבה verified statutory 0).
// - Degrees (§40ג-§40ה bachelor/master/vocational claim windows):
//   ../rules/degree-credit-points.ts, citing
//   docs/superpowers/research/2026-07-13-degrees-40g-addendum.md.
// Medicine/direct-track PhD and pre-2014 completions are NOT computed here —
// the reviewer passes their verified total via additionalCreditPoints.

const RESIDENT_TWELFTHS = 27; // 2.25 points
const FEMALE_TWELFTHS = 6; // 0.5 point

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

  const children = taxpayer.children ?? [];
  const parentContext = taxpayer.parentContext;
  if (children.length > 0 && parentContext === undefined) {
    throw new InvalidTaxInputError(
      'taxpayer.parentContext',
      'required when structured children are supplied — the engine never ' +
        'infers the §66(ג)/§40 regime; declare it, or enter the verified ' +
        'child points via additionalCreditPoints',
    );
  }
  if (parentContext !== undefined) {
    // §40(ב)(2) singular-point gate — per-child multiplicity is a disputed
    // reading, so multiple separatedNonEntitled children fail loud.
    assertSeparatedNonEntitledMultiplicity(children.length, parentContext.regime);
    for (const child of children) {
      // The allocation helper owns all regime/age/share/deferral guards and
      // fails loud. Its legitimate 0s (zero-share, age-18 father column)
      // follow the no-zero-rows convention — except rows the helper marks
      // surfaceWhenZero (the §40(ב)(1א) attach-to-the-mother proviso),
      // which are explanatory and must reach the worksheet; the NEGATIVE
      // טופס 116ד deferral row is real money and must flow through.
      for (const row of allocateChildTwelfths(child, parentContext)) {
        if (row.twelfths !== 0 || row.surfaceWhenZero === true) {
          breakdown.push({
            reason: row.reason,
            points: row.twelfths / 12,
            label: row.label,
          });
          twelfths += row.twelfths;
        }
      }
    }
    // Flat per-filer additions (§40(ב)(1ב)/§40(ב)(2)/§40א/§66(ג)(3)). Pushed
    // as returned: the §66(ג)(3) childAllowance row deliberately surfaces at
    // 0 points with its TODO label — an owner-verify placeholder the
    // worksheet must show, not a "nothing applies" zero.
    for (const row of flatAdditionTwelfths(parentContext)) {
      breakdown.push({ reason: row.reason, points: row.twelfths / 12, label: row.label });
      twelfths += row.twelfths;
    }
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

  if (taxpayer.degrees !== undefined) {
    // §7(ב)/§7(ג) contradictions fail loud once, over the whole array.
    assertDegreeExclusivity(taxpayer.degrees);
    for (const degree of taxpayer.degrees) {
      // The rules helper owns all guards and the claim-window derivation;
      // an out-of-window degree yields 0 — no zero rows in the worksheet.
      const { twelfths: degreeTwelfths, label } = degreeTwelfthsForTaxYear(
        degree,
        yearData.year,
      );
      if (degreeTwelfths > 0) {
        breakdown.push({ reason: 'degree', points: degreeTwelfths / 12, label });
        twelfths += degreeTwelfths;
      }
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
