import { z } from 'zod';

/** Integer agorot (₪ × 100), non-negative — matches the document schemas. */
const agorotAmount = z.number().int('amounts are integer agorot').min(0);

/** Integer calendar/tax year. Purely structural — legal year rules (e.g. the
 *  degree cohort boundaries) belong to the engine. */
const yearInt = z.number().int('years are integer tax years');

/**
 * Structured credit-point inputs (children §40 / oleh §35 / degrees §40ג-§40ה).
 * These schemas are STRUCTURAL ONLY — field names, enums, integers, and
 * physically-absurd bounds (month 1-12; age 0-18, the statutory domain of the
 * child table). Legal rules — the not-yet-verified 6-17 band, elective-year
 * candidate sets, completionYear >= 2014, internship conditions, §7(ב)/(ג)
 * exclusivity — live in the ENGINE only, which fails loudly (Hebrew-mapped
 * 400s). Do not duplicate them here (plan:
 * docs/superpowers/plans/2026-07-14-credit-points-wiring.md).
 *
 * Shapes mirror the engine's `TaxpayerInput` (packages/tax-engine
 * core/types.ts) exactly; the api package pins them with type-level equality
 * assertions so a typo'd optional key cannot silently drift.
 */
export const ChildInputSchema = z.object({
  /** The age the child reaches during the tax year. 0-18 is the statutory
   *  domain of the §40 table (the one deliberate domain bound here). */
  ageInTaxYear: z.number().int().min(0).max(18),
  role: z.enum(['custodial', 'other']),
});

export type ChildInput = z.infer<typeof ChildInputSchema>;

export const AliyahInputSchema = z.object({
  aliyahYear: yearInt,
  /** Calendar month oleh status was granted, 1-12. */
  aliyahMonth: z.number().int().min(1).max(12),
  scheduleVariant: z.enum(['pre2022', 'from2022']),
});

export type AliyahInput = z.infer<typeof AliyahInputSchema>;

export const DegreeInputSchema = z.object({
  track: z.enum(['bachelor', 'master', 'vocational']),
  completionYear: yearInt,
  /** Academic study years — a positive integer count. */
  studyYears: z.number().int().min(1),
  electedClaimYear: yearInt.optional(),
  internship: z
    .object({ startYear: yearInt, endYear: yearInt })
    .optional(),
});

export type DegreeInput = z.infer<typeof DegreeInputSchema>;

/**
 * Body of POST /tax-years/:id/calculate (Plan 5 contract). The taxpayer
 * details are per-request because they are not extracted from documents;
 * additionalCreditPoints is the reviewer-verified total for categories not
 * yet modelled structurally (6-17 children, parent allocation, PhD tracks,
 * pre-2014 completions…) in units of 0.25; children/aliyah/degrees are the
 * structured inputs the engine computes points from (il-0.4.0/il-0.5.0).
 * All three are optional and, when absent, MUST stay absent as keys — the
 * engine distinguishes `undefined` (not supplied) from `[]`.
 *
 * nonLinkedInterestAgorot / nonLinkedInterestWithheldAgorot are ALSO
 * per-request: 15% interest on a non-index-linked bank deposit or savings
 * plan (§125ג(ג)(1); Form 1301 field 078, withholding 043). There is no
 * confirmed-document source for it yet — Form 867 extraction only carries the
 * securities interest/dividend aggregate — so the reviewer enters it here
 * until a dedicated non-linked-interest extraction box exists. Both optional;
 * absent → no such income.
 */
export const CalculateRequestSchema = z.object({
  taxpayer: z.object({
    gender: z.enum(['male', 'female']),
    isIsraeliResident: z.boolean().default(true),
    additionalCreditPoints: z.number().min(0).multipleOf(0.25).default(0),
    children: z.array(ChildInputSchema).optional(),
    aliyah: AliyahInputSchema.optional(),
    degrees: z.array(DegreeInputSchema).optional(),
  }),
  /** 15% deposit/savings interest income (Form 1301 field 078). */
  nonLinkedInterestAgorot: agorotAmount.optional(),
  /** Deposit-interest tax withheld at source (Form 1301 field 043). */
  nonLinkedInterestWithheldAgorot: agorotAmount.optional(),
});

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
