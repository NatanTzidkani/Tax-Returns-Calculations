import { CharityReceiptSchema } from './charity-receipt';
import { Form106Schema } from './form106';
import { Form867Schema } from './form867';

/** Document kinds that support AI extraction / structured confirmation. */
export const documentSchemas = {
  form106: Form106Schema,
  form867: Form867Schema,
  charity_receipt: CharityReceiptSchema,
} as const;

export type ExtractableDocumentKind = keyof typeof documentSchemas;
