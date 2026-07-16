import { z } from 'zod';
import {
  AliyahInputSchema,
  DegreeInputSchema,
  ParentContextSchema,
} from './calculation';

/**
 * Stored taxpayer profile — YEAR-INDEPENDENT facts only, used solely to
 * PRE-FILL the worksheet taxpayer form. Never merged server-side into a
 * calculation: the engine consumes the per-request reviewer-submitted body
 * and snapshots store that full input (plan:
 * docs/superpowers/plans/2026-07-14-taxpayer-profile.md).
 *
 * Deliberate difference from `CalculateRequestSchema.taxpayer`: children
 * carry `yearOfBirth` (year-independent), NOT `ageInTaxYear` — the UI
 * derives `ageInTaxYear = taxYear - yearOfBirth` at pre-fill time, flagged
 * for reviewer confirmation. `additionalCreditPoints`, `nonLinkedInterest*`,
 * and the טופס 116ד deferral flags are per-year by nature and are NOT
 * stored. Both objects are `.strict()` so a persisted year-dependent field
 * is a loud 400 at save time, not silent stored drift.
 *
 * Validation is STRUCTURAL ONLY (same rule as the calculation schemas):
 * yearOfBirth bounds are absurdity guards, not a legal rule — the statutory
 * 0-18 domain stays owned by `ChildInputSchema`/the engine at calculate
 * time.
 */
export const TaxpayerProfileSchema = z
  .object({
    gender: z.enum(['male', 'female']),
    isIsraeliResident: z.boolean().default(true),
    children: z
      .array(
        z
          .object({
            /** Calendar birth year (absurdity bounds only). */
            yearOfBirth: z.number().int().min(1900).max(2100),
            /** §40(ב)(2) share — semi-stable, stored as a suggestion the
             *  reviewer confirms each year (plan owner-decide item). */
            maintenanceShare: z.number().min(0).max(1).optional(),
          })
          .strict(),
      )
      .optional(),
    /** Filer-level allocation context (il-0.6.0+ shape). The regime can
     *  change between years; pre-fill is a suggestion the reviewer edits. */
    parentContext: ParentContextSchema.optional(),
    aliyah: AliyahInputSchema.optional(),
    degrees: z.array(DegreeInputSchema).optional(),
  })
  .strict();

export type TaxpayerProfile = z.infer<typeof TaxpayerProfileSchema>;
