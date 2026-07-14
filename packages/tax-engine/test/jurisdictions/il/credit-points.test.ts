import { describe, expect, it } from 'vitest';
import { InvalidTaxInputError } from '../../../src/core/errors';
import { getIlYearData } from '../../../src/jurisdictions/il';
import { computeCreditPoints } from '../../../src/jurisdictions/il/modules/credit-points';

const y2024 = getIlYearData(2024);
const y2025 = getIlYearData(2025);

describe('computeCreditPoints', () => {
  it('gives a resident man 2.25 points = 6,534 ₪', () => {
    const res = computeCreditPoints(
      { isIsraeliResident: true, gender: 'male' },
      y2025,
    );
    expect(res.points).toBe(2.25);
    expect(res.valueAgorot).toBe(653_400);
    expect(res.breakdown).toEqual([{ reason: 'resident', points: 2.25 }]);
  });

  it('gives a resident woman an extra half point (2.75 = 7,986 ₪)', () => {
    const res = computeCreditPoints(
      { isIsraeliResident: true, gender: 'female' },
      y2025,
    );
    expect(res.points).toBe(2.75);
    expect(res.valueAgorot).toBe(798_600);
    expect(res.breakdown).toEqual([
      { reason: 'resident', points: 2.25 },
      { reason: 'female', points: 0.5 },
    ]);
  });

  it('adds reviewer-entered additional points', () => {
    const res = computeCreditPoints(
      { isIsraeliResident: true, gender: 'male', additionalCreditPoints: 1.5 },
      y2025,
    );
    expect(res.points).toBe(3.75);
    expect(res.valueAgorot).toBe(1_089_000); // 3.75 × 2,904 ₪
    expect(res.breakdown).toContainEqual({ reason: 'additional', points: 1.5 });
  });

  it('gives a non-resident no resident/gender points', () => {
    const res = computeCreditPoints(
      { isIsraeliResident: false, gender: 'female' },
      y2025,
    );
    expect(res.points).toBe(0);
    expect(res.valueAgorot).toBe(0);
    expect(res.breakdown).toEqual([]);
  });

  it('rejects negative or non-quarter additional points loudly', () => {
    expect(() =>
      computeCreditPoints(
        { isIsraeliResident: true, gender: 'male', additionalCreditPoints: -1 },
        y2025,
      ),
    ).toThrow(InvalidTaxInputError);
    expect(() =>
      computeCreditPoints(
        { isIsraeliResident: true, gender: 'male', additionalCreditPoints: 0.3 },
        y2025,
      ),
    ).toThrow(InvalidTaxInputError);
  });

  // Structured children/oleh inputs (report §1.1 / §3.1 via the rules module).

  it('adds a child age 2 (4.5 pts) to a resident man → 6.75 points', () => {
    const res = computeCreditPoints(
      {
        isIsraeliResident: true,
        gender: 'male',
        children: [{ ageInTaxYear: 2, role: 'custodial' }],
      },
      y2025,
    );
    expect(res.points).toBe(6.75);
    // 81 twelfths × 290,400/12 agorot
    expect(res.valueAgorot).toBe(1_960_200);
    expect(res.breakdown).toContainEqual({
      reason: 'child',
      points: 4.5,
      label: 'ילד בן 2 (הורה משמורן)',
    });
  });

  it('labels the other-parent role and a birth-year child', () => {
    const res = computeCreditPoints(
      {
        isIsraeliResident: true,
        gender: 'male',
        children: [
          { ageInTaxYear: 3, role: 'other' },
          { ageInTaxYear: 0, role: 'custodial' },
        ],
      },
      y2025,
    );
    expect(res.points).toBe(2.25 + 3.5 + 2.5);
    expect(res.breakdown).toContainEqual({
      reason: 'child',
      points: 3.5,
      label: 'ילד בן 3 (הורה אחר)',
    });
    expect(res.breakdown).toContainEqual({
      reason: 'child',
      points: 2.5,
      label: 'ילד שנולד בשנת המס (הורה משמורן)',
    });
  });

  it('an age-18 child of the other parent (0 twelfths) adds no breakdown row', () => {
    // Same no-zero-rows convention as the oleh and degree branches: the one
    // legitimate 0 in the child table must not surface as a 0-point line.
    const res = computeCreditPoints(
      {
        isIsraeliResident: true,
        gender: 'male',
        children: [{ ageInTaxYear: 18, role: 'other' }],
      },
      y2025,
    );
    expect(res.points).toBe(2.25);
    expect(res.breakdown.filter((r) => r.reason === 'child')).toEqual([]);
  });

  it('a child in the not-yet-verified 6-17 band propagates the loud throw', () => {
    // Delta from the plan: 6-17 ships DISABLED (secondary sources only) —
    // a resident woman with a child age 6 role "other" throws instead of
    // yielding 3.75 points.
    expect(() =>
      computeCreditPoints(
        {
          isIsraeliResident: true,
          gender: 'female',
          children: [{ ageInTaxYear: 6, role: 'other' }],
        },
        y2025,
      ),
    ).toThrow(/not yet owner-verified/);
  });

  it('a child age 19 propagates the loud out-of-range throw', () => {
    expect(() =>
      computeCreditPoints(
        {
          isIsraeliResident: true,
          gender: 'male',
          children: [{ ageInTaxYear: 19, role: 'custodial' }],
        },
        y2025,
      ),
    ).toThrow(InvalidTaxInputError);
  });

  it('adds a from2022 oleh full first year (1/12×12 = 1 pt) → 3.25 points', () => {
    const res = computeCreditPoints(
      {
        isIsraeliResident: true,
        gender: 'male',
        aliyah: { aliyahYear: 2025, aliyahMonth: 1, scheduleVariant: 'from2022' },
      },
      y2025,
    );
    expect(res.points).toBe(3.25);
    expect(res.valueAgorot).toBe(943_800); // 39 twelfths × 24,200
    expect(res.breakdown).toContainEqual({
      reason: 'oleh',
      points: 1,
      label: 'עולה חדש — 12 חודשים בשנת המס',
    });
  });

  it('combined resident + child + mid-year oleh + additional 0.25 stays twelfth-integer', () => {
    // 27 (resident) + 54 (child age 2) + 8 (from2022 aliyah 2025-05: schedule
    // months 1-8 at 1/12) + 3 (additional 0.25) = 92 twelfths.
    const res = computeCreditPoints(
      {
        isIsraeliResident: true,
        gender: 'male',
        additionalCreditPoints: 0.25,
        children: [{ ageInTaxYear: 2, role: 'custodial' }],
        aliyah: { aliyahYear: 2025, aliyahMonth: 5, scheduleVariant: 'from2022' },
      },
      y2025,
    );
    expect(res.points).toBe(92 / 12);
    expect(res.valueAgorot).toBe(2_226_400); // 92 × 290,400 / 12 exactly
    const reasons = res.breakdown.map((row) => row.reason);
    expect(reasons).toContain('child');
    expect(reasons).toContain('oleh');
    expect(res.breakdown).toContainEqual({
      reason: 'oleh',
      points: 8 / 12,
      label: 'עולה חדש — 8 חודשים בשנת המס',
    });
  });

  // Structured degree inputs (§40ג-§40ה via rules/degree-credit-points,
  // addendum docs/superpowers/research/2026-07-13-degrees-40g-addendum.md).

  it('adds a bachelor in its first window year (2024) to a resident man → 3.25 points', () => {
    const res = computeCreditPoints(
      {
        isIsraeliResident: true,
        gender: 'male',
        degrees: [{ track: 'bachelor', completionYear: 2023, studyYears: 3 }],
      },
      y2024,
    );
    expect(res.points).toBe(3.25);
    expect(res.valueAgorot).toBe(943_800); // 39 twelfths × 24,200
    expect(res.breakdown).toContainEqual({
      reason: 'degree',
      points: 1,
      label: 'תואר ראשון — נקודת זיכוי, שנה 1 מתוך 3 (סיום לימודים 2023)',
    });
  });

  it('a woman with an elective-cohort bachelor + a 2023+ master gets two degree rows → 4.25 points', () => {
    // 2.75 (resident woman) + 1 (BA 2014-2022, elected 2024) + 0.5 (MA 2023,
    // window year 1) = 4.25 — BA + MA stack (one benefit per LEVEL, §7(ב)).
    const res = computeCreditPoints(
      {
        isIsraeliResident: true,
        gender: 'female',
        degrees: [
          { track: 'bachelor', completionYear: 2022, studyYears: 3, electedClaimYear: 2024 },
          { track: 'master', completionYear: 2023, studyYears: 2 },
        ],
      },
      y2024,
    );
    expect(res.points).toBe(4.25);
    const degreeRows = res.breakdown.filter((row) => row.reason === 'degree');
    expect(degreeRows).toEqual([
      {
        reason: 'degree',
        points: 1,
        label: 'תואר ראשון — נקודת זיכוי (שנת מס נבחרת 2024)',
      },
      {
        reason: 'degree',
        points: 0.5,
        label: 'תואר שני — חצי נקודת זיכוי, שנה 1 מתוך 2 (סיום לימודים 2023)',
      },
    ]);
  });

  it('an out-of-window degree adds no row and leaves points unchanged', () => {
    // History entry: the window was 2020 — nothing in 2025, no zero rows.
    const res = computeCreditPoints(
      {
        isIsraeliResident: true,
        gender: 'male',
        degrees: [
          { track: 'bachelor', completionYear: 2019, studyYears: 3, electedClaimYear: 2020 },
        ],
      },
      y2025,
    );
    expect(res.points).toBe(2.25);
    expect(res.breakdown).toEqual([{ reason: 'resident', points: 2.25 }]);
  });

  it('vocational + bachelor in the array propagates the loud §7(ג) throw', () => {
    expect(() =>
      computeCreditPoints(
        {
          isIsraeliResident: true,
          gender: 'male',
          degrees: [
            { track: 'vocational', completionYear: 2023, studyYears: 2 },
            { track: 'bachelor', completionYear: 2023, studyYears: 3 },
          ],
        },
        y2025,
      ),
    ).toThrow(InvalidTaxInputError);
  });

  it('degrees combine with children and additional points to an exact twelfth-integer value', () => {
    // 27 (resident) + 54 (child age 2) + 12 (BA 2023, window year 2 of 3 in
    // 2025) + 3 (additional 0.25) = 96 twelfths = 8 points exactly.
    const res = computeCreditPoints(
      {
        isIsraeliResident: true,
        gender: 'male',
        additionalCreditPoints: 0.25,
        children: [{ ageInTaxYear: 2, role: 'custodial' }],
        degrees: [{ track: 'bachelor', completionYear: 2023, studyYears: 3 }],
      },
      y2025,
    );
    expect(res.points).toBe(8);
    expect(res.valueAgorot).toBe(2_323_200); // 96 × 290,400 / 12 exactly
    expect(res.breakdown).toContainEqual({
      reason: 'degree',
      points: 1,
      label: 'תואר ראשון — נקודת זיכוי, שנה 2 מתוך 3 (סיום לימודים 2023)',
    });
  });

  it('an oleh year with zero qualifying months adds no row', () => {
    const res = computeCreditPoints(
      {
        isIsraeliResident: true,
        gender: 'male',
        // pre2022 aliyah Jan 2020 — the 42-month window ended before 2025.
        aliyah: { aliyahYear: 2020, aliyahMonth: 1, scheduleVariant: 'pre2022' },
      },
      y2025,
    );
    expect(res.points).toBe(2.25);
    expect(res.breakdown).toEqual([{ reason: 'resident', points: 2.25 }]);
  });
});
