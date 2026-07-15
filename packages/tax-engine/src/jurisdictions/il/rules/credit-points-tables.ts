import { InvalidTaxInputError } from '../../../core/errors';

// ---------------------------------------------------------------------------
// Statutory credit-point tables (נקודות זיכוי) shared across tax years.
//
// These are statutory POINT COUNTS, not §120ב-indexed money — identical for
// 2024 and 2025 and untouched by the freeze law (which freezes only the point
// *value*, already owner-verified 2026-07-05). Per the Plan-2 architecture
// they live here in a jurisdiction-level rules module, NOT in years/*.ts.
//
// All values are integer TWELFTHS of a point (LCD of the ¼ / ⅙ / 1/12 rates;
// 0.25 pt = 3 twelfths) so arithmetic stays float-free.
//
// Source of truth for every count:
// docs/superpowers/research/2026-07-13-credit-points-verification.md
// (§1.1 children, §3.1 oleh) and, for the child rows, the primary-source
// addendum docs/superpowers/research/2026-07-14-sah3184-parent-allocation-addendum.md
// (§1b enacted ס"ח 3184 verbatim; §2 the 6-17 band) — do not copy counts
// from anywhere else.
// ---------------------------------------------------------------------------

export type ChildRole = 'custodial' | 'other';

/**
 * §40 child points per eligible parent, by the age the child reaches during
 * the tax year, in twelfths of a point: [custodial, other]. Valid for tax
 * years 2024+ (ס"ח 3184 commences 1.1.2024, permanent, no sunset).
 */
const CHILD_POINT_TWELFTHS: Readonly<
  Record<number, readonly [custodial: number, other: number]>
> = Object.freeze({
  // source: sah3184 addendum §1b — enacted ס"ח 3184 §1 verbatim (רשומות),
  // §40(ב)(1)/(1א) and §66(ג)(4)(א)/(5): ages 0-5 both roles equal —
  // born this year 2.5 / age 1: 4.5 / 2: 4.5 / 3: 3.5 / 4: 2.5 / 5: 2.5 pts.
  0: [30, 30],
  1: [54, 54],
  2: [54, 54],
  3: [42, 42],
  4: [30, 30],
  5: [30, 30],
  // source: sah3184 addendum §2 — custodial 2 pts ("ושתי נקודות זיכוי...
  // החל בשנת המס שבה מלאו לו שש שנים ועד לשנת המס שקדמה לשנת בגרותו",
  // enacted §40(ב)(1) tail + consolidated §66(ג)(4)(א)); other parent 1 pt
  // ("נקודת זיכוי אחת", §66(ג)(5)(ג)/§40(ב)(1א)(ג); ita-030124 tables
  // 3.1/3.2).
  6: [24, 12],
  7: [24, 12],
  8: [24, 12],
  9: [24, 12],
  10: [24, 12],
  11: [24, 12],
  12: [24, 12],
  13: [24, 12],
  14: [24, 12],
  15: [24, 12],
  16: [24, 12],
  17: [24, 12],
  // source: docs/superpowers/research/2026-07-13-credit-points-verification.md
  // §1.1 (kz-under18) + consolidated §66(ג)(4)(א) "½ נקודת זיכוי... בשנת
  // בגרותו" — age 18: custodial 0.5 pt; other parent 0 (§66(ג)(5)/§40(ב)(1א)
  // have no adulthood-year row).
  18: [6, 0],
});

/**
 * Twelfths of a point for one child at `ageInTaxYear` (the age the child
 * reaches during the tax year), for the given parent `role`. Fail-loud:
 * throws `InvalidTaxInputError` outside 0-18.
 */
export function childPointTwelfths(ageInTaxYear: number, role: ChildRole): number {
  if (!Number.isInteger(ageInTaxYear) || ageInTaxYear < 0 || ageInTaxYear > 18) {
    throw new InvalidTaxInputError(
      'children[].ageInTaxYear',
      `must be an integer age 0-18 (the age reached during the tax year), got ${ageInTaxYear}`,
    );
  }
  const row = CHILD_POINT_TWELFTHS[ageInTaxYear];
  if (row === undefined) {
    // Unreachable while the table covers 0-18 — kept as a loud tripwire so a
    // future row deletion can never silently zero a child.
    throw new InvalidTaxInputError(
      'children[].ageInTaxYear',
      `no point-table row for age ${ageInTaxYear} — the count table is incomplete`,
    );
  }
  if (role !== 'custodial' && role !== 'other') {
    throw new InvalidTaxInputError(
      'children[].role',
      `must be "custodial" or "other", got ${JSON.stringify(role)}`,
    );
  }
  return role === 'custodial' ? row[0] : row[1];
}

export type OlehScheduleVariant = 'pre2022' | 'from2022';

interface OlehScheduleBand {
  /** Last 1-based schedule month this band covers (inclusive). */
  throughMonth: number;
  twelfthsPerMonth: number;
}

/**
 * §35 oleh graduated monthly schedules, counted from the month oleh status
 * was granted. Twelfths per month: ¼ pt = 3, ⅙ pt = 2, 1/12 pt = 1.
 */
const OLEH_SCHEDULES: Readonly<Record<OlehScheduleVariant, readonly OlehScheduleBand[]>> =
  Object.freeze({
    // source: docs/superpowers/research/2026-07-13-credit-points-verification.md
    // §3.1 (kz-oleh) — aliyah before 1.1.2022:
    // mo 1-18: ¼ · mo 19-30: ⅙ · mo 31-42: 1/12 → total 7.5 pts / 42 months.
    pre2022: Object.freeze([
      { throughMonth: 18, twelfthsPerMonth: 3 },
      { throughMonth: 30, twelfthsPerMonth: 2 },
      { throughMonth: 42, twelfthsPerMonth: 1 },
    ]),
    // source: docs/superpowers/research/2026-07-13-credit-points-verification.md
    // §3.1 (kz-oleh) — aliyah from 1.1.2022 (תיקון 262, permanent per the
    // counts addendum): mo 1-12: 1/12 · mo 13-30: ¼ · mo 31-42: ⅙ ·
    // mo 43-54: 1/12 → total 8.5 pts / 54 months.
    from2022: Object.freeze([
      { throughMonth: 12, twelfthsPerMonth: 1 },
      { throughMonth: 30, twelfthsPerMonth: 3 },
      { throughMonth: 42, twelfthsPerMonth: 2 },
      { throughMonth: 54, twelfthsPerMonth: 1 },
    ]),
  });

function olehRateForScheduleMonth(
  bands: readonly OlehScheduleBand[],
  scheduleMonth: number,
): number {
  if (scheduleMonth < 1) return 0;
  for (const band of bands) {
    if (scheduleMonth <= band.throughMonth) return band.twelfthsPerMonth;
  }
  return 0; // past the schedule window
}

/**
 * Twelfths of a point an oleh accrues within `taxYear`: for each calendar
 * month of the tax year, the 1-based elapsed schedule month is looked up in
 * the variant's bands and the matching per-month rate summed (report §3.1
 * apportionment — a mid-year aliyah gets a fractional first-year figure).
 * No clock-pausing is modelled (plan owner-verify item "exact clock-pausing
 * events"); the reviewer adjusts inputs or uses additionalCreditPoints.
 */
export function olehTwelfthsForTaxYear(
  variant: OlehScheduleVariant,
  aliyahYear: number,
  aliyahMonth: number,
  taxYear: number,
): number {
  const bands = OLEH_SCHEDULES[variant];
  if (bands === undefined) {
    throw new InvalidTaxInputError(
      'aliyah.scheduleVariant',
      `unknown oleh schedule variant "${variant}" (expected "pre2022" or "from2022")`,
    );
  }
  if (!Number.isInteger(aliyahMonth) || aliyahMonth < 1 || aliyahMonth > 12) {
    throw new InvalidTaxInputError(
      'aliyah.aliyahMonth',
      `must be an integer calendar month 1-12, got ${aliyahMonth}`,
    );
  }
  if (!Number.isInteger(aliyahYear) || !Number.isInteger(taxYear)) {
    throw new InvalidTaxInputError(
      'aliyah.aliyahYear',
      `aliyah year and tax year must be integers, got ${aliyahYear} / ${taxYear}`,
    );
  }

  let twelfths = 0;
  for (let m = 1; m <= 12; m += 1) {
    const scheduleMonth = (taxYear - aliyahYear) * 12 + (m - aliyahMonth) + 1;
    twelfths += olehRateForScheduleMonth(bands, scheduleMonth);
  }
  return twelfths;
}

/**
 * How many of the tax year's calendar months are qualifying §35 schedule
 * months — used only for the worksheet label ("עולה חדש — N חודשים בשנת המס").
 * Same month-indexing (and same input validation) as `olehTwelfthsForTaxYear`.
 */
export function olehQualifyingMonthsInTaxYear(
  variant: OlehScheduleVariant,
  aliyahYear: number,
  aliyahMonth: number,
  taxYear: number,
): number {
  // Validate through the twelfths helper so both stay loud and consistent.
  olehTwelfthsForTaxYear(variant, aliyahYear, aliyahMonth, taxYear);
  const bands = OLEH_SCHEDULES[variant];
  let months = 0;
  for (let m = 1; m <= 12; m += 1) {
    const scheduleMonth = (taxYear - aliyahYear) * 12 + (m - aliyahMonth) + 1;
    if (olehRateForScheduleMonth(bands, scheduleMonth) > 0) months += 1;
  }
  return months;
}
