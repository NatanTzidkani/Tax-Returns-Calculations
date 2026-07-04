import { z } from 'zod';

const agorotAmount = z.number().int('amounts are integer agorot').min(0);

/**
 * Form 867 (broker/bank annual capital-market summary), already aggregated
 * to yearly totals per broker. Field names align 1:1 with the tax engine's
 * BrokerEntryInput so confirmed payloads map straight into calculations.
 * All amounts are integer agorot, losses as positive numbers.
 */
export const Form867Schema = z.object({
  taxYear: z.number().int().min(2020).max(2100),
  brokerName: z.string().min(1),
  /** Account / portfolio number as printed, if present */
  accountId: z.string().min(1).optional(),
  /** Real (inflation-adjusted) capital gains */
  realGainsAgorot: agorotAmount,
  /** Realized real capital losses, as a positive number */
  realLossesAgorot: agorotAmount,
  /** Interest + dividend income from securities */
  interestDividendAgorot: agorotAmount,
  /** Capital-market tax withheld by this broker */
  taxWithheldAgorot: agorotAmount,
  /** Field names the extractor was unsure about; highlighted in review UI */
  uncertainFields: z.array(z.string()).default([]),
});

export type Form867 = z.infer<typeof Form867Schema>;
