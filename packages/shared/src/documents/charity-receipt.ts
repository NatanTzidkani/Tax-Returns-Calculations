import { z } from 'zod';

/**
 * Charity donation receipt (קבלה על תרומה) for the section 46 credit.
 * Amounts are integer agorot.
 */
export const CharityReceiptSchema = z.object({
  taxYear: z.number().int().min(2020).max(2100),
  institutionName: z.string().min(1),
  /** מספר עמותה (רשם העמותות) — 9 digits, if printed */
  institutionRegistrationId: z.string().regex(/^\d{9}$/).optional(),
  receiptNumber: z.string().min(1).optional(),
  amountAgorot: z.number().int('amounts are integer agorot').positive(),
  /** ISO date (YYYY-MM-DD) as printed on the receipt */
  donationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** Whether the receipt states a section 46 approval (אישור לפי סעיף 46) */
  hasSection46Approval: z.boolean(),
  /** Field names the extractor was unsure about; highlighted in review UI */
  uncertainFields: z.array(z.string()).default([]),
});

export type CharityReceipt = z.infer<typeof CharityReceiptSchema>;
