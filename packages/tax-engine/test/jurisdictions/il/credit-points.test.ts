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

  // Structured children inputs (counts per report §1.1 via the tables module;
  // allocation per the §66(ג)/§40 regime via rules/child-allocation, citing
  // docs/superpowers/research/2026-07-13-credit-points-allocation-addendum.md).
  // These carry the base-plan cases' NUMERIC expectations, re-expressed
  // through Schedule-A regimes after `role` was superseded by `parentContext`.

  it('adds a child age 2 (4.5 pts) to a resident man → 6.75 points', () => {
    const res = computeCreditPoints(
      {
        isIsraeliResident: true,
        gender: 'male',
        parentContext: { regime: 'marriedRegisteredSpouse' },
        children: [{ ageInTaxYear: 2 }],
      },
      y2025,
    );
    expect(res.points).toBe(6.75);
    // 81 twelfths × 290,400/12 agorot
    expect(res.valueAgorot).toBe(1_960_200);
    expect(res.breakdown).toContainEqual({
      reason: 'child',
      points: 4.5,
      label: 'ילד בן 2 (§66(ג)(4) — אם)',
    });
  });

  it('labels each child with the governing paragraph, incl. a birth-year child', () => {
    const res = computeCreditPoints(
      {
        isIsraeliResident: true,
        gender: 'male',
        parentContext: { regime: 'marriedRegisteredSpouse' },
        children: [{ ageInTaxYear: 3 }, { ageInTaxYear: 0 }],
      },
      y2025,
    );
    expect(res.points).toBe(2.25 + 3.5 + 2.5);
    expect(res.breakdown).toContainEqual({
      reason: 'child',
      points: 3.5,
      label: 'ילד בן 3 (§66(ג)(4) — אם)',
    });
    expect(res.breakdown).toContainEqual({
      reason: 'child',
      points: 2.5,
      label: 'ילד שנולד בשנת המס (§66(ג)(4) — אם)',
    });
  });

  it('a zero-share separated child (0 twelfths) adds no breakdown row', () => {
    // Same no-zero-rows convention as the oleh and degree branches: a
    // legitimate 0 from the allocator must not surface as a 0-point line.
    const res = computeCreditPoints(
      {
        isIsraeliResident: true,
        gender: 'male',
        parentContext: { regime: 'separatedNonEntitled' },
        children: [{ ageInTaxYear: 18, maintenanceShare: 0 }],
      },
      y2025,
    );
    expect(res.points).toBe(2.25);
    expect(res.breakdown).toEqual([{ reason: 'resident', points: 2.25 }]);
  });

  it('two children under separatedNonEntitled propagate the multiplicity gate throw', () => {
    // §40(ב)(2) reads "נקודת זיכוי אחת או חלק ממנה" over the children
    // collectively — per-child multiplicity is a disputed reading, gated
    // loud until the owner rules (reviewer finding; plan checklist).
    expect(() =>
      computeCreditPoints(
        {
          isIsraeliResident: true,
          gender: 'male',
          parentContext: { regime: 'separatedNonEntitled' },
          children: [
            { ageInTaxYear: 3, maintenanceShare: 0.5 },
            { ageInTaxYear: 5, maintenanceShare: 0.5 },
          ],
        },
        y2025,
      ),
    ).toThrow(/not yet owner-verified/);
  });

  it('a Schedule-A child in the 6-17 band yields 2 points (il-0.7.0, sah3184 addendum §2)', () => {
    const res = computeCreditPoints(
      {
        isIsraeliResident: true,
        gender: 'female',
        parentContext: { regime: 'marriedRegisteredSpouse' },
        children: [{ ageInTaxYear: 6 }],
      },
      y2025,
    );
    // 2.25 resident + 0.5 female + 2.0 for the age-6 child.
    expect(res.points).toBe(4.75);
    expect(res.breakdown).toContainEqual({
      reason: 'child',
      points: 2,
      label: 'ילד בן 6 (§66(ג)(4) — אם)',
    });
  });

  it('a child age 19 propagates the loud out-of-range throw', () => {
    expect(() =>
      computeCreditPoints(
        {
          isIsraeliResident: true,
          gender: 'male',
          parentContext: { regime: 'marriedRegisteredSpouse' },
          children: [{ ageInTaxYear: 19 }],
        },
        y2025,
      ),
    ).toThrow(InvalidTaxInputError);
  });

  it('resident woman, marriedRegisteredSpouse, children 2 & 4 → 9.75 labelled points', () => {
    // 33 (resident woman) + 54 (age 2) + 30 (age 4) = 117 twelfths.
    const res = computeCreditPoints(
      {
        isIsraeliResident: true,
        gender: 'female',
        parentContext: { regime: 'marriedRegisteredSpouse' },
        children: [{ ageInTaxYear: 2 }, { ageInTaxYear: 4 }],
      },
      y2025,
    );
    expect(res.points).toBe(9.75);
    expect(res.valueAgorot).toBe(117 * 24_200);
    expect(res.breakdown).toEqual([
      { reason: 'resident', points: 2.25 },
      { reason: 'female', points: 0.5 },
      { reason: 'child', points: 4.5, label: 'ילד בן 2 (§66(ג)(4) — אם)' },
      { reason: 'child', points: 2.5, label: 'ילד בן 4 (§66(ג)(4) — אם)' },
    ]);
  });

  it('singleParent stacks both columns per child and adds the +1 bonus (§40(ב)(1ב))', () => {
    // 27 (resident man) + 54 (age 2, Schedule A) + 54 (stacked (1א) column)
    // + 12 (bonus) = 147 twelfths = 12.25 pts — ita-030124 §3.3: the הורה
    // יחיד claims both parents' tables.
    const res = computeCreditPoints(
      {
        isIsraeliResident: true,
        gender: 'male',
        parentContext: { regime: 'singleParent' },
        children: [{ ageInTaxYear: 2 }],
      },
      y2025,
    );
    expect(res.points).toBe(12.25);
    expect(res.breakdown).toContainEqual({
      reason: 'child',
      points: 4.5,
      label: 'ילד בן 2 — נקודות §40(ב)(1א) להורה יחיד (§40(ב)(1ב))',
    });
    expect(res.breakdown).toContainEqual({
      reason: 'singleParentBonus',
      points: 1,
      label: 'נקודת זיכוי נוספת — משפחה חד-הורית (§40(ב)(1ב))',
    });
  });

  it('separated parents: entitled +1 bonus; non-entitled fractional מזונות rows', () => {
    const entitled = computeCreditPoints(
      {
        isIsraeliResident: true,
        gender: 'female',
        parentContext: { regime: 'separatedEntitled' },
        children: [{ ageInTaxYear: 3 }],
      },
      y2025,
    );
    // 33 + 42 + 12 = 87 twelfths.
    expect(entitled.points).toBe(87 / 12);
    expect(entitled.breakdown).toContainEqual({
      reason: 'separatedBonus',
      points: 1,
      label: 'נקודת זיכוי נוספת — הורים החיים בנפרד (§40(ב)(2))',
    });

    const nonEntitled = computeCreditPoints(
      {
        isIsraeliResident: true,
        gender: 'male',
        parentContext: { regime: 'separatedNonEntitled' },
        children: [{ ageInTaxYear: 8, maintenanceShare: 0.4 }],
      },
      y2025,
    );
    // 27 + round(12 × 0.4) = 5 → 32 twelfths.
    expect(nonEntitled.points).toBe(32 / 12);
    expect(nonEntitled.breakdown).toContainEqual({
      reason: 'maintenanceShare',
      points: 5 / 12,
      label: 'ילד בן 8 (§40(ב)(2) — הורה שאינו זכאי, 40% כלכלה)',
    });
  });

  it('§40א and the §66(ג)(3) placeholder surface as flat rows without children', () => {
    const res = computeCreditPoints(
      {
        isIsraeliResident: true,
        gender: 'female',
        parentContext: {
          regime: 'marriedRegisteredSpouse',
          divorcedPaysMaintenanceRemarried: true,
          receivesChildAllowance: true,
        },
      },
      y2025,
    );
    // 33 + 12 (§40א) + 0 (§66(ג)(3) owner-verify placeholder) = 45 twelfths.
    expect(res.points).toBe(3.75);
    expect(res.breakdown).toContainEqual({
      reason: 'section40aBonus',
      points: 1,
      label: 'נקודת זיכוי — גרוש המשלם מזונות והנשוי לבן זוג אחר (§40א)',
    });
    // The קצבה row deliberately shows at 0 points with its TODO label — an
    // owner-verify placeholder, not a "nothing applies" zero.
    const allowanceRow = res.breakdown.find((r) => r.reason === 'childAllowance');
    expect(allowanceRow?.points).toBe(0);
    expect(allowanceRow?.label).toContain('§66(ג)(3)');
  });

  it('the §40(ב)(1א) mother-claims-false 0-row SURFACES in the breakdown (il-0.7.1)', () => {
    // Reviewer nit closed: the number was always right (0) but the
    // no-black-box label never reached the worksheet — the reviewer saw
    // nothing for the child instead of WHY the father gets no points.
    const res = computeCreditPoints(
      {
        isIsraeliResident: true,
        gender: 'male',
        parentContext: { regime: 'singleFather', motherClaimsUnderSection1: false },
        children: [{ ageInTaxYear: 1 }],
      },
      y2025,
    );
    expect(res.points).toBe(2.25); // resident only — the child row is 0
    const childRow = res.breakdown.find((r) => r.reason === 'child');
    expect(childRow?.points).toBe(0);
    expect(childRow?.label).toContain('§40(ב)(1א)');
    expect(childRow?.label).toContain('האם');
  });

  it('separateCalculation changes the labels, never the count', () => {
    const base = computeCreditPoints(
      {
        isIsraeliResident: true,
        gender: 'female',
        parentContext: { regime: 'marriedRegisteredSpouse' },
        children: [{ ageInTaxYear: 2 }],
      },
      y2025,
    );
    const separate = computeCreditPoints(
      {
        isIsraeliResident: true,
        gender: 'female',
        parentContext: { regime: 'marriedRegisteredSpouse', separateCalculation: true },
        children: [{ ageInTaxYear: 2 }],
      },
      y2025,
    );
    expect(separate.points).toBe(base.points);
    expect(separate.valueAgorot).toBe(base.valueAgorot);
    const childRow = separate.breakdown.find((r) => r.reason === 'child');
    expect(childRow?.label).toContain('חישוב נפרד');
  });

  it('the birth-year deferral flows through as a negative row without breaking the total', () => {
    // 33 (resident woman) + 30 (age 0) − 12 (טופס 116ד deferral) = 51.
    const res = computeCreditPoints(
      {
        isIsraeliResident: true,
        gender: 'female',
        parentContext: { regime: 'marriedRegisteredSpouse' },
        children: [{ ageInTaxYear: 0, deferBirthYearPoint: true }],
      },
      y2025,
    );
    expect(res.points).toBe(51 / 12);
    expect(res.valueAgorot).toBe(51 * 24_200);
    expect(res.breakdown).toContainEqual({
      reason: 'birthYearDeferral',
      points: -1,
      label: 'דחיית נקודת זיכוי אחת משנת הלידה לשנת המס הבאה (טופס 116ד)',
    });
  });

  it('structured children with no parentContext throw loudly', () => {
    expect(() =>
      computeCreditPoints(
        {
          isIsraeliResident: true,
          gender: 'female',
          children: [{ ageInTaxYear: 2 }],
        },
        y2025,
      ),
    ).toThrow(InvalidTaxInputError);
  });

  it('an unknown regime throws loudly', () => {
    expect(() =>
      computeCreditPoints(
        {
          isIsraeliResident: true,
          gender: 'female',
          parentContext: {
            regime: 'jointCustody' as 'marriedRegisteredSpouse',
          },
          children: [{ ageInTaxYear: 2 }],
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
        parentContext: { regime: 'marriedRegisteredSpouse' },
        children: [{ ageInTaxYear: 2 }],
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
        parentContext: { regime: 'marriedRegisteredSpouse' },
        children: [{ ageInTaxYear: 2 }],
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
