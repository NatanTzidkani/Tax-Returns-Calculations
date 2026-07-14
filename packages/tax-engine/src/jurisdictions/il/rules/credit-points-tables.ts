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
  return role === 'custodial' ? row[0] : row[1];
}
