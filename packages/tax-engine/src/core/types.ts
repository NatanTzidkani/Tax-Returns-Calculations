import type { Agorot } from '@taxreturns/shared';

// ---------------------------------------------------------------------------
// Engine input. The API layer maps confirmed_data payloads (Form 106 boxes,
// Form 867 rows, receipts) into this semantic shape — the engine never sees
// raw documents (spec §3, CLAUDE.md "engine's only input is confirmed_data").
// ---------------------------------------------------------------------------

export interface SalaryInput {
  employerName: string;
  /** Form 106 box 158 — gross salary income */
  grossSalaryAgorot: Agorot;
  /** Form 106 box 042 — income tax withheld */
  taxWithheldAgorot: Agorot;
  /** Form 106 box 045 — employee pension (kupat gemel) contributions */
  pensionEmployeeContributionAgorot: Agorot;
  /** NI + health employee share actually withheld; informational only */
  niEmployeeWithheldAgorot?: Agorot;
}

export interface DonationInput {
  institutionName: string;
  /** Receipt total; institution must hold a section 46 approval */
  amountAgorot: Agorot;
}

/** One broker's Form 867, already aggregated to yearly totals. */
export interface BrokerEntryInput {
  brokerName: string;
  /** Real (inflation-adjusted) capital gains, ≥ 0 */
  realGainAgorot: Agorot;
  /** Realized real capital losses as a positive number, ≥ 0 */
  realLossAgorot: Agorot;
  /** Interest + dividend income from securities, ≥ 0 (loss-offset target) */
  interestDividendAgorot: Agorot;
  /** Capital-market tax withheld by this broker */
  taxWithheldAgorot: Agorot;
}

export interface TaxpayerInput {
  isIsraeliResident: boolean;
  gender: 'male' | 'female';
  /**
   * Extra credit points beyond what the engine computes (medicine/direct-
   * track PhD degrees, oleh clock-pausing…), in units of 0.25. Remains the
   * reviewer's catch-all for every category not yet modelled.
   */
  additionalCreditPoints?: number;
  /**
   * Marital/custody context for child credit-point allocation. Reviewer-
   * supplied; the engine picks the statutory paragraph from `regime` — it
   * never infers custody. Required when `children` is non-empty; absent
   * (with no children) → no child points from structured input
   * (additionalCreditPoints remains the fallback).
   * source: docs/superpowers/research/2026-07-13-credit-points-allocation-addendum.md
   */
  parentContext?: {
    regime:
      | 'marriedRegisteredSpouse' // §66(ג)(4) — full ages 0-18 (Schedule A)
      | 'marriedOtherSpouse' // §66(ג)(5) — פעוט only (Schedule B, DISABLED pending owner-verify)
      | 'singleParent' // §40(ב)(1)+(1ב)
      | 'singleFather' // §40(ב)(1א)
      | 'separatedEntitled' // §40(ב)(2), the (1)-entitled parent
      | 'separatedNonEntitled'; // §40(ב)(2), split כלכלה
    /** §66(ג)(3): this filer is the בן-זוג-רשום receiving the NII קצבה.
     *  Count is owner-verify — surfaces as a 0-point TODO worksheet row. */
    receivesChildAllowance?: boolean;
    /** §40א: divorced, pays מזונות, remarried → +1 point. */
    divorcedPaysMaintenanceRemarried?: boolean;
    /** §66(ג)(1)/(1א): the filer is computed on a חישוב נפרד. Labels the
     *  worksheet only — child points are fixed per-parent, never a
     *  splittable pool (allocation addendum §3). */
    separateCalculation?: boolean;
    /** §40(ב)(1א) guard: for singleFather, whether the child's resident
     *  mother is entitled under (1). false → the father's child points
     *  attach to HER income, so this filer gets 0. */
    motherClaimsUnderSection1?: boolean;
  };
  /**
   * Children for the §40/§66(ג) child credit points. Counts come from the
   * age→point table (all ages 0-18 since il-0.7.0 — sah3184 addendum);
   * WHICH schedule applies comes from `parentContext.regime` (allocation
   * addendum).
   */
  children?: Array<{
    ageInTaxYear: number;
    /** §40(ב)(2) separatedNonEntitled only: this parent's share of כלכלה,
     *  0..1 — the one point is granted × this fraction. Required in that
     *  regime; loud throw if supplied in any other. */
    maintenanceShare?: number;
    /** טופס 116ד: the mother defers this child's ONE birth-year point to the
     *  next tax year. Age 0 + mother Schedule-A regimes only. */
    deferBirthYearPoint?: boolean;
    /** טופס 116ד: this filer CLAIMS the point deferred from the prior year
     *  for this child (age 1 in the claim year). Mother-only, same guard. */
    claimDeferredBirthYearPoint?: boolean;
  }>;
  /**
   * §35 oleh schedule input. `scheduleVariant` is an explicit reviewer input,
   * NOT derived from the date — the pre-2022 cohort transition rule is still
   * owner-verify (plan checklist). No clock-pausing is modelled.
   */
  aliyah?: {
    aliyahYear: number;
    aliyahMonth: number;
    scheduleVariant: 'pre2022' | 'from2022';
  };
  /**
   * §40ג–§40ה degree/vocational credit points. Reviewer-supplied; the reviewer
   * attests eligibility (recognized degree §7(ה), vocational conditions §7(ו),
   * proof §7(א)); the engine derives the claim window and points for the tax
   * year. Absent → no degree points from structured input
   * (additionalCreditPoints remains the fallback).
   * source: docs/superpowers/research/2026-07-13-degrees-40g-addendum.md
   */
  degrees?: Array<{
    track: 'bachelor' | 'master' | 'vocational';
    /** Tax year in which the studies for this degree/certificate ended. ≥ 2014
     *  (earlier cohorts are out of scope → loud throw). */
    completionYear: number;
    /** Academic study years (integer ≥ 1; window length = min(studyYears, cap)). */
    studyYears: number;
    /** 2014-2022 cohort ONLY: the single elected benefit year — base+1 or base+2
     *  (base = internship end year if internship supplied, else completionYear).
     *  Required for that cohort; forbidden (loud throw) for 2023+. */
    electedClaimYear?: number;
    /** Form 119 §6 internship deferral (bachelor/master only). Presence = the
     *  taxpayer ELECTS the internship-based start (window/candidates run from
     *  endYear + 1 instead of completionYear + 1). */
    internship?: { startYear: number; endYear: number };
  }>;
}

/**
 * Interest on a non-index-linked asset (ריבית על נכס שאינו צמוד למדד) — plain-
 * shekel bank deposits and savings plans — taxed at a flat 15% (§125ג(ג)(1);
 * Form 1301 item 21 field 078). Kept SEPARATE from BrokerEntryInput/securities:
 * different rate (15% vs 25%), different Form 1301 fields (078/043 vs 157/040),
 * and (owner-confirmed default) NOT a §92 loss-offset target — a deposit is not
 * a נייר ערך. See docs/superpowers/research/2026-07-13-non-linked-interest-15pct.md.
 */
export interface NonLinkedInterestInput {
  /** 15% deposit/savings interest income (Form 1301 field 078), ≥ 0 */
  amountAgorot: Agorot;
  /** Deposit-interest tax withheld at source (Form 1301 field 043), ≥ 0 */
  taxWithheldAgorot: Agorot;
}

export interface TaxYearInput {
  year: number;
  taxpayer: TaxpayerInput;
  salaries: SalaryInput[];
  donations: DonationInput[];
  capital: {
    entries: BrokerEntryInput[];
    /** Unused real capital losses carried in from prior years, ≥ 0 */
    lossCarryforwardInAgorot: Agorot;
  };
  /** 15% non-linked deposit/savings interest; absent → no such income. */
  nonLinkedInterest?: NonLinkedInterestInput;
}

// ---------------------------------------------------------------------------
// Engine output. Every intermediate value is exposed so the UI can render a
// fully auditable worksheet (spec §3): no black-box bottom line.
// ---------------------------------------------------------------------------

export interface BracketRow {
  fromAgorot: Agorot;
  toAgorot: Agorot | null;
  rateBp: number;
  taxedAmountAgorot: Agorot;
  taxAgorot: Agorot;
}

export interface IncomeTaxResult {
  taxableIncomeAgorot: Agorot;
  rows: BracketRow[];
  totalAgorot: Agorot;
}

export interface CreditPointsBreakdownRow {
  reason:
    | 'resident'
    | 'female'
    | 'additional'
    | 'child'
    | 'oleh'
    | 'degree'
    | 'childAllowance' // §66(ג)(3) — count owner-verify, 0-point TODO row
    | 'singleParentBonus' // §40(ב)(1ב)
    | 'separatedBonus' // §40(ב)(2) +1
    | 'maintenanceShare' // §40(ב)(2) fractional (split כלכלה)
    | 'section40aBonus' // §40א
    | 'birthYearDeferral'; // טופס 116ד (negative in the defer year)
  points: number;
  /** Hebrew worksheet label saying WHY the points were granted (no black box). */
  label?: string;
}

export interface CreditPointsResult {
  points: number;
  breakdown: CreditPointsBreakdownRow[];
  valueAgorot: Agorot;
}

export interface CharityResult {
  totalDonationsAgorot: Agorot;
  /** min(ceiling, 30% of taxable income) actually applied this year */
  appliedCeilingAgorot: Agorot;
  eligibleAgorot: Agorot;
  creditAgorot: Agorot;
  /** Donations above the ceiling, transferable to the next 3 years (DB tracks) */
  carryforwardOutAgorot: Agorot;
  /** True when total donations fell below the statutory minimum */
  belowMinimum: boolean;
}

export interface CapitalGainsResult {
  totalRealGainsAgorot: Agorot;
  totalRealLossesAgorot: Agorot;
  totalInterestDividendAgorot: Agorot;
  lossCarryforwardInAgorot: Agorot;
  /** Current-year losses netted against current-year gains */
  lossesOffsetAgainstGainsAgorot: Agorot;
  /** Current-year losses then netted against interest/dividend income */
  lossesOffsetAgainstInterestDividendAgorot: Agorot;
  /** Prior-year carry-forward consumed against what remained */
  carryforwardConsumedAgorot: Agorot;
  taxableGainAgorot: Agorot;
  taxableInterestDividendAgorot: Agorot;
  /** 25% of taxable gain + 25% of taxable interest/dividend */
  taxAgorot: Agorot;
  withheldAgorot: Agorot;
  lossCarryforwardOutAgorot: Agorot;
}

export interface PensionResult {
  totalEmployeeContributionsAgorot: Agorot;
  qualifyingIncomeAgorot: Agorot;
  /** 7% of qualifying income — the contribution amount cap */
  contributionCapAgorot: Agorot;
  creditedContributionAgorot: Agorot;
  creditAgorot: Agorot;
}

export interface SurtaxResult {
  thresholdAgorot: Agorot;
  baseAgorot: Agorot;
  basicSurtaxAgorot: Agorot;
  /** 2025+: extra 2% on the capital-source part above the threshold */
  capitalBaseAgorot: Agorot;
  capitalAdditionalSurtaxAgorot: Agorot;
  totalAgorot: Agorot;
}

export interface NonLinkedInterestResult {
  /** Worksheet breakdown reason (labels the audit line). */
  reason: 'nonLinkedInterest';
  amountAgorot: Agorot;
  /** Flat rate applied (basis points): 1_500 = 15%. */
  rateBp: number;
  /** 15% of the interest amount (§125ג(ג)(1)). */
  taxAgorot: Agorot;
  withheldAgorot: Agorot;
}

export interface NationalInsuranceResult {
  informational: true;
  expectedEmployeeAgorot: Agorot;
  withheldEmployeeAgorot: Agorot | null;
  differenceAgorot: Agorot | null;
}

export interface TaxReturnResult {
  engineVersion: string;
  year: number;
  incomeTax: IncomeTaxResult;
  creditPoints: CreditPointsResult;
  pension: PensionResult;
  charity: CharityResult;
  /** Credits actually subtracted (cannot push income tax below zero) */
  creditsAppliedAgorot: Agorot;
  creditsUnusedAgorot: Agorot;
  incomeTaxAfterCreditsAgorot: Agorot;
  capitalGains: CapitalGainsResult;
  nonLinkedInterest: NonLinkedInterestResult;
  surtax: SurtaxResult;
  totalLiabilityAgorot: Agorot;
  totalWithheldAgorot: Agorot;
  /** Positive = refund due to the taxpayer; negative = balance owed */
  refundAgorot: Agorot;
  lossCarryforwardOutAgorot: Agorot;
  nationalInsurance: NationalInsuranceResult;
  /** Official Form 1301 field code → agorot value (codes owner-verified) */
  form1301Fields: Record<string, Agorot>;
}

// ---------------------------------------------------------------------------
// Year data shape (one file per year under jurisdictions/il/years/)
// ---------------------------------------------------------------------------

export interface TaxBracket {
  /** Upper annual boundary in agorot; null = open-ended top bracket */
  upToAgorot: Agorot | null;
  rateBp: number;
}

export interface IlYearData {
  year: number;
  brackets: TaxBracket[];
  creditPointValueAgorot: Agorot;
  surtax: {
    thresholdAgorot: Agorot;
    rateBp: number;
    /** 0 before 2025; 200 (2%) on capital-source income from 2025 */
    capitalAdditionalRateBp: number;
  };
  charity: {
    creditRateBp: number;
    minTotalAgorot: Agorot;
    ceilingAgorot: Agorot;
    /** The alternative ceiling: this share of taxable income */
    ceilingIncomeShareBp: number;
  };
  pension45a: {
    creditRateBp: number;
    /** Contributions credited up to this share of qualifying income */
    contributionCapShareBp: number;
    qualifyingIncomeCeilingAgorot: Agorot;
  };
  capitalGains: {
    realGainRateBp: number;
    /**
     * Flat rate on interest from a non-index-linked asset (bank deposits /
     * savings plans): 1_500 = 15%. source: §125ג(ג)(1); Form 1301 item 21
     * field 078; 15% in both 2024 & 2025 (fixed statutory percentage, no
     * §120ב indexation, freeze-law-irrelevant).
     */
    nonLinkedInterestRateBp: number;
  };
  nationalInsurance: {
    employee: {
      reducedNiBp: number;
      reducedHealthBp: number;
      fullNiBp: number;
      fullHealthBp: number;
    };
    reducedBandTopMonthlyAgorot: Agorot;
    ceilingMonthlyAgorot: Agorot;
  };
}
