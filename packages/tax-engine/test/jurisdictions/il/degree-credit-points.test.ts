import { describe, expect, it } from 'vitest';
import { InvalidTaxInputError } from '../../../src/core/errors';
import {
  degreeTwelfthsForTaxYear,
  type DegreeInput,
} from '../../../src/jurisdictions/il/rules/degree-credit-points';

// Every point count and window rule under test comes from the primary-source
// degrees addendum
// docs/superpowers/research/2026-07-13-degrees-40g-addendum.md (Form 119
// דברי הסבר, updated 11.2024) — never from memory. 2023+ completions get a
// FIXED consecutive window of min(studyYears, cap) tax years starting the
// year after completion; the elective year belongs to the 2014-2022 cohort
// only (addendum §6-verdict).

const bachelor = (over: Partial<DegreeInput> = {}): DegreeInput => ({
  track: 'bachelor',
  completionYear: 2023,
  studyYears: 3,
  ...over,
});

describe('degreeTwelfthsForTaxYear — 2023+ fixed window (addendum §1/§2/§3)', () => {
  it('bachelor 2023, 3 study years → 12 twelfths in each of 2024-2026, 0 outside', () => {
    for (const taxYear of [2024, 2025, 2026]) {
      expect(degreeTwelfthsForTaxYear(bachelor(), taxYear).twelfths).toBe(12);
    }
    // The completion year itself and the year past the window contribute
    // nothing — 0, not an error (education history is legitimate input for
    // any tax year).
    expect(degreeTwelfthsForTaxYear(bachelor(), 2023).twelfths).toBe(0);
    expect(degreeTwelfthsForTaxYear(bachelor(), 2027).twelfths).toBe(0);
  });

  it('bachelor with 4 study years is still capped at 3 tax years (addendum §1)', () => {
    const deg = bachelor({ studyYears: 4 });
    expect(degreeTwelfthsForTaxYear(deg, 2026).twelfths).toBe(12);
    expect(degreeTwelfthsForTaxYear(deg, 2027).twelfths).toBe(0);
  });

  it('master 2023, 2 study years → 6 twelfths in 2024 and 2025 only (addendum §2)', () => {
    const deg: DegreeInput = { track: 'master', completionYear: 2023, studyYears: 2 };
    expect(degreeTwelfthsForTaxYear(deg, 2024).twelfths).toBe(6);
    expect(degreeTwelfthsForTaxYear(deg, 2025).twelfths).toBe(6);
    expect(degreeTwelfthsForTaxYear(deg, 2026).twelfths).toBe(0);
  });

  it("master with 1 study year → one benefit year only (addendum §2's min(studyYears, 2) correction)", () => {
    // Load-bearing: the addendum CORRECTS the earlier draft's flat 2 years —
    // a one-year master's program yields only one year of the half point.
    const deg: DegreeInput = { track: 'master', completionYear: 2023, studyYears: 1 };
    expect(degreeTwelfthsForTaxYear(deg, 2024).twelfths).toBe(6);
    expect(degreeTwelfthsForTaxYear(deg, 2025).twelfths).toBe(0);
  });

  it('vocational 2024, 2 study years → 12 twelfths in 2025 and 2026 (addendum §3)', () => {
    const deg: DegreeInput = { track: 'vocational', completionYear: 2024, studyYears: 2 };
    expect(degreeTwelfthsForTaxYear(deg, 2025).twelfths).toBe(12);
    expect(degreeTwelfthsForTaxYear(deg, 2026).twelfths).toBe(12);
    expect(degreeTwelfthsForTaxYear(deg, 2027).twelfths).toBe(0);
  });

  it('labels the worksheet row in Hebrew with the window position', () => {
    expect(degreeTwelfthsForTaxYear(bachelor(), 2025).label).toBe(
      'תואר ראשון — נקודת זיכוי, שנה 2 מתוך 3 (סיום לימודים 2023)',
    );
    expect(
      degreeTwelfthsForTaxYear(
        { track: 'master', completionYear: 2023, studyYears: 2 },
        2024,
      ).label,
    ).toBe('תואר שני — חצי נקודת זיכוי, שנה 1 מתוך 2 (סיום לימודים 2023)');
    expect(
      degreeTwelfthsForTaxYear(
        { track: 'vocational', completionYear: 2024, studyYears: 2 },
        2026,
      ).label,
    ).toBe('תעודת מקצוע — נקודת זיכוי, שנה 2 מתוך 2 (סיום לימודים 2024)');
  });

  it('throws on an unknown track (medicine/direct-track PhD stay on additionalCreditPoints)', () => {
    expect(() =>
      degreeTwelfthsForTaxYear(bachelor({ track: 'phd' as unknown as 'bachelor' }), 2024),
    ).toThrow(InvalidTaxInputError);
    expect(() =>
      degreeTwelfthsForTaxYear(bachelor({ track: 'phd' as unknown as 'bachelor' }), 2024),
    ).toThrow(/additionalCreditPoints/);
  });

  it.each([0, -1, 2.5, 11])(
    'throws on studyYears %s (integer 1-10 sanity bound)',
    (studyYears) => {
      expect(() => degreeTwelfthsForTaxYear(bachelor({ studyYears }), 2024)).toThrow(
        InvalidTaxInputError,
      );
    },
  );

  it('throws on a pre-2014 completion (older regimes not modelled)', () => {
    expect(() =>
      degreeTwelfthsForTaxYear(bachelor({ completionYear: 2013 }), 2024),
    ).toThrow(InvalidTaxInputError);
    expect(() =>
      degreeTwelfthsForTaxYear(bachelor({ completionYear: 2013 }), 2024),
    ).toThrow(/additionalCreditPoints/);
  });

  it('throws on a non-integer completion year (fail-loud, never rounds)', () => {
    expect(() =>
      degreeTwelfthsForTaxYear(bachelor({ completionYear: 2023.5 }), 2024),
    ).toThrow(InvalidTaxInputError);
  });
});
