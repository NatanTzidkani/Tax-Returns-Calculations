import { InvalidTaxInputError } from '../../../core/errors';

// ---------------------------------------------------------------------------
// §40ג–§40ה degree / vocational credit points (נקודות זיכוי בגין תואר אקדמי
// או תעודת מקצוע), shared across tax years.
//
// Track rates, year caps, and cohort boundaries are STATUTORY point counts —
// not §120ב-indexed money — identical for 2024 and 2025, so they live here in
// the jurisdiction-level rules directory beside credit-points-tables.ts, NOT
// in years/*.ts.
//
// Source of truth for every count and window rule:
// docs/superpowers/research/2026-07-13-degrees-40g-addendum.md — the Form 119
// דברי הסבר (רשות המסים, updated 11.2024, tax years 2024 & 2025) read line by
// line. Do not copy rules from anywhere else. Sub-letter caveat carried from
// the addendum header: Form 119 groups all tracks under "סעיפים 40ג עד 40ה"
// without printing which sub-letter governs which track, so comments here
// cite the ADDENDUM SECTIONS, not a bare ordinance sub-letter (owner-verify
// item; substance unaffected).
//
// The engine derives the CLAIM WINDOW only — it never derives eligibility.
// The reviewer attests the facts (recognized degree §7(ה), vocational
// conditions §7(ו), proof of completion §7(א), internship-required profession
// §6) before supplying the input.
//
// All rates are integer TWELFTHS of a point (1 pt = 12, 0.5 pt = 6) so the
// credit-point accumulator stays float-free.
// ---------------------------------------------------------------------------

export type DegreeTrack = 'bachelor' | 'master' | 'vocational';

/** Reviewer-supplied description of one degree/certificate (education
 *  history — legitimate input for ANY tax year; out-of-window years simply
 *  contribute 0, never throw). Mirrors `TaxpayerInput['degrees'][number]`. */
export interface DegreeInput {
  track: DegreeTrack;
  /** Tax year in which the studies for this degree/certificate ended. ≥ 2014
   *  (earlier cohorts are out of scope → loud throw). */
  completionYear: number;
  /** Academic study years (integer ≥ 1; window length = min(studyYears, cap)). */
  studyYears: number;
  /** 2014-2022 cohort ONLY: the single elected benefit year. Required for
   *  that cohort; forbidden (loud throw) for 2023+. */
  electedClaimYear?: number;
  /** Form 119 §6 internship deferral (bachelor/master only). Presence = the
   *  taxpayer ELECTS the internship-based start. */
  internship?: { startYear: number; endYear: number };
}

/**
 * Points per benefit year (in twelfths) and 2023+ window-length cap per
 * track. The 2023+ window is FIXED consecutive tax years starting the year
 * after studies ended ("החל משנת המס שלאחר"), running min(studyYears, capYears)
 * years; the 2014-2022 cohort instead gets the same per-year rate in a single
 * elective year.
 */
export const DEGREE_TRACKS: Readonly<
  Record<DegreeTrack, { readonly twelfthsPerYear: number; readonly capYears: number }>
> = Object.freeze({
  // source: docs/superpowers/research/2026-07-13-degrees-40g-addendum.md §1
  // (form119-2024 §1) — bachelor: 1 point/yr, min(study years, 3) tax years.
  bachelor: Object.freeze({ twelfthsPerYear: 12, capYears: 3 }),
  // source: docs/superpowers/research/2026-07-13-degrees-40g-addendum.md §2
  // (form119-2024 §2) — master: 0.5 point/yr, min(study years, 2) tax years
  // (the addendum's correction: NOT an unconditional 2 years).
  master: Object.freeze({ twelfthsPerYear: 6, capYears: 2 }),
  // source: docs/superpowers/research/2026-07-13-degrees-40g-addendum.md §3
  // (form119-2024 §5) — vocational certificate: 1 point/yr,
  // min(study years, 3) tax years.
  vocational: Object.freeze({ twelfthsPerYear: 12, capYears: 3 }),
});

/** Hebrew worksheet phrases per track (official terminology). */
const TRACK_LABELS: Readonly<Record<DegreeTrack, { name: string; points: string }>> =
  Object.freeze({
    bachelor: Object.freeze({ name: 'תואר ראשון', points: 'נקודת זיכוי' }),
    master: Object.freeze({ name: 'תואר שני', points: 'חצי נקודת זיכוי' }),
    vocational: Object.freeze({ name: 'תעודת מקצוע', points: 'נקודת זיכוי' }),
  });

/**
 * Twelfths of a point this degree/certificate contributes in `taxYear`, plus
 * the Hebrew worksheet label. A degree whose claim window does not include
 * `taxYear` yields `{ twelfths: 0 }` (education history is valid input for
 * any tax year); input that is contradictory in EVERY year throws
 * `InvalidTaxInputError` (fail-loud).
 */
export function degreeTwelfthsForTaxYear(
  degree: DegreeInput,
  taxYear: number,
): { twelfths: number; label: string } {
  const { track, completionYear, studyYears } = degree;

  const trackRule = DEGREE_TRACKS[track];
  if (trackRule === undefined) {
    throw new InvalidTaxInputError(
      'taxpayer.degrees[].track',
      `unknown track "${track}" (expected "bachelor", "master" or "vocational"; ` +
        `medicine/direct-track PhD and other tracks are not modelled — enter ` +
        `their verified points via additionalCreditPoints)`,
    );
  }
  if (!Number.isSafeInteger(studyYears) || studyYears < 1 || studyYears > 10) {
    throw new InvalidTaxInputError(
      'taxpayer.degrees[].studyYears',
      `must be an integer count of academic study years between 1 and 10, got ${studyYears}`,
    );
  }
  if (!Number.isInteger(completionYear) || completionYear < 2014) {
    throw new InvalidTaxInputError(
      'taxpayer.degrees[].completionYear',
      `must be an integer tax year ≥ 2014 (pre-2014 completion regimes are not ` +
        `modelled — enter verified points via additionalCreditPoints), got ${completionYear}`,
    );
  }

  const { name, points } = TRACK_LABELS[track];

  if (completionYear >= 2023) {
    // source: docs/superpowers/research/2026-07-13-degrees-40g-addendum.md
    // §1/§2/§3 (form119-2024 §§1,2,5) — 2023+ regime: FIXED consecutive
    // window "החל משנת המס שלאחר שנת המס שבה הסתיימו לימודיו", running
    // min(studyYears, capYears) tax years. No year election exists in this
    // regime.
    const windowStart = completionYear + 1;
    const windowLength = Math.min(studyYears, trackRule.capYears);
    const windowEnd = windowStart + windowLength - 1;
    if (taxYear < windowStart || taxYear > windowEnd) {
      return { twelfths: 0, label: '' };
    }
    const yearIndex = taxYear - windowStart + 1;
    return {
      twelfths: trackRule.twelfthsPerYear,
      label: `${name} — ${points}, שנה ${yearIndex} מתוך ${windowLength} (סיום לימודים ${completionYear})`,
    };
  }

  // 2014-2022 elective cohort — implemented in the next increment step.
  throw new InvalidTaxInputError(
    'taxpayer.degrees[].completionYear',
    `the 2014-2022 elective cohort is not implemented yet, got ${completionYear}`,
  );
}
