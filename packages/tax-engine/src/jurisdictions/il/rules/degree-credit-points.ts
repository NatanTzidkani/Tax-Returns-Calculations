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
 * Fail-loud exclusivity check over the whole `degrees` array — call once
 * before deriving any window. Contradictory combinations must never silently
 * become a plausible number:
 * - §7(ב) one benefit per level: at most one entry per track (two bachelor's
 *   ⇒ still one benefit, per the form's own example).
 * - §7(ג) degree XOR vocational: the taxpayer must CHOOSE between the degree
 *   benefit and the vocational benefit; the engine does NOT pick the cheaper
 *   option for them (that election is the reviewer's/taxpayer's).
 * source: docs/superpowers/research/2026-07-13-degrees-40g-addendum.md §3
 * table (form119-2024 §7(ב)/§7(ג)).
 */
export function assertDegreeExclusivity(degrees: readonly DegreeInput[]): void {
  const seen = new Set<DegreeTrack>();
  for (const { track } of degrees) {
    if (seen.has(track)) {
      throw new InvalidTaxInputError(
        'taxpayer.degrees',
        `duplicate track "${track}" — §7(ב) grants one benefit per level ` +
          `(a second ${track} confers nothing; remove the duplicate entry)`,
      );
    }
    seen.add(track);
  }
  if (seen.has('vocational') && (seen.has('bachelor') || seen.has('master'))) {
    throw new InvalidTaxInputError(
      'taxpayer.degrees',
      `"vocational" cannot be combined with "bachelor"/"master" — §7(ג) ` +
        `requires choosing between the degree benefit and the vocational ` +
        `benefit; the taxpayer must elect one (the engine never chooses)`,
    );
  }
}

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
  const { track, completionYear, studyYears, electedClaimYear, internship } = degree;

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

  if (internship !== undefined) {
    // source: docs/superpowers/research/2026-07-13-degrees-40g-addendum.md §4
    // (form119-2024 §6) — the internship deferral exists for a BACHELOR'S or
    // MASTER'S in a profession requiring an internship, where the internship
    // ended in 2012 or later and began no later than the tax year after
    // degree completion. It shifts the benefit start only; it never adds
    // years and can never move the start earlier than the degree-based one.
    if (track === 'vocational') {
      throw new InvalidTaxInputError(
        'taxpayer.degrees[].internship',
        `not applicable to a vocational certificate — Form 119 §6 covers ` +
          `academic bachelor's/master's degrees only (addendum §4)`,
      );
    }
    if (!Number.isInteger(internship.startYear) || !Number.isInteger(internship.endYear)) {
      throw new InvalidTaxInputError(
        'taxpayer.degrees[].internship',
        `startYear and endYear must be integer tax years, got ` +
          `${internship.startYear} / ${internship.endYear}`,
      );
    }
    if (internship.endYear < 2012) {
      throw new InvalidTaxInputError(
        'taxpayer.degrees[].internship.endYear',
        `Form 119 §6 applies to internships ending in 2012 or later ` +
          `("סיים התמחות בשנת 2012 ואילך", addendum §4), got ${internship.endYear}`,
      );
    }
    if (internship.startYear > completionYear + 1) {
      throw new InvalidTaxInputError(
        'taxpayer.degrees[].internship.startYear',
        `the internship must begin no later than the tax year after degree ` +
          `completion ("תחל לא יאוחר משנת המס שלאחר", addendum §4) — ` +
          `at latest ${completionYear + 1}, got ${internship.startYear}`,
      );
    }
    if (internship.endYear < internship.startYear) {
      throw new InvalidTaxInputError(
        'taxpayer.degrees[].internship.endYear',
        `must not precede startYear, got ${internship.endYear} < ${internship.startYear}`,
      );
    }
    if (internship.endYear < completionYear) {
      throw new InvalidTaxInputError(
        'taxpayer.degrees[].internship.endYear',
        `must not precede the degree completion year — a deferral cannot move ` +
          `the benefit start earlier, got ${internship.endYear} < ${completionYear}`,
      );
    }
  }

  // Presence of `internship` = the taxpayer ELECTS the internship-based
  // start: the window (2023+) / candidate years (2014-2022) run from the
  // year after the internship ended instead of the year after completion.
  // source: addendum §4 (form119-2024 §6).
  const base = internship?.endYear ?? completionYear;
  const deferralSuffix =
    internship === undefined ? '' : ` (נדחה לאחר התמחות שהסתיימה ב-${internship.endYear})`;
  const { name, points } = TRACK_LABELS[track];

  if (completionYear >= 2023) {
    // source: docs/superpowers/research/2026-07-13-degrees-40g-addendum.md
    // §1/§2/§3 (form119-2024 §§1,2,5) — 2023+ regime: FIXED consecutive
    // window "החל משנת המס שלאחר שנת המס שבה הסתיימו לימודיו", running
    // min(studyYears, capYears) tax years. No year election exists in this
    // regime, so a supplied electedClaimYear is contradictory input.
    if (electedClaimYear !== undefined) {
      throw new InvalidTaxInputError(
        'taxpayer.degrees[].electedClaimYear',
        `must not be supplied for a 2023+ completion — the 2023+ claim window ` +
          `is fixed, the year election belongs to the 2014-2022 cohort only ` +
          `(addendum §6-verdict), got ${electedClaimYear}`,
      );
    }
    const windowStart = base + 1;
    const windowLength = Math.min(studyYears, trackRule.capYears);
    const windowEnd = windowStart + windowLength - 1;
    if (taxYear < windowStart || taxYear > windowEnd) {
      return { twelfths: 0, label: '' };
    }
    const yearIndex = taxYear - windowStart + 1;
    return {
      twelfths: trackRule.twelfthsPerYear,
      label:
        `${name} — ${points}, שנה ${yearIndex} מתוך ${windowLength} ` +
        `(סיום לימודים ${completionYear})${deferralSuffix}`,
    };
  }

  // source: docs/superpowers/research/2026-07-13-degrees-40g-addendum.md
  // §1/§2/§3 (form119-2024 §§1,2,5) — 2014-2022 cohort: a SINGLE benefit
  // year, "בשנת המס שלאחר שנת סיום התואר או בשנת המס שלאחריה, לפי בחירתו".
  // The election is the taxpayer's — the engine never picks a year for them.
  if (electedClaimYear === undefined) {
    throw new InvalidTaxInputError(
      'taxpayer.degrees[].electedClaimYear',
      `required for a 2014-2022 completion — the taxpayer must elect the ` +
        `single benefit year ("לפי בחירתו", addendum §1/§2/§3)`,
    );
  }
  const candidates = [base + 1, base + 2];
  if (!candidates.includes(electedClaimYear)) {
    throw new InvalidTaxInputError(
      'taxpayer.degrees[].electedClaimYear',
      `must be one of the two candidate years ${candidates.join(' / ')} ` +
        `(the tax year after completion/internship or the following year), ` +
        `got ${electedClaimYear}`,
    );
  }
  if (taxYear !== electedClaimYear) {
    return { twelfths: 0, label: '' };
  }
  return {
    twelfths: trackRule.twelfthsPerYear,
    label: `${name} — ${points} (שנת מס נבחרת ${electedClaimYear})${deferralSuffix}`,
  };
}
