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
// (§1.1 children, §3.1 oleh) — do not copy counts from anywhere else.
// ---------------------------------------------------------------------------

export type ChildRole = 'custodial' | 'other';

/**
 * §40 child points per eligible parent, by the age the child reaches during
 * the tax year, in twelfths of a point: [custodial, other].
 *
 * Only ages 0-5 and 18 are encoded. The 6-17 band (2 custodial / 1 other) is
 * still secondary-source-only — see the plan's owner-verify checklist item
 * "6-17 band: count (1 vs 2) and income-source restriction"
 * (docs/superpowers/plans/2026-07-13-credit-points.md) — so it ships DISABLED
 * and the helper throws loudly for those ages.
 */
const CHILD_POINT_TWELFTHS: Readonly<
  Record<number, readonly [custodial: number, other: number]>
> = Object.freeze({
  // source: docs/superpowers/research/2026-07-13-credit-points-verification.md
  // §1.1 (kz-under6, kz-under18) — ages 0-5, both roles equal:
  // born this year 2.5 / age 1: 4.5 / 2: 4.5 / 3: 3.5 / 4: 2.5 / 5: 2.5 pts.
  0: [30, 30],
  1: [54, 54],
  2: [54, 54],
  3: [42, 42],
  4: [30, 30],
  5: [30, 30],
  // source: docs/superpowers/research/2026-07-13-credit-points-verification.md
  // §1.1 (kz-under18) — age 18: custodial 0.5 pt, other parent 0.
  18: [6, 0],
});

/**
 * Twelfths of a point for one child at `ageInTaxYear` (the age the child
 * reaches during the tax year), for the given parent `role`. Fail-loud:
 * throws `InvalidTaxInputError` outside 0-18 and for the not-yet-verified
 * 6-17 band.
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
    // Ages 6-17: the per-child count (2 custodial / 1 other) rests on
    // secondary sources only — plan owner-verify item "6-17 band: count
    // (1 vs 2) and income-source restriction"
    // (docs/superpowers/plans/2026-07-13-credit-points.md). Ship disabled
    // and loud until the owner verifies it against the enacted text.
    throw new InvalidTaxInputError(
      'children[].ageInTaxYear',
      `the 6-17 age-band point count is not yet owner-verified (secondary sources only); ` +
        `enter this child's verified points via additionalCreditPoints instead, got age ${ageInTaxYear}`,
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
