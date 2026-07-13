import { z } from 'zod';

/** Integer agorot (₪ × 100), non-negative — matches the document schemas. */
const agorotAmount = z.number().int('amounts are integer agorot').min(0);

/**
 * Body of POST /tax-years/:id/calculate (Plan 5 contract). The taxpayer
 * details are per-request because they are not extracted from documents;
 * additionalCreditPoints is the reviewer-verified total (children/degree/
 * oleh tables land in a later plan) in units of 0.25.
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
