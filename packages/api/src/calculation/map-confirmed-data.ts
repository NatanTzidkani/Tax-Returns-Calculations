import {
  agorot,
  documentSchemas,
  type CalculateRequest,
} from '@taxreturns/shared';
import type {
  BrokerEntryInput,
  DonationInput,
  SalaryInput,
  TaxYearInput,
} from '@taxreturns/tax-engine';

/** One document's latest confirmed payload, as stored in confirmed_data. */
export interface ConfirmedDocumentInput {
  kind: 'form106' | 'form867' | 'charity_receipt' | 'other';
  payload: unknown;
}

export interface MappedConfirmedData {
  input: TaxYearInput;
  /** Receipts without a §46 approval — excluded from the engine input. */
  excludedDonations: number;
}

/**
 * Only Form 106 box codes documented in this repo are mapped
 * (packages/shared/src/documents/form106.ts): 158 gross salary, 042 income
 * tax withheld, 045 employee pension contributions. A missing box means the
 * form simply doesn't have that line — mapped to 0, never invented.
 */
const FORM106_BOXES = {
  grossSalary: '158',
  taxWithheld: '042',
  pensionEmployeeContribution: '045',
} as const;

/**
 * Maps the latest confirmed payload of each of a tax year's documents into
 * the engine's TaxYearInput (CLAUDE.md: the engine's ONLY input is
 * confirmed_data). Payloads are re-validated against the shared Zod schemas
 * — they were validated at confirm time, so a failure here means corrupt
 * data and throws loudly rather than defaulting a number.
 */
export function mapConfirmedData(opts: {
  year: number;
  taxpayer: CalculateRequest['taxpayer'];
  documents: ConfirmedDocumentInput[];
  /** Sum of open loss_carryforward rows from earlier years, integer agorot. */
  lossCarryforwardInAgorot: number;
}): MappedConfirmedData {
  const salaries: SalaryInput[] = [];
  const donations: DonationInput[] = [];
  const entries: BrokerEntryInput[] = [];
  let excludedDonations = 0;

  for (const doc of opts.documents) {
    switch (doc.kind) {
      case 'form106': {
        const form = documentSchemas.form106.parse(doc.payload);
        salaries.push({
          employerName: form.employerName,
          grossSalaryAgorot: agorot(form.boxes[FORM106_BOXES.grossSalary] ?? 0),
          taxWithheldAgorot: agorot(form.boxes[FORM106_BOXES.taxWithheld] ?? 0),
          pensionEmployeeContributionAgorot: agorot(
            form.boxes[FORM106_BOXES.pensionEmployeeContribution] ?? 0,
          ),
          // niEmployeeWithheldAgorot stays undefined — no documented box.
        });
        break;
      }
      case 'form867': {
        const form = documentSchemas.form867.parse(doc.payload);
        entries.push({
          brokerName: form.brokerName,
          realGainAgorot: agorot(form.realGainsAgorot),
          realLossAgorot: agorot(form.realLossesAgorot),
          interestDividendAgorot: agorot(form.interestDividendAgorot),
          taxWithheldAgorot: agorot(form.taxWithheldAgorot),
        });
        break;
      }
      case 'charity_receipt': {
        const receipt = documentSchemas.charity_receipt.parse(doc.payload);
        // No §46 approval → no credit; excluded but surfaced to the UI.
        if (!receipt.hasSection46Approval) {
          excludedDonations += 1;
          break;
        }
        donations.push({
          institutionName: receipt.institutionName,
          amountAgorot: agorot(receipt.amountAgorot),
        });
        break;
      }
      case 'other':
        break; // no data schema — never feeds the engine
    }
  }

  return {
    input: {
      year: opts.year,
      taxpayer: opts.taxpayer,
      salaries,
      donations,
      capital: {
        entries,
        lossCarryforwardInAgorot: agorot(opts.lossCarryforwardInAgorot),
      },
    },
    excludedDonations,
  };
}
