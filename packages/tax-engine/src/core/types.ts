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
   * Extra credit points beyond resident+gender (children, degree, oleh…),
   * in units of 0.25. Their tables land in a later plan; until then the
   * reviewer enters the verified total here.
   */
  additionalCreditPoints?: number;
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
  reason: 'resident' | 'female' | 'additional';
  points: number;
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
