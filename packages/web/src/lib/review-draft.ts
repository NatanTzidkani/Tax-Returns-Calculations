import type { CharityReceipt, Form106, Form867 } from '@taxreturns/shared';

// ---------------------------------------------------------------------------
// Review-screen draft persistence (plan
// docs/superpowers/plans/2026-07-17-review-autosave-drafts.md, spec §9.3
// "User input is never lost. Review edits autosave as drafts").
//
// Pure module: kind-specific RAW form state (the input strings as typed —
// an in-progress edit is usually not yet schema-valid, so drafts must not
// require parseability; agorot conversion still happens only at confirm
// through the shared Zod schemas), payload→form-state derivations shared by
// the screen and the draft restore, and localStorage records keyed by
// document id + a record-schema version, carrying a fingerprint of the base
// payload so a draft saved against an older extraction can never silently
// overwrite a fresh one.
//
// Phase-1 decision of record: localStorage (single-user, single-browser)
// covers exactly the reload/navigation loss mode with zero new API surface;
// server-side drafts are the multi-device future alternative — this module
// is the seam to swap.
// ---------------------------------------------------------------------------

/** Document kinds that have a review form (everything but 'other'). */
export type ReviewableKind = 'form106' | 'form867' | 'charity_receipt';

export type ReviewPayload = Form106 | Form867 | CharityReceipt;

export const FORM867_MONEY_FIELDS = [
  'realGainsAgorot',
  'realLossesAgorot',
  'interestDividendAgorot',
  'taxWithheldAgorot',
] as const;

export type Form867MoneyField = (typeof FORM867_MONEY_FIELDS)[number];

export interface BoxRow {
  code: string;
  amountShekels: string;
}

export interface Form106FormState {
  taxYear: string;
  employerName: string;
  deductionsFileId: string;
  nationalId: string;
  rows: BoxRow[];
}

export interface Form867FormState {
  taxYear: string;
  brokerName: string;
  accountId: string;
  amounts: Record<Form867MoneyField, string>;
}

export interface CharityFormState {
  taxYear: string;
  institutionName: string;
  registrationId: string;
  receiptNumber: string;
  amountShekels: string;
  donationDate: string;
  hasApproval: boolean;
}

export type ReviewFormState = Form106FormState | Form867FormState | CharityFormState;

/** Display integer agorot as a shekel string for editing (e.g. 308625 → "3086.25"). */
export function agorotToShekelString(value: number | undefined): string {
  return value === undefined ? '' : String(value / 100);
}

// --- payload → raw form state (single derivation for screen AND drafts) ----

export function form106FormState(payload: Form106 | null): Form106FormState {
  return {
    taxYear: payload ? String(payload.taxYear) : '',
    employerName: payload?.employerName ?? '',
    deductionsFileId: payload?.employerDeductionsFileId ?? '',
    nationalId: payload?.employeeNationalId ?? '',
    rows: payload
      ? Object.entries(payload.boxes).map(([code, amount]) => ({
          code,
          amountShekels: agorotToShekelString(amount),
        }))
      : [{ code: '', amountShekels: '' }],
  };
}

export function form867FormState(payload: Form867 | null): Form867FormState {
  return {
    taxYear: payload ? String(payload.taxYear) : '',
    brokerName: payload?.brokerName ?? '',
    accountId: payload?.accountId ?? '',
    amounts: {
      realGainsAgorot: agorotToShekelString(payload?.realGainsAgorot),
      realLossesAgorot: agorotToShekelString(payload?.realLossesAgorot),
      interestDividendAgorot: agorotToShekelString(payload?.interestDividendAgorot),
      taxWithheldAgorot: agorotToShekelString(payload?.taxWithheldAgorot),
    },
  };
}

export function charityFormState(payload: CharityReceipt | null): CharityFormState {
  return {
    taxYear: payload ? String(payload.taxYear) : '',
    institutionName: payload?.institutionName ?? '',
    registrationId: payload?.institutionRegistrationId ?? '',
    receiptNumber: payload?.receiptNumber ?? '',
    amountShekels: agorotToShekelString(payload?.amountAgorot),
    donationDate: payload?.donationDate ?? '',
    hasApproval: payload?.hasSection46Approval ?? false,
  };
}

export function formStateFromPayload(
  kind: ReviewableKind,
  payload: ReviewPayload | null,
): ReviewFormState {
  switch (kind) {
    case 'form106':
      return form106FormState(payload as Form106 | null);
    case 'form867':
      return form867FormState(payload as Form867 | null);
    case 'charity_receipt':
      return charityFormState(payload as CharityReceipt | null);
  }
}

// --- fingerprint (the re-extraction guard) ---------------------------------

/**
 * Deterministic sorted-key stringify — equality is the only question, so no
 * crypto. Undefined-valued keys are skipped to match JSON round-trip
 * semantics.
 */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.keys(value)
      .sort()
      .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`,
      );
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

/**
 * Fingerprint of the payload an edit session started from (extracted OR
 * confirmed OR null for manual entry). A stored draft whose fingerprint no
 * longer matches the current server payload was saved against an older
 * extraction and must not silently overwrite the fresh one.
 */
export function fingerprintPayload(payload: ReviewPayload | null): string {
  return stableStringify(payload);
}

export function formStatesEqual(a: ReviewFormState, b: ReviewFormState): boolean {
  return stableStringify(a) === stableStringify(b);
}

// --- stored record ---------------------------------------------------------

/** Debounce for autosave writes; the hook flushes pending edits on unmount. */
export const DRAFT_DEBOUNCE_MS = 300;

/**
 * Retention window for an abandoned autosave draft (30 days). A draft is
 * edited-but-never-confirmed local state carrying PII (national ID, salary);
 * past this window the read-back path treats it as expired, deletes it, and
 * restores nothing — so stale PII cannot linger indefinitely in localStorage.
 */
export const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * The `v1` is the draft-record schema version: an unknown/old record shape
 * is treated as no draft and removed, never guessed at.
 */
export function draftStorageKey(documentId: string): string {
  return `taxreturns.reviewDraft.v1.${documentId}`;
}

export interface StoredReviewDraft {
  version: 1;
  kind: ReviewableKind;
  baseFingerprint: string;
  /** The raw input strings as typed — NOT a parsed payload. */
  form: ReviewFormState;
  /** ISO timestamp */
  savedAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isForm106FormState(value: unknown): value is Form106FormState {
  return (
    isRecord(value) &&
    isString(value.taxYear) &&
    isString(value.employerName) &&
    isString(value.deductionsFileId) &&
    isString(value.nationalId) &&
    Array.isArray(value.rows) &&
    value.rows.every(
      (row: unknown) =>
        isRecord(row) && isString(row.code) && isString(row.amountShekels),
    )
  );
}

function isForm867FormState(value: unknown): value is Form867FormState {
  return (
    isRecord(value) &&
    isString(value.taxYear) &&
    isString(value.brokerName) &&
    isString(value.accountId) &&
    isRecord(value.amounts) &&
    FORM867_MONEY_FIELDS.every((field) =>
      isString((value.amounts as Record<string, unknown>)[field]),
    )
  );
}

function isCharityFormState(value: unknown): value is CharityFormState {
  return (
    isRecord(value) &&
    isString(value.taxYear) &&
    isString(value.institutionName) &&
    isString(value.registrationId) &&
    isString(value.receiptNumber) &&
    isString(value.amountShekels) &&
    isString(value.donationDate) &&
    typeof value.hasApproval === 'boolean'
  );
}

function isFormStateFor(kind: ReviewableKind, form: unknown): form is ReviewFormState {
  switch (kind) {
    case 'form106':
      return isForm106FormState(form);
    case 'form867':
      return isForm867FormState(form);
    case 'charity_receipt':
      return isCharityFormState(form);
  }
}

function isStoredReviewDraft(value: unknown): value is StoredReviewDraft {
  return (
    isRecord(value) &&
    value.version === 1 &&
    (value.kind === 'form106' ||
      value.kind === 'form867' ||
      value.kind === 'charity_receipt') &&
    isString(value.baseFingerprint) &&
    isString(value.savedAt) &&
    isFormStateFor(value.kind, value.form)
  );
}

/**
 * A draft is expired once its `savedAt` is older than `DRAFT_TTL_MS`. An
 * unparseable savedAt (NaN) is treated as expired too — an unreadable
 * timestamp is not trusted to keep PII around.
 */
function isExpiredDraft(draft: StoredReviewDraft): boolean {
  const savedAtMs = Date.parse(draft.savedAt);
  if (Number.isNaN(savedAtMs)) return true;
  return Date.now() - savedAtMs > DRAFT_TTL_MS;
}

/**
 * Load the stored draft for a document. Anything unreadable (corrupt JSON,
 * unknown version, form shape not matching its kind) or expired past
 * `DRAFT_TTL_MS` is treated as no draft and removed — never guessed at.
 * Reading is idempotent, so this is safe under StrictMode double-invocation.
 */
export function loadStoredDraft(documentId: string): StoredReviewDraft | null {
  const key = draftStorageKey(documentId);
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return null;
  }
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isStoredReviewDraft(parsed) && !isExpiredDraft(parsed)) return parsed;
  } catch {
    // Corrupt JSON — fall through to removal.
  }
  // Corrupt, wrong-shape, or expired (incl. unparseable savedAt): remove and
  // surface nothing — same disposition, never guessed at.
  clearStoredDraft(documentId);
  return null;
}

/**
 * Best-effort write: a quota/unavailability failure loses only the draft
 * convenience — the transactional confirm stays the sole source of truth.
 */
export function saveStoredDraft(documentId: string, draft: StoredReviewDraft): void {
  try {
    localStorage.setItem(draftStorageKey(documentId), JSON.stringify(draft));
  } catch {
    // Storage unavailable/full — drafts are best-effort by design.
  }
}

export function clearStoredDraft(documentId: string): void {
  try {
    localStorage.removeItem(draftStorageKey(documentId));
  } catch {
    // Storage unavailable — nothing to clear.
  }
}

export function makeStoredDraft(
  kind: ReviewableKind,
  basePayload: ReviewPayload | null,
  form: ReviewFormState,
): StoredReviewDraft {
  return {
    version: 1,
    kind,
    baseFingerprint: fingerprintPayload(basePayload),
    form,
    savedAt: new Date().toISOString(),
  };
}

// --- restore decision ------------------------------------------------------

export type DraftNotice = 'restored' | 'staleDropped';

export interface DraftResolution {
  initialForm: ReviewFormState;
  notice: DraftNotice | null;
  /**
   * True when a VALID stored draft should be deleted (stale fingerprint,
   * equal to the server values, or a kind mismatch). Kept as a flag instead
   * of deleting here so the React hook can resolve purely in a lazy
   * initializer and apply the removal in a mount effect (StrictMode-safe).
   */
  dropStored: boolean;
}

export function resolveDraft(
  documentId: string,
  kind: ReviewableKind,
  basePayload: ReviewPayload | null,
  serverForm: ReviewFormState,
): DraftResolution {
  const stored = loadStoredDraft(documentId);
  if (stored === null) {
    return { initialForm: serverForm, notice: null, dropStored: false };
  }
  if (stored.kind !== kind) {
    // A draft for a different document kind can only be a foreign record —
    // treat as no draft.
    return { initialForm: serverForm, notice: null, dropStored: true };
  }
  if (stored.baseFingerprint !== fingerprintPayload(basePayload)) {
    // Saved against an older extraction — the fresh extraction wins, loudly.
    return { initialForm: serverForm, notice: 'staleDropped', dropStored: true };
  }
  if (formStatesEqual(stored.form, serverForm)) {
    // Nothing actually changed — restore nothing, clean up silently.
    return { initialForm: serverForm, notice: null, dropStored: true };
  }
  return { initialForm: stored.form, notice: 'restored', dropStored: false };
}
