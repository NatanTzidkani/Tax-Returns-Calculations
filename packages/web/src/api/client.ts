import type { CharityReceipt, Form106, Form867 } from '@taxreturns/shared';

/**
 * Typed fetch client for the TaxReturns API.
 *
 * All requests go through the `/api` prefix; the Vite dev server proxies
 * `/api/*` to the Fastify API (VITE_API_PROXY_TARGET, default :3000) and
 * strips the prefix. Document payload shapes come from `@taxreturns/shared`
 * — never redefine them here.
 */

/** Matches the `tax_year_status` pg enum in packages/api. */
export type TaxYearStatus = 'draft' | 'in_review' | 'ready_to_file' | 'filed' | 'amended';

/** Matches the `document_kind` pg enum in packages/api. */
export type DocumentKind = 'form106' | 'form867' | 'charity_receipt' | 'other';

/** Matches the `extraction_status` pg enum in packages/api. */
export type ExtractionStatus = 'pending' | 'extracted' | 'confirmed' | 'failed';

export interface TaxYear {
  id: string;
  year: number;
  status: TaxYearStatus;
  /** ISO timestamp or null */
  deadline?: string | null;
  filedAt?: string | null;
  /** Latest calculation's refund in integer agorot; null/absent until one exists. */
  refundEstimateAgorot?: number | null;
}

export interface TaxDocument {
  id: string;
  taxYearId: string;
  kind: DocumentKind;
  originalFilename: string;
  /** ISO timestamp */
  uploadedAt: string;
  extractionStatus: ExtractionStatus;
  extractionError?: string | null;
}

/** Confirmed-data payload: one of the shared document schemas. */
export type DocumentPayload = Form106 | Form867 | CharityReceipt;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, init);
  if (!response.ok) {
    throw new ApiError(response.status, await response.text());
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export function listTaxYears(): Promise<TaxYear[]> {
  return request<TaxYear[]>('/tax-years');
}

export function createTaxYear(year: number): Promise<TaxYear> {
  return request<TaxYear>('/tax-years', jsonInit('POST', { year }));
}

export function listDocuments(taxYearId: string): Promise<TaxDocument[]> {
  return request<TaxDocument[]>(`/tax-years/${taxYearId}/documents`);
}

export function uploadDocument(
  taxYearId: string,
  file: File,
  kind: DocumentKind,
): Promise<TaxDocument> {
  const form = new FormData();
  form.append('file', file);
  form.append('kind', kind);
  return request<TaxDocument>(`/tax-years/${taxYearId}/documents`, {
    method: 'POST',
    body: form,
  });
}

export function extractDocument(documentId: string): Promise<TaxDocument> {
  return request<TaxDocument>(`/documents/${documentId}/extract`, { method: 'POST' });
}

export function getDocument(documentId: string): Promise<TaxDocument> {
  return request<TaxDocument>(`/documents/${documentId}`);
}

export function confirmDocument(
  documentId: string,
  payload: DocumentPayload,
): Promise<TaxDocument> {
  return request<TaxDocument>(
    `/documents/${documentId}/confirm`,
    jsonInit('POST', { payload }),
  );
}
