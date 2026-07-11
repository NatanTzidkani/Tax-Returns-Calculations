import { z } from 'zod';

/**
 * Body of POST /tax-years/:id/calculate (Plan 5 contract). The taxpayer
 * details are per-request because they are not extracted from documents;
 * additionalCreditPoints is the reviewer-verified total (children/degree/
 * oleh tables land in a later plan) in units of 0.25.
 */
export const CalculateRequestSchema = z.object({
  taxpayer: z.object({
    gender: z.enum(['male', 'female']),
    isIsraeliResident: z.boolean().default(true),
    additionalCreditPoints: z.number().min(0).multipleOf(0.25).default(0),
  }),
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
