import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router';
import {
  CharityReceiptSchema,
  Form106Schema,
  Form867Schema,
  shekelsToAgorot,
  type CharityReceipt,
  type Form106,
  type Form867,
} from '@taxreturns/shared';
import { Label } from 'radix-ui';
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  confirmDocument,
  type DocumentDetail,
  type DocumentPayload,
  extractDocument,
  getDocument,
} from '../api/client';
import { ExtractionStatusChip } from '../components/StatusChip';
import {
  type BoxRow,
  type CharityFormState,
  clearStoredDraft,
  DRAFT_DEBOUNCE_MS,
  type DraftNotice,
  FORM867_MONEY_FIELDS,
  type Form106FormState,
  type Form867FormState,
  formStateFromPayload,
  formStatesEqual,
  makeStoredDraft,
  resolveDraft,
  type ReviewableKind,
  type ReviewFormState,
  type ReviewPayload,
  saveStoredDraft,
} from '../lib/review-draft';

const route = getRouteApi('/tax-years/$taxYearId/documents/$documentId');

const labelClasses = 'text-sm font-medium text-neutral-700 dark:text-neutral-300';

const fieldBaseClasses =
  'rounded-md border px-2.5 py-1.5 text-sm shadow-sm transition-colors focus:border-blue-600 ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 ' +
  'disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-neutral-950';

const fieldClasses =
  `${fieldBaseClasses} border-neutral-300 bg-white text-neutral-900 ` +
  'dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100';

/** Amber treatment for fields the extractor flagged as uncertain. */
const uncertainFieldClasses =
  `${fieldBaseClasses} border-amber-500 bg-amber-50 text-neutral-900 ` +
  'dark:border-amber-500 dark:bg-amber-950/40 dark:text-neutral-100';

const uncertainRowClasses =
  'rounded-md border border-amber-500 bg-amber-50 p-2 dark:border-amber-500 dark:bg-amber-950/40';

const primaryButtonClasses =
  'inline-flex items-center justify-center rounded-md bg-blue-700 px-4 py-1.5 text-sm font-medium text-white ' +
  'shadow-sm transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50 ' +
  'dark:bg-blue-600 dark:hover:bg-blue-500';

const secondaryButtonClasses =
  'inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-3 py-1.5 ' +
  'text-sm font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-100 ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ' +
  'disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 ' +
  'dark:text-neutral-200 dark:hover:bg-neutral-800';

const alertClasses =
  'rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 ' +
  'dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300';

const mutedTextClasses = 'text-sm text-neutral-500 dark:text-neutral-400';

const panelClasses =
  'rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-6';

const panelHeadingClasses = 'text-base font-semibold text-neutral-900 dark:text-neutral-100';

const uncertainLegendClasses =
  'rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 ' +
  'dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200';

/** Informational (non-error) treatment for the draft notices — spec §9.3. */
const draftNoticeClasses =
  'rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 ' +
  'dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200';

const linkClasses =
  'font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300';

/** Box codes with meanings documented in packages/shared/src/documents/form106.ts. */
const DOCUMENTED_BOX_CODES = ['158', '042', '045'] as const;

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

/**
 * Parse a shekel input string into integer agorot. Empty/garbage input maps
 * to NaN so the shared Zod schema rejects it — never a silent 0.
 */
function shekelInputToAgorot(value: string): number {
  const trimmed = value.trim();
  if (trimmed === '') return Number.NaN;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return Number.NaN;
  try {
    return shekelsToAgorot(parsed);
  } catch {
    // Finite but beyond the safe-integer range (e.g. "1e20") — feed the
    // schema a NaN so it rejects like any other bad amount instead of an
    // uncaught throw killing the submit handler with no UI feedback.
    return Number.NaN;
  }
}

function parseYear(value: string): number {
  const trimmed = value.trim();
  return trimmed === '' ? Number.NaN : Number(trimmed);
}

// --- file viewer -----------------------------------------------------------

function FileViewer({ documentId, filename }: { documentId: string; filename: string }) {
  const { t } = useTranslation();
  const [zoom, setZoom] = useState(100);
  const src = `/api/documents/${documentId}/file`;
  const dotIndex = filename.lastIndexOf('.');
  const extension = dotIndex === -1 ? '' : filename.slice(dotIndex).toLowerCase();
  const previewTitle = t('documentReview.filePreview', { filename });

  if (IMAGE_EXTENSIONS.includes(extension)) {
    return (
      <div className="mt-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setZoom((current) => Math.max(100, current - 50))}
            disabled={zoom <= 100}
            className={secondaryButtonClasses}
          >
            {t('documentReview.zoomOut')}
          </button>
          <button
            type="button"
            onClick={() => setZoom((current) => Math.min(200, current + 50))}
            disabled={zoom >= 200}
            className={secondaryButtonClasses}
          >
            {t('documentReview.zoomIn')}
          </button>
          <span className={mutedTextClasses}>{zoom}%</span>
        </div>
        <div className="max-h-[70vh] overflow-auto rounded-md border border-neutral-200 dark:border-neutral-800">
          <img src={src} alt={previewTitle} style={{ width: `${zoom}%`, maxWidth: 'none' }} />
        </div>
      </div>
    );
  }

  if (extension === '.pdf') {
    return (
      <iframe
        src={src}
        title={previewTitle}
        className="mt-4 h-[70vh] w-full rounded-md border border-neutral-200 dark:border-neutral-800"
      />
    );
  }

  return (
    <p className={`mt-4 ${mutedTextClasses}`}>
      <a href={src} target="_blank" rel="noreferrer" className={linkClasses}>
        {t('documentReview.openFile')}
      </a>
    </p>
  );
}

// --- shared form scaffolding ------------------------------------------------

interface ReviewFormProps<P, F extends ReviewFormState> {
  /** Server payload — used only for the uncertain-field highlighting. */
  initial: P | null;
  /**
   * Raw form state to start from: the server-derived derivation from
   * lib/review-draft (single derivation shared with drafts) OR a restored
   * draft. The form owns its state after mount; a remount (key bump)
   * resets it.
   */
  initialForm: F;
  /** Reports the FULL raw form state on every change (draft autosave). */
  onFormChange: (form: F) => void;
  readOnly: boolean;
  onConfirm: (payload: DocumentPayload) => void;
  confirmPending: boolean;
  confirmFailed: boolean;
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label.Root htmlFor={id} className={labelClasses}>
        {label}
      </Label.Root>
      {children}
    </div>
  );
}

function FormActions({
  readOnly,
  invalid,
  confirmPending,
  confirmFailed,
}: {
  readOnly: boolean;
  invalid: boolean;
  confirmPending: boolean;
  confirmFailed: boolean;
}) {
  const { t } = useTranslation();
  if (readOnly) return null;
  return (
    <div className="flex flex-col gap-3">
      {invalid ? (
        <p role="alert" className={alertClasses}>
          {t('documentReview.invalidForm')}
        </p>
      ) : null}
      {confirmFailed ? (
        <p role="alert" className={alertClasses}>
          {t('documentReview.confirmError')}
        </p>
      ) : null}
      <div>
        <button type="submit" disabled={confirmPending} className={primaryButtonClasses}>
          {t('documentReview.confirm')}
        </button>
      </div>
    </div>
  );
}

// --- Form 106 ---------------------------------------------------------------

function Form106Form({
  initial,
  initialForm,
  onFormChange,
  readOnly,
  onConfirm,
  confirmPending,
  confirmFailed,
}: ReviewFormProps<Form106, Form106FormState>) {
  const { t } = useTranslation();
  const uncertainBoxes = initial?.uncertainBoxes ?? [];
  const [form, setForm] = useState(initialForm);
  const [invalid, setInvalid] = useState(false);
  const [duplicateCode, setDuplicateCode] = useState<string | null>(null);

  function update(patch: Partial<Form106FormState>) {
    const next = { ...form, ...patch };
    setForm(next);
    onFormChange(next);
  }

  function updateRow(index: number, patch: Partial<BoxRow>) {
    update({
      rows: form.rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const activeRows = form.rows.filter(
      (row) => row.code.trim() !== '' || row.amountShekels.trim() !== '',
    );

    // Folding rows into a record keeps only the LAST entry per code — a
    // duplicate code would silently drop an amount from confirmed_data (the
    // tax engine's only input), so refuse it loudly before parsing.
    const codes = activeRows.map((row) => row.code.trim());
    const duplicate = codes.find((code, i) => code !== '' && codes.indexOf(code) !== i);
    if (duplicate) {
      setDuplicateCode(duplicate);
      setInvalid(false);
      return;
    }
    setDuplicateCode(null);

    const candidate = {
      taxYear: parseYear(form.taxYear),
      employerName: form.employerName,
      employerDeductionsFileId: form.deductionsFileId,
      employeeNationalId: form.nationalId,
      boxes: Object.fromEntries(
        activeRows.map((row) => [row.code.trim(), shekelInputToAgorot(row.amountShekels)]),
      ),
    };
    const parsed = Form106Schema.safeParse(candidate);
    if (!parsed.success) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onConfirm(parsed.data);
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-4">
      <Field id="form106-tax-year" label={t('documentReview.fields.taxYear')}>
        <input
          id="form106-tax-year"
          type="number"
          value={form.taxYear}
          onChange={(event) => update({ taxYear: event.target.value })}
          disabled={readOnly}
          className={fieldClasses}
        />
      </Field>
      <Field id="form106-employer-name" label={t('documentReview.fields.employerName')}>
        <input
          id="form106-employer-name"
          type="text"
          value={form.employerName}
          onChange={(event) => update({ employerName: event.target.value })}
          disabled={readOnly}
          className={fieldClasses}
        />
      </Field>
      <Field
        id="form106-deductions-file"
        label={t('documentReview.fields.employerDeductionsFileId')}
      >
        <input
          id="form106-deductions-file"
          type="text"
          value={form.deductionsFileId}
          onChange={(event) => update({ deductionsFileId: event.target.value })}
          disabled={readOnly}
          className={fieldClasses}
        />
      </Field>
      <Field id="form106-national-id" label={t('documentReview.fields.employeeNationalId')}>
        <input
          id="form106-national-id"
          type="text"
          value={form.nationalId}
          onChange={(event) => update({ nationalId: event.target.value })}
          disabled={readOnly}
          className={fieldClasses}
        />
      </Field>

      <fieldset className="flex flex-col gap-3">
        <legend className={`${labelClasses} mb-2`}>{t('documentReview.boxes.title')}</legend>
        {form.rows.map((row, index) => {
          const uncertain = uncertainBoxes.includes(row.code);
          const documented = (DOCUMENTED_BOX_CODES as readonly string[]).includes(
            row.code,
          );
          return (
            <div
              key={index}
              data-uncertain={uncertain ? 'true' : undefined}
              className={
                uncertain
                  ? uncertainRowClasses
                  : 'rounded-md border border-transparent p-2'
              }
            >
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label.Root htmlFor={`box-code-${index}`} className={labelClasses}>
                    {t('documentReview.boxes.codeLabel')}
                  </Label.Root>
                  <input
                    id={`box-code-${index}`}
                    type="text"
                    inputMode="numeric"
                    value={row.code}
                    onChange={(event) => updateRow(index, { code: event.target.value })}
                    disabled={readOnly}
                    className={`w-24 ${uncertain ? uncertainFieldClasses : fieldClasses}`}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label.Root htmlFor={`box-amount-${index}`} className={labelClasses}>
                    {t('documentReview.boxes.amountLabel')}
                  </Label.Root>
                  <input
                    id={`box-amount-${index}`}
                    type="text"
                    inputMode="decimal"
                    value={row.amountShekels}
                    onChange={(event) =>
                      updateRow(index, { amountShekels: event.target.value })
                    }
                    disabled={readOnly}
                    className={`w-32 ${uncertain ? uncertainFieldClasses : fieldClasses}`}
                  />
                </div>
                {row.code.trim() !== '' ? (
                  <span className={`pb-2 ${mutedTextClasses}`}>
                    {documented
                      ? t('documentReview.boxes.labeled', {
                          code: row.code,
                          label: t(`documentReview.boxCodes.${row.code}`),
                        })
                      : t('documentReview.boxes.bare', { code: row.code })}
                  </span>
                ) : null}
                {readOnly ? null : (
                  <button
                    type="button"
                    onClick={() =>
                      update({ rows: form.rows.filter((_, i) => i !== index) })
                    }
                    className={secondaryButtonClasses}
                  >
                    {t('documentReview.boxes.remove')}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {readOnly ? null : (
          <div>
            <button
              type="button"
              onClick={() =>
                update({ rows: [...form.rows, { code: '', amountShekels: '' }] })
              }
              className={secondaryButtonClasses}
            >
              {t('documentReview.boxes.add')}
            </button>
          </div>
        )}
      </fieldset>

      {duplicateCode ? (
        <p role="alert" className={alertClasses}>
          {t('documentReview.duplicateBox', { code: duplicateCode })}
        </p>
      ) : null}

      <FormActions
        readOnly={readOnly}
        invalid={invalid}
        confirmPending={confirmPending}
        confirmFailed={confirmFailed}
      />
    </form>
  );
}

// --- Form 867 ---------------------------------------------------------------

function Form867Form({
  initial,
  initialForm,
  onFormChange,
  readOnly,
  onConfirm,
  confirmPending,
  confirmFailed,
}: ReviewFormProps<Form867, Form867FormState>) {
  const { t } = useTranslation();
  const uncertainFields = initial?.uncertainFields ?? [];
  const [form, setForm] = useState(initialForm);
  const [invalid, setInvalid] = useState(false);

  function update(patch: Partial<Form867FormState>) {
    const next = { ...form, ...patch };
    setForm(next);
    onFormChange(next);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedAccountId = form.accountId.trim();
    const candidate = {
      taxYear: parseYear(form.taxYear),
      brokerName: form.brokerName,
      ...(trimmedAccountId === '' ? {} : { accountId: trimmedAccountId }),
      realGainsAgorot: shekelInputToAgorot(form.amounts.realGainsAgorot),
      realLossesAgorot: shekelInputToAgorot(form.amounts.realLossesAgorot),
      interestDividendAgorot: shekelInputToAgorot(form.amounts.interestDividendAgorot),
      taxWithheldAgorot: shekelInputToAgorot(form.amounts.taxWithheldAgorot),
    };
    const parsed = Form867Schema.safeParse(candidate);
    if (!parsed.success) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onConfirm(parsed.data);
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-4">
      <Field id="form867-tax-year" label={t('documentReview.fields.taxYear')}>
        <input
          id="form867-tax-year"
          type="number"
          value={form.taxYear}
          onChange={(event) => update({ taxYear: event.target.value })}
          disabled={readOnly}
          className={fieldClasses}
        />
      </Field>
      <Field id="form867-broker-name" label={t('documentReview.fields.brokerName')}>
        <input
          id="form867-broker-name"
          type="text"
          value={form.brokerName}
          onChange={(event) => update({ brokerName: event.target.value })}
          disabled={readOnly}
          data-uncertain={uncertainFields.includes('brokerName') ? 'true' : undefined}
          className={
            uncertainFields.includes('brokerName') ? uncertainFieldClasses : fieldClasses
          }
        />
      </Field>
      <Field id="form867-account-id" label={t('documentReview.fields.accountId')}>
        <input
          id="form867-account-id"
          type="text"
          value={form.accountId}
          onChange={(event) => update({ accountId: event.target.value })}
          disabled={readOnly}
          data-uncertain={uncertainFields.includes('accountId') ? 'true' : undefined}
          className={
            uncertainFields.includes('accountId') ? uncertainFieldClasses : fieldClasses
          }
        />
      </Field>
      {FORM867_MONEY_FIELDS.map((field) => {
        const uncertain = uncertainFields.includes(field);
        return (
          <Field key={field} id={`form867-${field}`} label={t(`documentReview.fields.${field}`)}>
            <input
              id={`form867-${field}`}
              type="text"
              inputMode="decimal"
              value={form.amounts[field]}
              onChange={(event) =>
                update({ amounts: { ...form.amounts, [field]: event.target.value } })
              }
              disabled={readOnly}
              data-uncertain={uncertain ? 'true' : undefined}
              className={uncertain ? uncertainFieldClasses : fieldClasses}
            />
          </Field>
        );
      })}
      <FormActions
        readOnly={readOnly}
        invalid={invalid}
        confirmPending={confirmPending}
        confirmFailed={confirmFailed}
      />
    </form>
  );
}

// --- Charity receipt ---------------------------------------------------------

function CharityReceiptForm({
  initial,
  initialForm,
  onFormChange,
  readOnly,
  onConfirm,
  confirmPending,
  confirmFailed,
}: ReviewFormProps<CharityReceipt, CharityFormState>) {
  const { t } = useTranslation();
  const uncertainFields = initial?.uncertainFields ?? [];
  const [form, setForm] = useState(initialForm);
  const [invalid, setInvalid] = useState(false);

  function update(patch: Partial<CharityFormState>) {
    const next = { ...form, ...patch };
    setForm(next);
    onFormChange(next);
  }

  function classesFor(field: string): string {
    return uncertainFields.includes(field) ? uncertainFieldClasses : fieldClasses;
  }

  function uncertainAttr(field: string): 'true' | undefined {
    return uncertainFields.includes(field) ? 'true' : undefined;
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedRegistrationId = form.registrationId.trim();
    const trimmedReceiptNumber = form.receiptNumber.trim();
    const trimmedDate = form.donationDate.trim();
    const candidate = {
      taxYear: parseYear(form.taxYear),
      institutionName: form.institutionName,
      ...(trimmedRegistrationId === ''
        ? {}
        : { institutionRegistrationId: trimmedRegistrationId }),
      ...(trimmedReceiptNumber === '' ? {} : { receiptNumber: trimmedReceiptNumber }),
      amountAgorot: shekelInputToAgorot(form.amountShekels),
      ...(trimmedDate === '' ? {} : { donationDate: trimmedDate }),
      hasSection46Approval: form.hasApproval,
    };
    const parsed = CharityReceiptSchema.safeParse(candidate);
    if (!parsed.success) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onConfirm(parsed.data);
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-4">
      <Field id="charity-tax-year" label={t('documentReview.fields.taxYear')}>
        <input
          id="charity-tax-year"
          type="number"
          value={form.taxYear}
          onChange={(event) => update({ taxYear: event.target.value })}
          disabled={readOnly}
          className={fieldClasses}
        />
      </Field>
      <Field id="charity-institution-name" label={t('documentReview.fields.institutionName')}>
        <input
          id="charity-institution-name"
          type="text"
          value={form.institutionName}
          onChange={(event) => update({ institutionName: event.target.value })}
          disabled={readOnly}
          data-uncertain={uncertainAttr('institutionName')}
          className={classesFor('institutionName')}
        />
      </Field>
      <Field
        id="charity-registration-id"
        label={t('documentReview.fields.institutionRegistrationId')}
      >
        <input
          id="charity-registration-id"
          type="text"
          value={form.registrationId}
          onChange={(event) => update({ registrationId: event.target.value })}
          disabled={readOnly}
          data-uncertain={uncertainAttr('institutionRegistrationId')}
          className={classesFor('institutionRegistrationId')}
        />
      </Field>
      <Field id="charity-receipt-number" label={t('documentReview.fields.receiptNumber')}>
        <input
          id="charity-receipt-number"
          type="text"
          value={form.receiptNumber}
          onChange={(event) => update({ receiptNumber: event.target.value })}
          disabled={readOnly}
          data-uncertain={uncertainAttr('receiptNumber')}
          className={classesFor('receiptNumber')}
        />
      </Field>
      <Field id="charity-amount" label={t('documentReview.fields.amount')}>
        <input
          id="charity-amount"
          type="text"
          inputMode="decimal"
          value={form.amountShekels}
          onChange={(event) => update({ amountShekels: event.target.value })}
          disabled={readOnly}
          data-uncertain={uncertainAttr('amountAgorot')}
          className={classesFor('amountAgorot')}
        />
      </Field>
      <Field id="charity-donation-date" label={t('documentReview.fields.donationDate')}>
        <input
          id="charity-donation-date"
          type="date"
          value={form.donationDate}
          onChange={(event) => update({ donationDate: event.target.value })}
          disabled={readOnly}
          data-uncertain={uncertainAttr('donationDate')}
          className={classesFor('donationDate')}
        />
      </Field>
      <div className="flex items-center gap-2">
        <input
          id="charity-section46"
          type="checkbox"
          checked={form.hasApproval}
          onChange={(event) => update({ hasApproval: event.target.checked })}
          disabled={readOnly}
          data-uncertain={uncertainAttr('hasSection46Approval')}
          className="size-4 rounded border-neutral-300 accent-blue-700 dark:border-neutral-700"
        />
        <Label.Root htmlFor="charity-section46" className={labelClasses}>
          {t('documentReview.fields.hasSection46Approval')}
        </Label.Root>
      </div>
      <FormActions
        readOnly={readOnly}
        invalid={invalid}
        confirmPending={confirmPending}
        confirmFailed={confirmFailed}
      />
    </form>
  );
}

// --- draft autosave (spec §9.3 "user input is never lost") -------------------

interface ReviewDraftApi {
  /** Server-derived form state OR a restored draft — what the form mounts with. */
  initialForm: ReviewFormState;
  notice: DraftNotice | null;
  /** Bumped on discard so the kind form remounts on the server values. */
  formVersion: number;
  /** Debounced autosave of the full raw form state (browser-local only). */
  reportForm: (form: ReviewFormState) => void;
  /** Delete the draft and remount the form on the server values. */
  discard: () => void;
  /** Delete the draft with any pending debounce cancelled (confirm success). */
  clearBeforeConfirm: () => void;
}

function useReviewDraft(
  documentId: string,
  kind: ReviewableKind,
  basePayload: ReviewPayload | null,
  enabled: boolean,
): ReviewDraftApi {
  // Lazy resolve is PURE except for loadStoredDraft's idempotent removal of
  // unreadable records — StrictMode-safe. The removal of a VALID stored
  // draft (stale/equal) is applied in the mount effect below.
  const [resolution, setResolution] = useState(() => {
    const serverForm = formStateFromPayload(kind, basePayload);
    return enabled
      ? resolveDraft(documentId, kind, basePayload, serverForm)
      : { initialForm: serverForm, notice: null, dropStored: false };
  });
  const [formVersion, setFormVersion] = useState(0);

  const timerRef = useRef<number | null>(null);
  const pendingRef = useRef<ReviewFormState | null>(null);
  // Latest identifying inputs for the debounced writer (query refetches may
  // hand us new object identities without a remount).
  const kindRef = useRef(kind);
  kindRef.current = kind;
  const baseRef = useRef(basePayload);
  baseRef.current = basePayload;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const cancelPending = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current = null;
  }, []);

  const flushPending = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const form = pendingRef.current;
    if (form === null) return;
    pendingRef.current = null;
    // A form identical to the server-derived state clears the draft instead
    // of saving it — no junk records.
    const serverForm = formStateFromPayload(kindRef.current, baseRef.current);
    if (formStatesEqual(form, serverForm)) {
      clearStoredDraft(documentId);
    } else {
      saveStoredDraft(
        documentId,
        makeStoredDraft(kindRef.current, baseRef.current, form),
      );
    }
  }, [documentId]);

  // Apply the resolve's removal decision once, as a mount side effect.
  useEffect(() => {
    if (resolution.dropStored) clearStoredDraft(documentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only: the resolve ran once in the lazy initializer
  }, []);

  // Flush on unmount so a navigation right after typing still saves.
  useEffect(() => () => flushPending(), [flushPending]);

  const reportForm = useCallback(
    (form: ReviewFormState) => {
      if (!enabledRef.current) return;
      pendingRef.current = form;
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(flushPending, DRAFT_DEBOUNCE_MS);
    },
    [flushPending],
  );

  const discard = useCallback(() => {
    cancelPending();
    clearStoredDraft(documentId);
    setResolution({
      initialForm: formStateFromPayload(kindRef.current, baseRef.current),
      notice: null,
      dropStored: false,
    });
    setFormVersion((version) => version + 1);
  }, [cancelPending, documentId]);

  const clearBeforeConfirm = useCallback(() => {
    // Cancel any pending debounce FIRST so the unmount flush cannot
    // resurrect the draft after a successful confirm.
    cancelPending();
    clearStoredDraft(documentId);
  }, [cancelPending, documentId]);

  return {
    initialForm: resolution.initialForm,
    notice: resolution.notice,
    formVersion,
    reportForm,
    discard,
    clearBeforeConfirm,
  };
}

// --- review panel (status-driven) --------------------------------------------

/**
 * Owns the confirm mutation AND the draft lifecycle so that clearing the
 * draft on a successful confirm sits right next to it. Remounted by the
 * parent whenever edit mode toggles, so the draft resolve reruns on
 * "עריכה ואישור מחדש".
 */
function DraftedKindForm({
  doc,
  initial,
  readOnly,
  taxYearId,
}: {
  doc: DocumentDetail;
  initial: DocumentPayload | null;
  readOnly: boolean;
  taxYearId: string;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const kind = doc.kind as ReviewableKind;
  const draft = useReviewDraft(doc.id, kind, initial, !readOnly);

  const confirmMutation = useMutation({
    mutationFn: (payload: DocumentPayload) => confirmDocument(doc.id, payload),
    onSuccess: async () => {
      // Clear the draft BEFORE any invalidation/navigation — the confirmed
      // values are now server truth and the draft must not outlive them.
      draft.clearBeforeConfirm();
      await queryClient.invalidateQueries({ queryKey: ['documents', doc.id] });
      await queryClient.invalidateQueries({
        queryKey: ['tax-years', taxYearId, 'documents'],
      });
      await navigate({ to: '/tax-years/$taxYearId', params: { taxYearId } });
    },
  });

  const shared = {
    readOnly,
    onFormChange: draft.reportForm,
    onConfirm: (payload: DocumentPayload) => confirmMutation.mutate(payload),
    confirmPending: confirmMutation.isPending,
    confirmFailed: confirmMutation.isError,
  };

  return (
    <div className="flex flex-col gap-4">
      {draft.notice === 'restored' ? (
        <div role="status" className={draftNoticeClasses}>
          <p>{t('documentReview.draftRestored')}</p>
          <div className="mt-3">
            <button
              type="button"
              onClick={draft.discard}
              className={secondaryButtonClasses}
            >
              {t('documentReview.draftDiscard')}
            </button>
          </div>
        </div>
      ) : null}
      {draft.notice === 'staleDropped' ? (
        <p role="status" className={draftNoticeClasses}>
          {t('documentReview.draftStaleDropped')}
        </p>
      ) : null}
      {kind === 'form106' ? (
        <Form106Form
          key={draft.formVersion}
          initial={initial as Form106 | null}
          initialForm={draft.initialForm as Form106FormState}
          {...shared}
        />
      ) : kind === 'form867' ? (
        <Form867Form
          key={draft.formVersion}
          initial={initial as Form867 | null}
          initialForm={draft.initialForm as Form867FormState}
          {...shared}
        />
      ) : (
        <CharityReceiptForm
          key={draft.formVersion}
          initial={initial as CharityReceipt | null}
          initialForm={draft.initialForm as CharityFormState}
          {...shared}
        />
      )}
    </div>
  );
}

function ReviewPanel({ doc, taxYearId }: { doc: DocumentDetail; taxYearId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [manualEntry, setManualEntry] = useState(false);
  const [editingConfirmed, setEditingConfirmed] = useState(false);

  const extractMutation = useMutation({
    mutationFn: () => extractDocument(doc.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['documents', doc.id] });
      await queryClient.invalidateQueries({
        queryKey: ['tax-years', taxYearId, 'documents'],
      });
    },
  });

  if (doc.kind === 'other') {
    return <p className={`mt-4 ${mutedTextClasses}`}>{t('documentReview.otherKindNote')}</p>;
  }

  const status = doc.extractionStatus;
  const showForm = status === 'extracted' || status === 'confirmed' || manualEntry;
  const initial =
    status === 'confirmed'
      ? doc.confirmedPayload
      : status === 'extracted'
        ? doc.extractedPayload
        : null;
  const readOnly = status === 'confirmed' && !editingConfirmed;
  const uncertainCount =
    status === 'extracted' && initial
      ? ('uncertainBoxes' in initial ? initial.uncertainBoxes : initial.uncertainFields)
          .length
      : 0;

  return (
    <div className="mt-4 flex flex-col gap-4">
      {status === 'failed' && doc.extractionError ? (
        <p role="alert" className={alertClasses}>
          {t('documentReview.extractFailed', { error: doc.extractionError })}
        </p>
      ) : null}

      {(status === 'pending' || status === 'failed') && !manualEntry ? (
        <div className="flex flex-col gap-3">
          {status === 'pending' ? (
            <p className={mutedTextClasses}>{t('documentReview.pendingHint')}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => extractMutation.mutate()}
              disabled={extractMutation.isPending}
              className={primaryButtonClasses}
            >
              {status === 'failed'
                ? t('documentReview.retryExtract')
                : t('documentReview.extract')}
            </button>
            <button
              type="button"
              onClick={() => setManualEntry(true)}
              className={secondaryButtonClasses}
            >
              {t('documentReview.manualEntry')}
            </button>
          </div>
          {extractMutation.isError ? (
            <p role="alert" className={alertClasses}>
              {t('documentReview.extractRequestError')}
            </p>
          ) : null}
        </div>
      ) : null}

      {status === 'confirmed' ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className={mutedTextClasses}>{t('documentReview.confirmedNote')}</p>
          {editingConfirmed ? null : (
            <button
              type="button"
              onClick={() => setEditingConfirmed(true)}
              className={secondaryButtonClasses}
            >
              {t('documentReview.editConfirmed')}
            </button>
          )}
        </div>
      ) : null}

      {uncertainCount > 0 ? (
        <p className={uncertainLegendClasses}>{t('documentReview.uncertainLegend')}</p>
      ) : null}

      {showForm ? (
        <DraftedKindForm
          // Remount when edit mode toggles so the draft resolve reruns:
          // the read-only confirmed view leaves a stored draft untouched
          // until "עריכה ואישור מחדש" re-enters edit mode.
          key={readOnly ? 'readonly' : 'editable'}
          doc={doc}
          initial={initial}
          readOnly={readOnly}
          taxYearId={taxYearId}
        />
      ) : null}
    </div>
  );
}

// --- screen -------------------------------------------------------------------

export function DocumentReview() {
  const { t } = useTranslation();
  const { taxYearId, documentId } = route.useParams();
  const docQuery = useQuery({
    queryKey: ['documents', documentId],
    queryFn: () => getDocument(documentId),
  });

  return (
    <main>
      <nav className="mb-4 text-sm">
        <Link to="/tax-years/$taxYearId" params={{ taxYearId }} className={linkClasses}>
          {t('documentReview.backToYear')}
        </Link>
      </nav>
      <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
        {t('documentReview.title')}
      </h1>
      {docQuery.isPending ? (
        <p className={`mt-4 ${mutedTextClasses}`}>{t('common.loading')}</p>
      ) : docQuery.isError ? (
        <div role="alert" className={`mt-4 ${alertClasses}`}>
          {t('common.loadError')}
        </div>
      ) : (
        <>
          <p className="mt-2 flex flex-wrap items-center gap-3">
            <span className="font-medium text-neutral-900 dark:text-neutral-100">
              {t(`documentKind.${docQuery.data.kind}`)}
            </span>
            <span className={mutedTextClasses}>{docQuery.data.originalFilename}</span>
            <ExtractionStatusChip status={docQuery.data.extractionStatus} />
          </p>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <section aria-labelledby="document-file-panel-title" className={panelClasses}>
              <h2 id="document-file-panel-title" className={panelHeadingClasses}>
                {t('documentReview.filePanel')}
              </h2>
              <FileViewer
                documentId={docQuery.data.id}
                filename={docQuery.data.originalFilename}
              />
            </section>
            <section aria-labelledby="document-form-panel-title" className={panelClasses}>
              <h2 id="document-form-panel-title" className={panelHeadingClasses}>
                {t('documentReview.formPanel')}
              </h2>
              <ReviewPanel doc={docQuery.data} taxYearId={taxYearId} />
            </section>
          </div>
        </>
      )}
    </main>
  );
}
