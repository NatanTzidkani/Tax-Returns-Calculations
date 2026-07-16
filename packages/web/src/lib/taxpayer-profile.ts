import type { ParentContext, TaxpayerProfile } from '@taxreturns/shared';

// ---------------------------------------------------------------------------
// Pure taxpayer-profile ↔ worksheet-form-state mapping (plan
// docs/superpowers/plans/2026-07-14-taxpayer-profile.md).
//
// The stored profile is YEAR-INDEPENDENT (children by yearOfBirth); the
// worksheet form speaks controlled-input strings with per-year ages. This
// module owns both directions of the bridge:
//   profileToTaxpayerFormState: ageInTaxYear = taxYear − yearOfBirth,
//     out-of-range children omitted (counted for the Hebrew notice);
//   formStateToProfile: yearOfBirth = taxYear − age, per-year fields
//     (116ד flags) dropped, empty sections omitted as keys.
// The pre-fill is a SUGGESTION — the reviewer confirms everything; nothing
// here is a legal rule (the 0-18 domain is the shared schema's, the counts
// are the engine's).
// ---------------------------------------------------------------------------

/** Worksheet-form child row (strings: controlled inputs, parsed on submit). */
export interface ChildRow {
  age: string;
  /** §40(ב)(2) share of כלכלה — sent only under separatedNonEntitled. */
  maintenanceShare: string;
  /** טופס 116ד flags — sent only when checked (omitted, never false). */
  deferBirthYearPoint: boolean;
  claimDeferredBirthYearPoint: boolean;
}

export interface DegreeRow {
  track: 'bachelor' | 'master' | 'vocational';
  completionYear: string;
  studyYears: string;
  electedClaimYear: string;
  internship: boolean;
  internshipStart: string;
  internshipEnd: string;
}

/**
 * The 2014-2022 cohort's elective claim year is only a visible input for
 * completions up to 2022 (2023+ windows are fixed) — a DISPLAY rule the
 * engine re-validates; shared by the form and the profile mapping.
 */
export function electedYearVisible(completionYear: string): boolean {
  const trimmed = completionYear.trim();
  if (trimmed === '') return false;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed <= 2022;
}

/** The TaxpayerForm state slice the profile can pre-fill / persist. */
export interface TaxpayerFormState {
  gender: 'male' | 'female';
  children: ChildRow[];
  parentRegime: '' | ParentContext['regime'];
  receivesAllowance: boolean;
  maintenanceRemarried: boolean;
  separateCalc: boolean;
  motherClaims: boolean;
  aliyahOn: boolean;
  aliyahYear: string;
  aliyahMonth: string;
  aliyahVariant: 'pre2022' | 'from2022';
  degrees: DegreeRow[];
}

export interface TaxpayerFormPrefill {
  state: TaxpayerFormState;
  /** Children whose derived age fell outside 0-18 for this tax year —
   *  omitted from the pre-fill and surfaced in a Hebrew notice. */
  omittedChildren: number;
}

export function profileToTaxpayerFormState(
  profile: TaxpayerProfile,
  taxYear: number,
): TaxpayerFormPrefill {
  const children: ChildRow[] = [];
  let omittedChildren = 0;
  for (const child of profile.children ?? []) {
    const age = taxYear - child.yearOfBirth;
    if (age < 0 || age > 18) {
      omittedChildren += 1;
      continue;
    }
    children.push({
      age: String(age),
      maintenanceShare:
        child.maintenanceShare === undefined ? '' : String(child.maintenanceShare),
      deferBirthYearPoint: false,
      claimDeferredBirthYearPoint: false,
    });
  }

  const context = profile.parentContext;
  const state: TaxpayerFormState = {
    gender: profile.gender,
    children,
    parentRegime: context?.regime ?? '',
    receivesAllowance: context?.receivesChildAllowance === true,
    maintenanceRemarried: context?.divorcedPaysMaintenanceRemarried === true,
    separateCalc: context?.separateCalculation === true,
    motherClaims: context?.motherClaimsUnderSection1 === true,
    aliyahOn: profile.aliyah !== undefined,
    aliyahYear: profile.aliyah === undefined ? '' : String(profile.aliyah.aliyahYear),
    aliyahMonth: profile.aliyah === undefined ? '1' : String(profile.aliyah.aliyahMonth),
    aliyahVariant: profile.aliyah?.scheduleVariant ?? 'from2022',
    degrees: (profile.degrees ?? []).map((degree) => ({
      track: degree.track,
      completionYear: String(degree.completionYear),
      studyYears: String(degree.studyYears),
      electedClaimYear:
        degree.electedClaimYear === undefined ? '' : String(degree.electedClaimYear),
      internship: degree.internship !== undefined,
      internshipStart:
        degree.internship === undefined ? '' : String(degree.internship.startYear),
      internshipEnd:
        degree.internship === undefined ? '' : String(degree.internship.endYear),
    })),
  };
  return { state, omittedChildren };
}

export function formStateToProfile(
  state: TaxpayerFormState,
  taxYear: number,
): TaxpayerProfile {
  return {
    gender: state.gender,
    isIsraeliResident: true,
    // Empty/off sections OMIT their key entirely (the shared-schema
    // convention: pre-fill must later produce `undefined`, never `[]`).
    ...(state.children.length > 0
      ? {
          children: state.children.map((child) => ({
            yearOfBirth: taxYear - Number(child.age),
            // Same rule as the calculate submit: the share pairs with the
            // separatedNonEntitled regime only. The 116ד flags are per-year
            // elections — never persisted.
            ...(state.parentRegime === 'separatedNonEntitled' &&
            child.maintenanceShare.trim() !== ''
              ? { maintenanceShare: Number(child.maintenanceShare) }
              : {}),
          })),
        }
      : {}),
    ...(state.parentRegime !== ''
      ? {
          parentContext: {
            regime: state.parentRegime,
            ...(state.receivesAllowance ? { receivesChildAllowance: true } : {}),
            ...(state.maintenanceRemarried
              ? { divorcedPaysMaintenanceRemarried: true }
              : {}),
            ...(state.separateCalc ? { separateCalculation: true } : {}),
            ...(state.parentRegime === 'singleFather'
              ? { motherClaimsUnderSection1: state.motherClaims }
              : {}),
          },
        }
      : {}),
    // A toggled-on aliyah section is included even with a blank year: the
    // NaN fails the shared schema at PUT time (loud Hebrew 400, mirroring
    // the calculate path) instead of silently erasing a stored aliyah fact
    // on the next save (reviewer finding, 2026-07-16).
    ...(state.aliyahOn
      ? {
          aliyah: {
            aliyahYear:
              state.aliyahYear.trim() === '' ? Number.NaN : Number(state.aliyahYear),
            aliyahMonth: Number(state.aliyahMonth),
            scheduleVariant: state.aliyahVariant,
          },
        }
      : {}),
    ...(state.degrees.length > 0
      ? {
          degrees: state.degrees.map((degree) => ({
            track: degree.track,
            completionYear: Number(degree.completionYear),
            studyYears: Number(degree.studyYears),
            ...(electedYearVisible(degree.completionYear) &&
            degree.electedClaimYear.trim() !== ''
              ? { electedClaimYear: Number(degree.electedClaimYear) }
              : {}),
            ...(degree.internship
              ? {
                  internship: {
                    startYear: Number(degree.internshipStart),
                    endYear: Number(degree.internshipEnd),
                  },
                }
              : {}),
          })),
        }
      : {}),
  };
}
