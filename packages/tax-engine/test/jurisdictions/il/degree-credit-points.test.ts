import { describe, expect, it } from 'vitest';
import { InvalidTaxInputError } from '../../../src/core/errors';
import {
  assertDegreeExclusivity,
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

describe('degreeTwelfthsForTaxYear — 2014-2022 elective year (addendum §1/§2/§3, "לפי בחירתו")', () => {
  it('bachelor 2022 elected 2024 → 12 twelfths in 2024 only', () => {
    const deg = bachelor({ completionYear: 2022, electedClaimYear: 2024 });
    expect(degreeTwelfthsForTaxYear(deg, 2024).twelfths).toBe(12);
    expect(degreeTwelfthsForTaxYear(deg, 2023).twelfths).toBe(0);
    expect(degreeTwelfthsForTaxYear(deg, 2025).twelfths).toBe(0);
  });

  it('master 2020 elected 2021 → 6 twelfths in 2021, nothing in 2024 (history entry, 0 not throw)', () => {
    const deg: DegreeInput = {
      track: 'master',
      completionYear: 2020,
      studyYears: 2,
      electedClaimYear: 2021,
    };
    expect(degreeTwelfthsForTaxYear(deg, 2021).twelfths).toBe(6);
    // A degree whose window has passed must NOT force the reviewer to strip
    // the entry from the profile — it simply contributes nothing in 2024.
    expect(degreeTwelfthsForTaxYear(deg, 2024).twelfths).toBe(0);
  });

  it('labels the elected benefit year in Hebrew', () => {
    expect(
      degreeTwelfthsForTaxYear(
        bachelor({ completionYear: 2022, electedClaimYear: 2024 }),
        2024,
      ).label,
    ).toBe('תואר ראשון — נקודת זיכוי (שנת מס נבחרת 2024)');
  });

  it('throws when electedClaimYear is absent for a 2014-2022 completion (the election is required)', () => {
    expect(() =>
      degreeTwelfthsForTaxYear(bachelor({ completionYear: 2022 }), 2024),
    ).toThrow(InvalidTaxInputError);
  });

  it('throws when electedClaimYear is outside the two candidate years', () => {
    // Candidates for a 2020 completion are 2021 and 2022 only.
    expect(() =>
      degreeTwelfthsForTaxYear(
        bachelor({ completionYear: 2020, electedClaimYear: 2023 }),
        2023,
      ),
    ).toThrow(InvalidTaxInputError);
  });

  it('throws when electedClaimYear is supplied for a 2023+ completion (fixed regime — no election)', () => {
    expect(() =>
      degreeTwelfthsForTaxYear(bachelor({ electedClaimYear: 2024 }), 2024),
    ).toThrow(InvalidTaxInputError);
  });
});

describe('degreeTwelfthsForTaxYear — internship (התמחות) deferral, Form 119 §6 (addendum §4)', () => {
  it('2023+: shifts the window start to the year after the internship ended, length unchanged', () => {
    // Bachelor completed 2023, internship 2024-2024 → window 2025-2027
    // (still 3 years — the deferral never ADDS years).
    const deg = bachelor({ internship: { startYear: 2024, endYear: 2024 } });
    expect(degreeTwelfthsForTaxYear(deg, 2024).twelfths).toBe(0);
    expect(degreeTwelfthsForTaxYear(deg, 2025).twelfths).toBe(12);
    expect(degreeTwelfthsForTaxYear(deg, 2027).twelfths).toBe(12);
    expect(degreeTwelfthsForTaxYear(deg, 2028).twelfths).toBe(0);
  });

  it('labels the deferral in the worksheet row', () => {
    expect(
      degreeTwelfthsForTaxYear(
        bachelor({ internship: { startYear: 2024, endYear: 2024 } }),
        2025,
      ).label,
    ).toBe(
      'תואר ראשון — נקודת זיכוי, שנה 1 מתוך 3 (סיום לימודים 2023) (נדחה לאחר התמחות שהסתיימה ב-2024)',
    );
  });

  it('2014-2022 + internship: elective candidates run from the internship end', () => {
    // Bachelor completed 2021, internship 2022-2023 → candidates {2024, 2025}
    // (owner-verify checklist item covers this interaction).
    const deg = bachelor({
      completionYear: 2021,
      internship: { startYear: 2022, endYear: 2023 },
      electedClaimYear: 2024,
    });
    expect(degreeTwelfthsForTaxYear(deg, 2024).twelfths).toBe(12);
    expect(degreeTwelfthsForTaxYear(deg, 2023).twelfths).toBe(0);
  });

  it('throws for an internship on a vocational certificate (§6 covers academic degrees only)', () => {
    expect(() =>
      degreeTwelfthsForTaxYear(
        {
          track: 'vocational',
          completionYear: 2023,
          studyYears: 2,
          internship: { startYear: 2024, endYear: 2024 },
        },
        2025,
      ),
    ).toThrow(InvalidTaxInputError);
  });

  it('throws for an internship that ended before 2012 (§6 applies to internships ending 2012+)', () => {
    expect(() =>
      degreeTwelfthsForTaxYear(
        bachelor({ internship: { startYear: 2010, endYear: 2011 } }),
        2024,
      ),
    ).toThrow(InvalidTaxInputError);
  });

  it('throws when the internship began later than the year after completion ("תחל לא יאוחר משנת המס שלאחר")', () => {
    expect(() =>
      degreeTwelfthsForTaxYear(
        bachelor({ internship: { startYear: 2025, endYear: 2026 } }),
        2027,
      ),
    ).toThrow(InvalidTaxInputError);
  });

  it('throws when the internship ends before it starts', () => {
    expect(() =>
      degreeTwelfthsForTaxYear(
        bachelor({ internship: { startYear: 2024, endYear: 2023 } }),
        2024,
      ),
    ).toThrow(InvalidTaxInputError);
  });

  it('throws when the internship ends before the degree completion (a deferral cannot move the start earlier)', () => {
    expect(() =>
      degreeTwelfthsForTaxYear(
        bachelor({ internship: { startYear: 2015, endYear: 2016 } }),
        2024,
      ),
    ).toThrow(InvalidTaxInputError);
  });

  it('throws on non-integer internship years (fail-loud, never rounds)', () => {
    expect(() =>
      degreeTwelfthsForTaxYear(
        bachelor({ internship: { startYear: 2024, endYear: 2024.5 } }),
        2025,
      ),
    ).toThrow(InvalidTaxInputError);
  });
});

describe('assertDegreeExclusivity — §7(ב)/§7(ג) (addendum §3 table)', () => {
  const master: DegreeInput = { track: 'master', completionYear: 2023, studyYears: 2 };
  const vocational: DegreeInput = {
    track: 'vocational',
    completionYear: 2023,
    studyYears: 2,
  };

  it('throws on a duplicate track — §7(ב) one benefit per level', () => {
    // Two bachelor's ⇒ still one benefit, per the form's own example.
    expect(() =>
      assertDegreeExclusivity([bachelor(), bachelor({ completionYear: 2024 })]),
    ).toThrow(InvalidTaxInputError);
  });

  it('throws on vocational mixed with bachelor — §7(ג) degree XOR vocational', () => {
    expect(() => assertDegreeExclusivity([vocational, bachelor()])).toThrow(
      InvalidTaxInputError,
    );
  });

  it('throws on vocational mixed with master — §7(ג)', () => {
    expect(() => assertDegreeExclusivity([master, vocational])).toThrow(
      InvalidTaxInputError,
    );
  });

  it('accepts bachelor + master together (one benefit per LEVEL)', () => {
    expect(() => assertDegreeExclusivity([bachelor(), master])).not.toThrow();
  });

  it('accepts a lone vocational certificate and an empty list', () => {
    expect(() => assertDegreeExclusivity([vocational])).not.toThrow();
    expect(() => assertDegreeExclusivity([])).not.toThrow();
  });
});
