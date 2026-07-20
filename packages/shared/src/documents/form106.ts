import { z } from 'zod';

const boxCode = z.string().regex(/^\d{3}$/, 'Form 106 box codes are 3 digits');
const agorotAmount = z.number().int('amounts are integer agorot').min(0);

/**
 * Form 106 (annual employer salary summary).
 * Box keys are the printed numeric codes (042 = income tax withheld,
 * 158 = gross income, 045 = employee pension contributions, ...).
 * All amounts are integer agorot.
 */
export const Form106Schema = z.object({
  taxYear: z.number().int().min(2020).max(2100),
  employerName: z.string().min(1),
  /** תיק ניכויים — employer deductions file number, 9 digits */
  employerDeductionsFileId: z.string().regex(/^\d{9}$/),
  /** תעודת זהות — employee national ID, 9 digits (leading zeros kept) */
  employeeNationalId: z.string().regex(/^\d{9}$/),
  boxes: z.record(boxCode, agorotAmount),
  /** Box codes the extractor was unsure about; highlighted in review UI */
  uncertainBoxes: z.array(boxCode).default([]),
});

export type Form106 = z.infer<typeof Form106Schema>;
