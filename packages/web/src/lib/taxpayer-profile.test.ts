import { CalculateRequestSchema, TaxpayerProfileSchema } from '@taxreturns/shared';
import type { TaxpayerProfile } from '@taxreturns/shared';
import { describe, expect, it } from 'vitest';
import {
  formStateToProfile,
  profileToTaxpayerFormState,
  type TaxpayerFormState,
} from './taxpayer-profile';

// Pure profile ↔ worksheet-form-state mapping (plan
// 2026-07-14-taxpayer-profile.md, Phase C). The profile stores yearOfBirth;
// the form speaks ageInTaxYear strings — the derivation
// ageInTaxYear = taxYear − yearOfBirth is THE job of this module.

const emptyState: TaxpayerFormState = {
  gender: 'male',
  children: [],
  parentRegime: '',
  receivesAllowance: false,
  maintenanceRemarried: false,
  separateCalc: false,
  motherClaims: false,
  aliyahOn: false,
  aliyahYear: '',
  aliyahMonth: '1',
  aliyahVariant: 'from2022',
  degrees: [],
};

const fullProfile: TaxpayerProfile = {
  gender: 'female',
  isIsraeliResident: true,
  children: [{ yearOfBirth: 2020 }, { yearOfBirth: 2017, maintenanceShare: 0.4 }],
  parentContext: {
    regime: 'separatedNonEntitled',
    divorcedPaysMaintenanceRemarried: true,
  },
  aliyah: { aliyahYear: 2023, aliyahMonth: 7, scheduleVariant: 'from2022' },
  degrees: [
    { track: 'bachelor', completionYear: 2023, studyYears: 3 },
    {
      track: 'master',
      completionYear: 2020,
      studyYears: 2,
      electedClaimYear: 2021,
      internship: { startYear: 2020, endYear: 2021 },
    },
  ],
};

describe('profileToTaxpayerFormState', () => {
  it('derives ageInTaxYear = taxYear − yearOfBirth per child (2020 → "5" for 2025)', () => {
    const { state } = profileToTaxpayerFormState(fullProfile, 2025);
    expect(state.children.map((c) => c.age)).toEqual(['5', '8']);
    // The stored maintenanceShare suggestion round-trips as a string.
    expect(state.children[1]!.maintenanceShare).toBe('0.4');
    // Per-year 116ד flags are never stored — always off in the pre-fill.
    expect(state.children.every((c) => !c.deferBirthYearPoint)).toBe(true);
  });

  it('a different tax year shifts every derived age by the year delta', () => {
    const { state } = profileToTaxpayerFormState(fullProfile, 2024);
    expect(state.children.map((c) => c.age)).toEqual(['4', '7']);
  });

  it('omits aged-out and not-yet-born children, reporting the omitted count', () => {
    const profile: TaxpayerProfile = {
      gender: 'male',
      isIsraeliResident: true,
      children: [
        { yearOfBirth: 2000 }, // age 25 for 2025 — aged out
        { yearOfBirth: 2030 }, // not yet born for 2025
        { yearOfBirth: 2007 }, // age 18 — still in range
      ],
    };
    const { state, omittedChildren } = profileToTaxpayerFormState(profile, 2025);
    expect(state.children.map((c) => c.age)).toEqual(['18']);
    expect(omittedChildren).toBe(2);
  });

  it('maps parentContext, aliyah, and degrees 1:1 into the form state', () => {
    const { state } = profileToTaxpayerFormState(fullProfile, 2025);
    expect(state.gender).toBe('female');
    expect(state.parentRegime).toBe('separatedNonEntitled');
    expect(state.maintenanceRemarried).toBe(true);
    expect(state.receivesAllowance).toBe(false);
    expect(state.aliyahOn).toBe(true);
    expect(state.aliyahYear).toBe('2023');
    expect(state.aliyahMonth).toBe('7');
    expect(state.aliyahVariant).toBe('from2022');
    expect(state.degrees).toEqual([
      {
        track: 'bachelor',
        completionYear: '2023',
        studyYears: '3',
        electedClaimYear: '',
        internship: false,
        internshipStart: '',
        internshipEnd: '',
      },
      {
        track: 'master',
        completionYear: '2020',
        studyYears: '2',
        electedClaimYear: '2021',
        internship: true,
        internshipStart: '2020',
        internshipEnd: '2021',
      },
    ]);
  });

  it('a minimal profile pre-fills gender only, sections stay empty', () => {
    const { state, omittedChildren } = profileToTaxpayerFormState(
      { gender: 'male', isIsraeliResident: true },
      2025,
    );
    expect(state).toEqual({ ...emptyState, gender: 'male' });
    expect(omittedChildren).toBe(0);
  });

  it('its derived children pass CalculateRequestSchema when submitted as ages', () => {
    // The deliberate yearOfBirth ↔ ageInTaxYear schema difference is bridged
    // correctly: the derived ages are inside the calculate schema's 0-18
    // statutory domain.
    const { state } = profileToTaxpayerFormState(fullProfile, 2025);
    const body = {
      taxpayer: {
        gender: state.gender,
        children: state.children.map((c) => ({ ageInTaxYear: Number(c.age) })),
      },
    };
    expect(CalculateRequestSchema.safeParse(body).success).toBe(true);
  });
});

describe('formStateToProfile', () => {
  it('inverts the derivation (yearOfBirth = taxYear − age) and drops per-year fields', () => {
    const state: TaxpayerFormState = {
      ...emptyState,
      gender: 'female',
      parentRegime: 'marriedRegisteredSpouse',
      children: [
        {
          age: '5',
          maintenanceShare: '',
          deferBirthYearPoint: true, // per-year election — must NOT persist
          claimDeferredBirthYearPoint: false,
        },
      ],
    };
    const profile = formStateToProfile(state, 2025);
    expect(profile).toEqual({
      gender: 'female',
      isIsraeliResident: true,
      children: [{ yearOfBirth: 2020 }],
      parentContext: { regime: 'marriedRegisteredSpouse' },
    });
    expect(TaxpayerProfileSchema.safeParse(profile).success).toBe(true);
  });

  it('stores maintenanceShare only under separatedNonEntitled (the form submit rule)', () => {
    const state: TaxpayerFormState = {
      ...emptyState,
      parentRegime: 'separatedNonEntitled',
      children: [
        {
          age: '8',
          maintenanceShare: '0.4',
          deferBirthYearPoint: false,
          claimDeferredBirthYearPoint: false,
        },
      ],
    };
    expect(formStateToProfile(state, 2025).children).toEqual([
      { yearOfBirth: 2017, maintenanceShare: 0.4 },
    ]);

    const otherRegime = formStateToProfile(
      { ...state, parentRegime: 'marriedRegisteredSpouse' },
      2025,
    );
    expect(otherRegime.children).toEqual([{ yearOfBirth: 2017 }]);
  });

  it('omits empty sections as keys (undefined, never [])', () => {
    const profile = formStateToProfile(emptyState, 2025);
    expect('children' in profile).toBe(false);
    expect('parentContext' in profile).toBe(false);
    expect('aliyah' in profile).toBe(false);
    expect('degrees' in profile).toBe(false);
    expect(TaxpayerProfileSchema.safeParse(profile).success).toBe(true);
  });

  it('round-trip profile → state → profile is stable for in-range children', () => {
    const { state } = profileToTaxpayerFormState(fullProfile, 2025);
    expect(formStateToProfile(state, 2025)).toEqual(fullProfile);
  });

  it('its output always parses under TaxpayerProfileSchema (full state)', () => {
    const { state } = profileToTaxpayerFormState(fullProfile, 2025);
    expect(TaxpayerProfileSchema.safeParse(formStateToProfile(state, 2025)).success).toBe(
      true,
    );
  });
});
