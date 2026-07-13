import type {
  AuthUser,
  CalculateRequestSchema,
  CharityReceipt,
  Form106,
  Form867,
  TaxYearStatusUpdate,
} from '@taxreturns/shared';
import type { TaxReturnResult, TaxYearInput } from '@taxreturns/tax-engine';
import type { z } from 'zod';

/**
 * Wire body of POST /tax-years/:id/calculate — the schema's INPUT side
 * (isIsraeliResident/additionalCreditPoints optional; the server applies the
 * shared defaults). The schema stays the single source of truth.
 */
export type CalculateRequestBody = z.input<typeof CalculateRequestSchema>;

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

/** `GET /documents/:id` — the document plus its latest payloads. */
export interface DocumentDetail extends TaxDocument {
  extractedPayload: DocumentPayload | null;
  confirmedPayload: DocumentPayload | null;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * API errors are Hebrew `{ message }` JSON bodies (see packages/api); pull the
 * message out so the UI can show it verbatim. Falls back to the raw body text
 * for anything that isn't that shape (proxy errors, plain-text 500s…).
 */
async function errorMessage(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const parsed: unknown = JSON.parse(text);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'message' in parsed &&
      typeof (parsed as { message: unknown }).message === 'string'
    ) {
      return (parsed as { message: string }).message;
    }
  } catch {
    // Not JSON — fall through to the raw text.
  }
  return text;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, { credentials: 'same-origin', ...init });
  if (!response.ok) {
    throw new ApiError(response.status, await errorMessage(response));
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

/**
 * `DELETE /tax-years/:id`. Resolves on the API's 204; a missing year comes
 * back as a 404 with a Hebrew message (surfaced via ApiError). Deletes the
 * year and all its documents/calculations server-side.
 */
export function deleteTaxYear(taxYearId: string): Promise<void> {
  return request<void>(`/tax-years/${taxYearId}`, { method: 'DELETE' });
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

export function getDocument(documentId: string): Promise<DocumentDetail> {
  return request<DocumentDetail>(`/documents/${documentId}`);
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

export function signInWithGoogle(credential: string): Promise<AuthUser> {
  return request<AuthUser>('/auth/google', jsonInit('POST', { credential }));
}

/**
 * Resolves the signed-in user, or `null` if there isn't one. A 401 from
 * `/auth/me` is the expected "not signed in" state, not a failure — it's
 * caught here so callers never have to know the transport detail.
 */
export async function getMe(): Promise<AuthUser | null> {
  try {
    return await request<AuthUser>('/auth/me');
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }
    throw error;
  }
}

export function signOut(): Promise<void> {
  return request<void>('/auth/logout', { method: 'POST' });
}

// --- Plan 5: calculation snapshots + year status flow ------------------------

/**
 * One append-only `calculations` row as `GET /tax-years/:id/calculation`
 * returns it (plus the computed `stale` flag). `input`/`result` are the
 * engine's own types from `@taxreturns/tax-engine` — never redefined here.
 */
export interface CalculationSnapshot {
  id: string;
  taxYearId: string;
  engineVersion: string;
  input: TaxYearInput;
  result: TaxReturnResult;
  /** ISO timestamp */
  createdAt: string;
  /** True when a document was re-confirmed after this snapshot was taken. */
  stale: boolean;
}

/**
 * `POST /tax-years/:id/calculate` response — a fresh snapshot plus mapping
 * metadata (how many §46-unapproved receipts were excluded from the engine
 * input). The POST body validates against the shared `CalculateRequestSchema`.
 */
export interface CalculateResponse {
  id: string;
  taxYearId: string;
  engineVersion: string;
  input: TaxYearInput;
  result: TaxReturnResult;
  /** ISO timestamp */
  createdAt: string;
  metadata: { excludedDonations: number };
}

export function calculateTaxYear(
  taxYearId: string,
  body: CalculateRequestBody,
): Promise<CalculateResponse> {
  return request<CalculateResponse>(
    `/tax-years/${taxYearId}/calculate`,
    jsonInit('POST', body),
  );
}

/**
 * Latest calculation for the year, or `null` when there is none yet (the
 * API's 404 is the expected "no calculation" state, mirroring `getMe`).
 */
export async function getCalculation(
  taxYearId: string,
): Promise<CalculationSnapshot | null> {
  try {
    return await request<CalculationSnapshot>(`/tax-years/${taxYearId}/calculation`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * `PATCH /tax-years/:id/status`. Illegal transitions come back as a 400 with
 * a Hebrew message (surfaced via ApiError); the UI should only offer legal
 * next steps to begin with.
 */
export function updateTaxYearStatus(
  taxYearId: string,
  status: TaxYearStatus,
): Promise<TaxYear> {
  const body: TaxYearStatusUpdate = { status };
  return request<TaxYear>(`/tax-years/${taxYearId}/status`, jsonInit('PATCH', body));
}
