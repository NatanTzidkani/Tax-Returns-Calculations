import { z } from 'zod';

/** Integer agorot (₪ × 100), non-negative — matches the document schemas. */
const agorotAmount = z.number().int('amounts are integer agorot').min(0);

/** Integer calendar/tax year. Purely structural — legal year rules (e.g. the
 *  degree cohort boundaries) belong to the engine. Bounds are absurdity guards
 *  only (a mistyped 20240 or negative year is a loud reject, not a legal rule). */
const yearInt = z.number().int('years are integer tax years').min(1900).max(2100);

/**
 * Structured credit-point inputs (children+parentContext §40/§66(ג) / oleh
 * §35 / degrees §40ג-§40ה).
 * These schemas are STRUCTURAL ONLY — field names, enums, integers, and
 * physically-absurd bounds (month 1-12; age 0-18, the statutory domain of the
 * child table; maintenanceShare a 0-1 fraction). Legal rules — per-age point
 * counts, regime schedules, maintenanceShare↔regime pairing, the mother-only
 * 116ד deferral eligibility, children-require-parentContext, elective-year
 * candidate sets, completionYear >= 2014, internship conditions, §7(ב)/(ג)
 * exclusivity — live in the ENGINE only, which fails loudly (Hebrew-mapped
 * 400s). Do not duplicate them here (plans:
 * docs/superpowers/plans/2026-07-14-credit-points-wiring.md,
 * docs/superpowers/plans/2026-07-13-parent-allocation.md).
 *
 * Shapes mirror the engine's `TaxpayerInput` (packages/tax-engine
 * core/types.ts) exactly; the api package pins them with type-level equality
 * assertions so a typo'd optional key cannot silently drift.
 */
export const ChildInputSchema = z.object({
  /** The age the child reaches during the tax year. 0-18 is the statutory
   *  domain of the §40 table (a deliberate domain bound here). */
  ageInTaxYear: z.number().int().min(0).max(18),
  /** §40(ב)(2) share of כלכלה — physically a 0-1 fraction. WHICH regime it
   *  pairs with (separatedNonEntitled only) is the engine's rule. */
  maintenanceShare: z.number().min(0).max(1).optional(),
  /** טופס 116ד: defer this child's birth-year point to the next tax year.
   *  Eligibility (mother-only regimes, age 0) is engine-owned. */
  deferBirthYearPoint: z.boolean().optional(),
  /** טופס 116ד: claim the point deferred from the prior year (age 1).
   *  Same engine-owned eligibility. */
  claimDeferredBirthYearPoint: z.boolean().optional(),
}).strict();

export type ChildInput = z.infer<typeof ChildInputSchema>;

/**
 * Filer-level marital/custody context for child credit-point allocation
 * (§66(ג)/§40(ב)/§40א, il-0.6.0; regimes fully enabled il-0.7.0). The enum
 * lists the engine's regime union verbatim — every flag's legal effect
 * stays in the engine.
 */
export const ParentContextSchema = z.object({
  regime: z.enum([
    'marriedRegisteredSpouse', // §66(ג)(4)
    'marriedOtherSpouse', // §66(ג)(5)
    'singleParent', // §40(ב)(1)+(1ב)
    'singleFather', // §40(ב)(1א) — covers all his children since ס"ח 3048/3184 (was singleFatherOfToddler)
    'separatedEntitled', // §40(ב)(2), the (1)-entitled parent
    'separatedNonEntitled', // §40(ב)(2), split כלכלה
  ]),
  /** §66(ג)(3): this filer is the בן-זוג-רשום receiving the NII קצבה. */
  receivesChildAllowance: z.boolean().optional(),
  /** §40א: divorced, pays מזונות, remarried. */
  divorcedPaysMaintenanceRemarried: z.boolean().optional(),
  /** §66(ג)(1)/(1א): the filer is computed on a חישוב נפרד. */
  separateCalculation: z.boolean().optional(),
  /** §40(ב)(1א) guard input for singleFather. */
  motherClaimsUnderSection1: z.boolean().optional(),
}).strict();

export type ParentContext = z.infer<typeof ParentContextSchema>;

export const AliyahInputSchema = z.object({
  aliyahYear: yearInt,
  /** Calendar month oleh status was granted, 1-12. */
  aliyahMonth: z.number().int().min(1).max(12),
  scheduleVariant: z.enum(['pre2022', 'from2022']),
}).strict();

export type AliyahInput = z.infer<typeof AliyahInputSchema>;

export const DegreeInputSchema = z.object({
  track: z.enum(['bachelor', 'master', 'vocational']),
  completionYear: yearInt,
  /** Academic study years — a positive integer count. */
  studyYears: z.number().int().min(1),
  electedClaimYear: yearInt.optional(),
  internship: z
    .object({ startYear: yearInt, endYear: yearInt })
    .strict()
    .optional(),
}).strict();

export type DegreeInput = z.infer<typeof DegreeInputSchema>;

/**
 * Body of POST /tax-years/:id/calculate (Plan 5 contract). The taxpayer
 * details are per-request because they are not extracted from documents;
 * additionalCreditPoints is the reviewer-verified total for categories not
 * yet modelled structurally (PhD tracks, pre-2014 completions…) in units of
 * 0.25; children+parentContext/
 * aliyah/degrees are the structured inputs the engine computes points from
 * (il-0.4.0/il-0.5.0/il-0.6.0). All are optional and, when absent, MUST stay
 * absent as keys — the engine distinguishes `undefined` (not supplied) from
 * `[]`, and children-without-parentContext is the ENGINE's loud throw.
 *
 * nonLinkedInterestAgorot / nonLinkedInterestWithheldAgorot are ALSO
 * per-request: 15% interest on a non-index-linked bank deposit or savings
 * plan (§125ג(ג)(1); Form 1301 field 078, withholding 043). There is no
 * confirmed-document source for it yet — Form 867 extraction only carries the
 * securities interest/dividend aggregate — so the reviewer enters it here
 * until a dedicated non-linked-interest extraction box exists. Both optional;
 * absent → no such income.
 */
export const CalculateRequestSchema = z
  .object({
    taxpayer: z
      .object({
        gender: z.enum(['male', 'female']),
        isIsraeliResident: z.boolean().default(true),
        additionalCreditPoints: z.number().min(0).multipleOf(0.25).default(0),
        parentContext: ParentContextSchema.optional(),
        children: z.array(ChildInputSchema).optional(),
        aliyah: AliyahInputSchema.optional(),
        degrees: z.array(DegreeInputSchema).optional(),
      })
      .strict(),
    /** 15% deposit/savings interest income (Form 1301 field 078). */
    nonLinkedInterestAgorot: agorotAmount.optional(),
    /** Deposit-interest tax withheld at source (Form 1301 field 043). */
    nonLinkedInterestWithheldAgorot: agorotAmount.optional(),
  })
  .strict();

export type CalculateRequest = z.infer<typeof CalculateRequestSchema>;

export const TAX_YEAR_STATUSES = [
  'draft',
  'in_review',
  'ready_to_file',
  'filed',
  'amended',
] as const;

export type TaxYearStatus = (typeof TAX_YEAR_STATUSES)[number];

/** Body of PATCH /tax-years/:id/status (legal transitions enforced server-side). */
export const TaxYearStatusUpdateSchema = z.object({
  status: z.enum(TAX_YEAR_STATUSES),
});

export type TaxYearStatusUpdate = z.infer<typeof TaxYearStatusUpdateSchema>;
