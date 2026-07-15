import { InvalidTaxInputError } from '../../../core/errors';
import { childPointTwelfths } from './credit-points-tables';

// ---------------------------------------------------------------------------
// Child credit-point PARENT ALLOCATION — §66(ג) / §40(ב) / §40א, shared
// across tax years.
//
// This module owns WHICH statutory paragraph governs the filer's child
// points; the per-age COUNTS stay in credit-points-tables.ts
// (childPointTwelfths) and are never duplicated here. The engine does NOT
// decide custody: the regime, registered-spouse status, קצבה receipt, מזונות
// and כלכלה shares are all reviewer inputs — this module only maps the
// declared context onto the right paragraph, failing loud on anything it
// cannot map (never silently defaulting a number).
//
// Source of truth for every allocation rule here:
// docs/superpowers/research/2026-07-13-credit-points-allocation-addendum.md
// (§66(ג)(1),(1א),(3),(4),(5) and §40(ב)(1),(1א),(1ב),(2),(3), §40א quoted
// verbatim from the consolidated פקודת מס הכנסה). Counts come only via
// credit-points-tables.ts, which cites
// docs/superpowers/research/2026-07-13-credit-points-verification.md §1.1 and
// docs/superpowers/research/2026-07-13-credit-points-counts-addendum.md.
//
// Correction flag carried from the allocation addendum §1 ("Correction
// flag"): the count table's `other` column is the SEPARATED-PARENTS framing
// (§40(ב)(2)), NOT a married father. A married father claims under §66(ג)(5)
// (פעוט only) and gets nothing for ages 4-18 — so no branch here ever routes
// a married father to the `other` column; Schedule-A regimes consume the
// `custodial` column and the father schedule ships disabled (see below).
//
// All values are integer TWELFTHS of a point (same unit as the tables
// module) so arithmetic stays float-free.
// ---------------------------------------------------------------------------

/**
 * The reviewer-declared statutory regime for this filer's child points.
 * source: docs/superpowers/research/2026-07-13-credit-points-allocation-addendum.md
 * §§1-2 (the statutory map: each regime is exactly one governing paragraph).
 */
export type ParentRegime =
  | 'marriedRegisteredSpouse' // §66(ג)(4) — the אשה / בן-זוג-רשום, full ages 0-18 (Schedule A)
  | 'marriedOtherSpouse' // §66(ג)(5) — the גבר / other spouse, פעוט only (Schedule B)
  | 'singleParent' // §40(ב)(1) + (1ב) — משפחה חד-הורית, sole custody
  | 'singleFatherOfToddler' // §40(ב)(1א) — אב לפעוט במשפחה חד-הורית
  | 'separatedEntitled' // §40(ב)(2) — הורים החיים בנפרד, the (1)-entitled parent
  | 'separatedNonEntitled'; // §40(ב)(2) — the other separated parent, split כלכלה

/** Mirrors `TaxpayerInput['parentContext']` (core/types.ts). */
export interface ParentContextInput {
  regime: ParentRegime;
  /** §66(ג)(3): this filer is the בן-זוג-רשום receiving the NII קצבה. */
  receivesChildAllowance?: boolean;
  /** §40א: divorced, pays מזונות, remarried → +1 point. */
  divorcedPaysMaintenanceRemarried?: boolean;
  /** §66(ג)(1)/(1א): the filer is computed on a חישוב נפרד. Labels only —
   *  child points are fixed per-parent, never a splittable pool
   *  (allocation addendum §3). */
  separateCalculation?: boolean;
  /** §40(ב)(1א) guard: whether the toddler's resident mother is entitled
   *  under (1). false → the father's פעוט points attach to HER income. */
  motherClaimsUnderSection1?: boolean;
}

/** Mirrors `TaxpayerInput['children'][number]` (core/types.ts). */
export interface ChildContextInput {
  ageInTaxYear: number;
  /** §40(ב)(2) separatedNonEntitled only: this parent's share of כלכלה, 0..1. */
  maintenanceShare?: number;
}

export interface ChildAllocationRow {
  reason: 'child' | 'maintenanceShare' | 'birthYearDeferral';
  twelfths: number;
  label: string;
}

const REGIME_VALUES: readonly ParentRegime[] = [
  'marriedRegisteredSpouse',
  'marriedOtherSpouse',
  'singleParent',
  'singleFatherOfToddler',
  'separatedEntitled',
  'separatedNonEntitled',
];

function assertKnownRegime(regime: ParentRegime): void {
  if (!REGIME_VALUES.includes(regime)) {
    throw new InvalidTaxInputError(
      'parentContext.regime',
      `unknown regime ${JSON.stringify(regime)} (expected one of: ${REGIME_VALUES.join(' | ')})`,
    );
  }
}

/** Same age semantics as the count table: the age the child reaches during
 *  the tax year; children stop qualifying past שנת בגרות (age 18) —
 *  §40(ב)(1) "טרם מלאו להם תשע-עשרה שנה" (allocation addendum §2). */
function assertChildAge(ageInTaxYear: number): void {
  if (!Number.isInteger(ageInTaxYear) || ageInTaxYear < 0 || ageInTaxYear > 18) {
    throw new InvalidTaxInputError(
      'children[].ageInTaxYear',
      `must be an integer age 0-18 (the age reached during the tax year), got ${ageInTaxYear}`,
    );
  }
}

function childDescriptor(ageInTaxYear: number): string {
  return ageInTaxYear === 0 ? 'ילד שנולד בשנת המס' : `ילד בן ${ageInTaxYear}`;
}

/** §66(ג)(1)/(1א) election — labels only, never counts (addendum §3: child
 *  points are fixed per-parent by (4)/(5), not a pool the election splits). */
function separateCalcSuffix(context: ParentContextInput): string {
  return context.separateCalculation === true ? ' — חישוב נפרד (§66(ג)(1א))' : '';
}

/** Hebrew claimant tag per Schedule-A regime (the paragraph applied, so the
 *  worksheet shows WHY — official terminology from the addendum quotes). */
const SCHEDULE_A_CLAIMANTS: Readonly<
  Record<'marriedRegisteredSpouse' | 'singleParent' | 'separatedEntitled', string>
> = Object.freeze({
  // source: allocation addendum §1 — §66(ג)(4): "האשה תהא זכאית... לנקודות
  // זיכוי בעד ילדיה", the full ages 0-18 schedule against her own יגיעה
  // אישית income.
  marriedRegisteredSpouse: '§66(ג)(4) — אם',
  // source: allocation addendum §2 — §40(ב)(1): "הורה במשפחה חד-הורית...
  // בשל ילדיו כאמור הנמצאים אצלו" — the same full build-up (counts addendum
  // §2 cross-check), claimed by the parent "שכלכלתם עליו".
  singleParent: '§40(ב)(1) — הורה במשפחה חד-הורית',
  // source: allocation addendum §2 — §40(ב)(2): "הורים החיים בנפרד" — the
  // parent entitled under (1) keeps the full (1) schedule.
  separatedEntitled: '§40(ב)(2) — הורה זכאי',
});

/**
 * Twelfths of a point (as labelled breakdown rows) this filer gets for one
 * child under the declared regime. Pure; fail-loud on any context it cannot
 * map. Returns rows rather than a bare number because some contexts emit
 * more than one row per child (e.g. the טופס 116ד birth-year deferral);
 * legitimate-0 rows are returned and filtered by the caller (no-zero-rows
 * worksheet convention).
 */
export function allocateChildTwelfths(
  child: ChildContextInput,
  context: ParentContextInput,
): ChildAllocationRow[] {
  assertKnownRegime(context.regime);
  const { regime } = context;
  const age = child.ageInTaxYear;
  const suffix = separateCalcSuffix(context);

  if (child.maintenanceShare !== undefined && regime !== 'separatedNonEntitled') {
    throw new InvalidTaxInputError(
      'children[].maintenanceShare',
      `only valid under the "separatedNonEntitled" regime — §40(ב)(2) grants the ` +
        `fractional point to the parent NOT entitled under (1) (allocation ` +
        `addendum §2); got regime "${regime}"`,
    );
  }

  switch (regime) {
    case 'marriedRegisteredSpouse':
    case 'singleParent':
    case 'separatedEntitled': {
      // Schedule A — the full ages 0-18 column. source: allocation addendum
      // §1 (§66(ג)(4)) and §2 (§40(ב)(1),(2)); counts via childPointTwelfths
      // ('custodial' column), which already fails loud for the disabled 6-17
      // band and out-of-range ages — no guard duplicated here.
      const twelfths = childPointTwelfths(age, 'custodial');
      return [
        {
          reason: 'child',
          twelfths,
          label: `${childDescriptor(age)} (${SCHEDULE_A_CLAIMANTS[regime]})${suffix}`,
        },
      ];
    }

    case 'marriedOtherSpouse':
    case 'singleFatherOfToddler':
      // Schedule B (father §66(ג)(5) / §40(ב)(1א) פעוט schedule) ships
      // DISABLED: the two consolidated ordinance texts DISAGREE on the פעוט
      // range (btl: under 4, father ages 0-3; gov.il: under 6, father ages
      // 0-5 + §66(ג)(5א) for 6-12) — counts addendum §2 note; plan
      // owner-verify item "Exact פעוט age range". Never emit an unverified
      // father count.
      throw new InvalidTaxInputError(
        'parentContext.regime',
        `father §66(ג)(5) פעוט schedule not yet owner-verified (the consolidated ` +
          `ordinance texts disagree on the פעוט age range) — use additionalCreditPoints ` +
          `for this filer's verified child points`,
      );

    case 'separatedNonEntitled': {
      // source: allocation addendum §2 — §40(ב)(2): if כלכלה is split, the
      // parent NOT entitled under (1) gets "נקודת זיכוי אחת או חלק ממנה לפי
      // חלקו בהוצאות הכלכלה" — one point × the reviewer-declared share.
      assertChildAge(age);
      const share = child.maintenanceShare;
      if (share === undefined) {
        throw new InvalidTaxInputError(
          'children[].maintenanceShare',
          `required under the "separatedNonEntitled" regime — §40(ב)(2) grants ` +
            `one point or a fraction pro-rata to this parent's share of ` +
            `maintenance costs (allocation addendum §2)`,
        );
      }
      if (!Number.isFinite(share) || share < 0 || share > 1) {
        throw new InvalidTaxInputError(
          'children[].maintenanceShare',
          `must be a fraction between 0 and 1, got ${share}`,
        );
      }
      // The statutory fraction is inherently non-twelfth; stored as the
      // NEAREST twelfth (Math.round). The rounding convention (round vs
      // floor vs exact fraction) is a plan owner-verify checklist item
      // ("Fractional maintenance points (§40(ב)(2))").
      const twelfths = Math.round(12 * share);
      const sharePercent = Math.round(share * 1000) / 10;
      return [
        {
          reason: 'maintenanceShare',
          twelfths,
          label:
            `${childDescriptor(age)} (§40(ב)(2) — הורה שאינו זכאי, ` +
            `${sharePercent}% כלכלה)${suffix}`,
        },
      ];
    }
  }
}
