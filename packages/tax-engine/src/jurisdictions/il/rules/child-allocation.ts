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
// verbatim from the consolidated פקודת מס הכנסה), as amended by
// docs/superpowers/research/2026-07-14-sah3184-parent-allocation-addendum.md
// (the enacted ס"ח 3184 read verbatim: father Schedule B = the full `other`
// column ages 0-17, the פעוט gate deleted from §40(ב)(3), קצבה = statutory
// 0 in the computation). Counts come only via credit-points-tables.ts.
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
  | 'marriedOtherSpouse' // §66(ג)(5) — the גבר / other spouse, all his children (Schedule B)
  | 'singleParent' // §40(ב)(1) + (1ב) — משפחה חד-הורית שבה ילד להורה אחד
  | 'singleFather' // §40(ב)(1א) — אב לילד במשפחה חד-הורית (פעוט scope removed by ס"ח 3048/3184)
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
  /** §40(ב)(1א) guard: whether the child's resident mother is entitled
   *  under (1). false → the father's child points attach to HER income. */
  motherClaimsUnderSection1?: boolean;
}

/** Mirrors `TaxpayerInput['children'][number]` (core/types.ts). */
export interface ChildContextInput {
  ageInTaxYear: number;
  /** §40(ב)(2) separatedNonEntitled only: this parent's share of כלכלה, 0..1. */
  maintenanceShare?: number;
  /** טופס 116ד: the mother defers this child's ONE birth-year point to the
   *  next tax year. Age 0 + mother Schedule-A regimes only. */
  deferBirthYearPoint?: boolean;
  /** טופס 116ד: this filer CLAIMS the point deferred from the prior year for
   *  this child (age 1 in the claim year). Mother-only, same guard. */
  claimDeferredBirthYearPoint?: boolean;
}

export interface ChildAllocationRow {
  reason: 'child' | 'maintenanceShare' | 'birthYearDeferral';
  twelfths: number;
  label: string;
  /** An EXPLANATORY 0 (e.g. the §40(ב)(1א) points-attach-to-the-mother
   *  proviso) that must survive the caller's no-zero-rows filter and reach
   *  the worksheet — a plain table 0 (father age 18) stays filtered. */
  surfaceWhenZero?: true;
}

export interface FlatAdditionRow {
  reason: 'singleParentBonus' | 'separatedBonus' | 'section40aBonus' | 'childAllowance';
  twelfths: number;
  label: string;
}

/**
 * §66(ג)(3) routes the §40(א) קצבה points to the בן-זוג-רשום — and since
 * תיקון 99 (תשנ"ד-1994) those points are PAID BY THE NII inside קצבת
 * הילדים, never a credit in the annual tax computation: §40(א) sipa
 * "תשלום נקודות הקיצבה ייעשה בידי המוסד לביטוח לאומי לפי חוק הביטוח
 * הלאומי" + the §33א definition. Verified statutory 0 (sah3184 addendum
 * §3) — not a placeholder. The row is kept as an informational audit line
 * (no-black-box worksheet convention).
 */
const CHILD_ALLOWANCE_TWELFTHS = 0;

const REGIME_VALUES: readonly ParentRegime[] = [
  'marriedRegisteredSpouse',
  'marriedOtherSpouse',
  'singleParent',
  'singleFather',
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

  // טופס 116ד birth-year deferral guards. source: §66(ג)(4)(א1) /
  // §40(ב)(1א1), תיקון 247 תשע"ח-2018 (sah3184 addendum §4 pinned the
  // statutory anchor): "אמו של ילד תהיה זכאית לבחור אם נקודת זיכוי אחת...
  // בשנת הלידה, תובא בחשבון בשנת המס שבה נולד הילד או בשנת המס שלאחריה" —
  // MOTHER-ONLY and non-transferable, so it exists only under the
  // Schedule-A (mother/§66(ג)(4)/§40(ב)(1),(2 entitled)) regimes.
  const defers = child.deferBirthYearPoint === true;
  const claims = child.claimDeferredBirthYearPoint === true;
  if (defers || claims) {
    const flagField = defers
      ? 'children[].deferBirthYearPoint'
      : 'children[].claimDeferredBirthYearPoint';
    if (regime === 'marriedOtherSpouse' || regime === 'singleFather') {
      // source: §40(ב)(1א1)/§66(ג)(4)(א1) (תיקון 247, תשע"ח-2018 — sah3184
      // addendum §4): "אמו של ילד תהיה זכאית לבחור..." — mother-only.
      throw new InvalidTaxInputError(
        flagField,
        `the טופס 116ד birth-year deferral is mother-only and non-transferable ` +
          `(§40(ב)(1א1)/§66(ג)(4)(א1)) — not available under the father regime "${regime}"`,
      );
    }
    if (regime === 'separatedNonEntitled') {
      throw new InvalidTaxInputError(
        flagField,
        `the טופס 116ד birth-year deferral is modelled only for the mother ` +
          `Schedule-A regimes (§66(ג)(4) / §40(ב)(1),(2 entitled)) — not under ` +
          `"separatedNonEntitled"`,
      );
    }
    if (defers && age !== 0) {
      throw new InvalidTaxInputError(
        'children[].deferBirthYearPoint',
        `only valid for a child born in the tax year (age 0) — the deferral moves ` +
          `the birth-year point (gov-116d, allocation addendum §4), got age ${age}`,
      );
    }
    if (claims && age !== 1) {
      throw new InvalidTaxInputError(
        'children[].claimDeferredBirthYearPoint',
        `the deferred birth-year point is claimed in the FOLLOWING tax year, when ` +
          `the child reaches age 1 (gov-116d, allocation addendum §4), got age ${age}`,
      );
    }
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
      const rows: ChildAllocationRow[] = [
        {
          reason: 'child',
          twelfths,
          label: `${childDescriptor(age)} (${SCHEDULE_A_CLAIMANTS[regime]})${suffix}`,
        },
      ];
      if (regime === 'singleParent') {
        // source: §40(ב)(1ב) verbatim (wikisource, re-read 2026-07-15;
        // sah3184 addendum §2): "וכן יובאו בחשבון כנגד הכנסתו של ההורה
        // כאמור, על אף הוראות פסקה (1א), גם נקודות הזיכוי לפי אותה פסקה" —
        // the הורה-יחיד stacks the (1א) column (the tables' `other` role,
        // 0 at 18 → legitimate-0, filtered by the caller) on top of the
        // (1) schedule, per child; ita-030124 §3.3 states the same
        // both-columns rule. Enabled il-0.7.0.
        rows.push({
          reason: 'child',
          twelfths: childPointTwelfths(age, 'other'),
          label: `${childDescriptor(age)} — נקודות §40(ב)(1א) להורה יחיד (§40(ב)(1ב))${suffix}`,
        });
      }
      if (defers) {
        // Negative in the defer year — one full point moves to next year.
        rows.push({
          reason: 'birthYearDeferral',
          twelfths: -12,
          label: 'דחיית נקודת זיכוי אחת משנת הלידה לשנת המס הבאה (טופס 116ד)',
        });
      }
      if (claims) {
        rows.push({
          reason: 'birthYearDeferral',
          twelfths: 12,
          label: 'נקודת זיכוי שנדחתה משנת הלידה (טופס 116ד)',
        });
      }
      return rows;
    }

    case 'singleFather':
    case 'marriedOtherSpouse': {
      // Schedule B — the father column (the tables' `other` role), ALL ages
      // 0-18 (a legitimate 0 at 18). Enabled il-0.7.0.
      // source: sah3184 addendum §1b/§1c — the enacted ס"ח 3184 §1(2)(ב)
      // rewrote §66(ג)(5) to explicit bands over "בעד כל אחד מילדיו" and the
      // פעוט definition is DELETED from §40(ב)(3) ("פעוט" – (נמחקה));
      // consolidated §66(ג)(5)(א)-(ג) / §40(ב)(1א)(א)-(ג) verbatim (re-read
      // from wikisource 2026-07-15): birth 2½ / ages 1-2 4½ / age 3 3½ /
      // ages 4-5 2½ / ages 6-17 1 / age 18 — no row.
      if (regime === 'singleFather') {
        // Age validity holds on EVERY path (fail-loud standalone): the
        // mother-claims proviso below returns without consulting the count
        // table, so it must validate the age itself.
        assertChildAge(age);
        if (context.motherClaimsUnderSection1 === false) {
          // source: §40(ב)(1א) proviso, verbatim (survives ס"ח 3184 —
          // sah3184 addendum §1c): "ואולם אם אמו של הילד במשפחה חד-הורית
          // היא תושבת ישראל ואינה זכאית, בשל אותו ילד, לנקודות זיכוי לפי
          // פסקה (1), יובאו בחשבון נקודות הזיכוי לפי פסקת משנה זו, כנגד
          // הכנסתה מיגיעה אישית, ולא כנגד הכנסתו של האב" — the points
          // attach to the MOTHER's income; this filer gets a legitimate 0
          // (dropped by the no-zero-rows caller).
          return [
            {
              reason: 'child',
              twelfths: 0,
              label:
                `${childDescriptor(age)} (§40(ב)(1א) — נקודות הילד נזקפות ` +
                `כנגד הכנסת האם, לא כנגד הכנסת האב)`,
              // No black box: this 0 must reach the worksheet so the
              // reviewer sees WHY (il-0.7.1, reviewer nit).
              surfaceWhenZero: true,
            },
          ];
        }
      }
      const twelfths = childPointTwelfths(age, 'other');
      const claimant =
        regime === 'marriedOtherSpouse'
          ? '§66(ג)(5) — אב'
          : '§40(ב)(1א) — אב במשפחה חד-הורית';
      return [
        {
          reason: 'child',
          twelfths,
          label: `${childDescriptor(age)} (${claimant})${suffix}`,
        },
      ];
    }

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

/**
 * §40(ב)(2) multiplicity gate. The verbatim statute grants the non-entitled
 * parent "נקודת זיכוי אחת או חלק ממנה" over "כלכלת ילדיהם" — the children
 * COLLECTIVELY, a singular point — while the plan encoded the fraction per
 * child. That per-child reading is disputed and not owner-verified (reviewer
 * finding; plan checklist item "§40(ב)(2) fraction multiplicity"), so more
 * than one child row under separatedNonEntitled fails loud: a SINGLE row
 * with the combined share expresses the singular statutory reading exactly,
 * and additionalCreditPoints covers anything beyond it.
 * source: docs/superpowers/research/2026-07-13-credit-points-allocation-addendum.md §2.
 */
export function assertSeparatedNonEntitledMultiplicity(
  childCount: number,
  regime: ParentRegime,
): void {
  if (regime === 'separatedNonEntitled' && childCount > 1) {
    throw new InvalidTaxInputError(
      'taxpayer.children',
      `the §40(ב)(2) fraction's per-child multiplicity is not yet owner-verified ` +
        `(the statute reads "נקודת זיכוי אחת או חלק ממנה" over the children ` +
        `collectively) — supply one child row with the combined share, or use ` +
        `additionalCreditPoints`,
    );
  }
}

/**
 * Flat (per-filer, not per-child) additions the declared context grants,
 * as labelled rows in twelfths. Pure; fail-loud on an unknown regime. The
 * §66(ג)(3) childAllowance row is deliberately returned at 0 twelfths with
 * its TODO label — an owner-verify placeholder the worksheet must surface,
 * not a "nothing applies" zero.
 */
export function flatAdditionTwelfths(context: ParentContextInput): FlatAdditionRow[] {
  assertKnownRegime(context.regime);
  const rows: FlatAdditionRow[] = [];

  if (context.regime === 'singleParent') {
    // source: §40(ב)(1ב) — "במשפחה חד-הורית שבה ילד להורה אחד ואותו הורה
    // זכאי לנקודות זיכוי לפי פסקה (1), תובא בחשבון כנגד הכנסתו מיגיעה
    // אישית של אותו הורה, נקודת זיכוי אחת נוספת" (the paragraph's second
    // clause — the stacked (1א) column — is per-child and lives in
    // allocateChildTwelfths).
    rows.push({
      reason: 'singleParentBonus',
      twelfths: 12,
      label: 'נקודת זיכוי נוספת — משפחה חד-הורית (§40(ב)(1ב))',
    });
  }
  if (context.regime === 'separatedEntitled') {
    // source: allocation addendum §2 — §40(ב)(2): "הורים החיים בנפרד יקבל
    // ההורה הזכאי לנקודת זיכוי לפי פסקה (1), נקודת זיכוי אחת נוספת".
    rows.push({
      reason: 'separatedBonus',
      twelfths: 12,
      label: 'נקודת זיכוי נוספת — הורים החיים בנפרד (§40(ב)(2))',
    });
  }
  if (context.divorcedPaysMaintenanceRemarried === true) {
    // source: allocation addendum §2 — §40א: "בחישוב המס של גרוש שהוא או בן
    // זוגו משלם מזונות לבן זוגו לשעבר, והוא נשוי לבן-זוג אחר, תובא בחשבון
    // נקודת זיכוי אחת". Stacks on whatever regime bonus applies.
    rows.push({
      reason: 'section40aBonus',
      twelfths: 12,
      label: 'נקודת זיכוי — גרוש המשלם מזונות והנשוי לבן זוג אחר (§40א)',
    });
  }
  if (context.receivesChildAllowance === true) {
    // source: sah3184 addendum §3 — §40(א) (תיקון 99) + §33א: the קצבה
    // points are NII-paid inside קצבת הילדים; verified statutory 0 in the
    // tax computation (see CHILD_ALLOWANCE_TWELFTHS).
    rows.push({
      reason: 'childAllowance',
      twelfths: CHILD_ALLOWANCE_TWELFTHS,
      label:
        'נקודות הקצבה לבן הזוג הרשום (§66(ג)(3)) משולמות בידי המוסד לביטוח ' +
        'לאומי במסגרת קצבת הילדים — אינן נזקפות בחישוב המס',
    });
  }
  return rows;
}
