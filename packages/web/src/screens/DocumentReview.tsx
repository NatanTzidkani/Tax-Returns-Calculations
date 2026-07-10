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
import { type FormEvent, type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  confirmDocument,
  type DocumentDetail,
  type DocumentPayload,
  extractDocument,
  getDocument,
} from '../api/client';
import { ExtractionStatusChip } from '../components/StatusChip';

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

const linkClasses =
  'font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300';

/** Box codes with meanings documented in packages/shared/src/documents/form106.ts. */
const DOCUMENTED_BOX_CODES = ['158', '042', '045'] as const;

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

/** Display integer agorot as a shekel string for editing (e.g. 308625 → "3086.25"). */
function agorotToShekelString(value: number | undefined): string {
  return value === undefined ? '' : String(value / 100);
}

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

interface ReviewFormProps<P> {
  initial: P | null;
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

interface BoxRow {
  code: string;
  amountShekels: string;
}

function Form106Form({
  initial,
  readOnly,
  onConfirm,
  confirmPending,
  confirmFailed,
}: ReviewFormProps<Form106>) {
  const { t } = useTranslation();
  const uncertainBoxes = initial?.uncertainBoxes ?? [];
  const [taxYear, setTaxYear] = useState(initial ? String(initial.taxYear) : '');
  const [employerName, setEmployerName] = useState(initial?.employerName ?? '');
  const [deductionsFileId, setDeductionsFileId] = useState(
    initial?.employerDeductionsFileId ?? '',
  );
  const [nationalId, setNationalId] = useState(initial?.employeeNationalId ?? '');
  const [rows, setRows] = useState<BoxRow[]>(() =>
    initial
      ? Object.entries(initial.boxes).map(([code, amount]) => ({
          code,
          amountShekels: agorotToShekelString(amount),
        }))
      : [{ code: '', amountShekels: '' }],
  );
  const [invalid, setInvalid] = useState(false);
  const [duplicateCode, setDuplicateCode] = useState<string | null>(null);

  function updateRow(index: number, patch: Partial<BoxRow>) {
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const activeRows = rows.filter(
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
      taxYear: parseYear(taxYear),
      employerName,
      employerDeductionsFileId: deductionsFileId,
      employeeNationalId: nationalId,
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
          value={taxYear}
          onChange={(event) => setTaxYear(event.target.value)}
          disabled={readOnly}
          className={fieldClasses}
        />
      </Field>
      <Field id="form106-employer-name" label={t('documentReview.fields.employerName')}>
        <input
          id="form106-employer-name"
          type="text"
          value={employerName}
          onChange={(event) => setEmployerName(event.target.value)}
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
          value={deductionsFileId}
          onChange={(event) => setDeductionsFileId(event.target.value)}
          disabled={readOnly}
          className={fieldClasses}
        />
      </Field>
      <Field id="form106-national-id" label={t('documentReview.fields.employeeNationalId')}>
        <input
          id="form106-national-id"
          type="text"
          value={nationalId}
          onChange={(event) => setNationalId(event.target.value)}
          disabled={readOnly}
          className={fieldClasses}
        />
      </Field>

      <fieldset className="flex flex-col gap-3">
        <legend className={`${labelClasses} mb-2`}>{t('documentReview.boxes.title')}</legend>
        {rows.map((row, index) => {
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
                      setRows((current) => current.filter((_, i) => i !== index))
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
                setRows((current) => [...current, { code: '', amountShekels: '' }])
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

const FORM867_MONEY_FIELDS = [
  'realGainsAgorot',
  'realLossesAgorot',
  'interestDividendAgorot',
  'taxWithheldAgorot',
] as const;

type Form867MoneyField = (typeof FORM867_MONEY_FIELDS)[number];

function Form867Form({
  initial,
  readOnly,
  onConfirm,
  confirmPending,
  confirmFailed,
}: ReviewFormProps<Form867>) {
  const { t } = useTranslation();
  const uncertainFields = initial?.uncertainFields ?? [];
  const [taxYear, setTaxYear] = useState(initial ? String(initial.taxYear) : '');
  const [brokerName, setBrokerName] = useState(initial?.brokerName ?? '');
  const [accountId, setAccountId] = useState(initial?.accountId ?? '');
  const [amounts, setAmounts] = useState<Record<Form867MoneyField, string>>({
    realGainsAgorot: agorotToShekelString(initial?.realGainsAgorot),
    realLossesAgorot: agorotToShekelString(initial?.realLossesAgorot),
    interestDividendAgorot: agorotToShekelString(initial?.interestDividendAgorot),
    taxWithheldAgorot: agorotToShekelString(initial?.taxWithheldAgorot),
  });
  const [invalid, setInvalid] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedAccountId = accountId.trim();
    const candidate = {
      taxYear: parseYear(taxYear),
      brokerName,
      ...(trimmedAccountId === '' ? {} : { accountId: trimmedAccountId }),
      realGainsAgorot: shekelInputToAgorot(amounts.realGainsAgorot),
      realLossesAgorot: shekelInputToAgorot(amounts.realLossesAgorot),
      interestDividendAgorot: shekelInputToAgorot(amounts.interestDividendAgorot),
      taxWithheldAgorot: shekelInputToAgorot(amounts.taxWithheldAgorot),
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
          value={taxYear}
          onChange={(event) => setTaxYear(event.target.value)}
          disabled={readOnly}
          className={fieldClasses}
        />
      </Field>
      <Field id="form867-broker-name" label={t('documentReview.fields.brokerName')}>
        <input
          id="form867-broker-name"
          type="text"
          value={brokerName}
          onChange={(event) => setBrokerName(event.target.value)}
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
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
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
              value={amounts[field]}
              onChange={(event) =>
                setAmounts((current) => ({ ...current, [field]: event.target.value }))
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
  readOnly,
  onConfirm,
  confirmPending,
  confirmFailed,
}: ReviewFormProps<CharityReceipt>) {
  const { t } = useTranslation();
  const uncertainFields = initial?.uncertainFields ?? [];
  const [taxYear, setTaxYear] = useState(initial ? String(initial.taxYear) : '');
  const [institutionName, setInstitutionName] = useState(initial?.institutionName ?? '');
  const [registrationId, setRegistrationId] = useState(
    initial?.institutionRegistrationId ?? '',
  );
  const [receiptNumber, setReceiptNumber] = useState(initial?.receiptNumber ?? '');
  const [amountShekels, setAmountShekels] = useState(
    agorotToShekelString(initial?.amountAgorot),
  );
  const [donationDate, setDonationDate] = useState(initial?.donationDate ?? '');
  const [hasApproval, setHasApproval] = useState(initial?.hasSection46Approval ?? false);
  const [invalid, setInvalid] = useState(false);

  function classesFor(field: string): string {
    return uncertainFields.includes(field) ? uncertainFieldClasses : fieldClasses;
  }

  function uncertainAttr(field: string): 'true' | undefined {
    return uncertainFields.includes(field) ? 'true' : undefined;
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedRegistrationId = registrationId.trim();
    const trimmedReceiptNumber = receiptNumber.trim();
    const trimmedDate = donationDate.trim();
    const candidate = {
      taxYear: parseYear(taxYear),
      institutionName,
      ...(trimmedRegistrationId === ''
        ? {}
        : { institutionRegistrationId: trimmedRegistrationId }),
      ...(trimmedReceiptNumber === '' ? {} : { receiptNumber: trimmedReceiptNumber }),
      amountAgorot: shekelInputToAgorot(amountShekels),
      ...(trimmedDate === '' ? {} : { donationDate: trimmedDate }),
      hasSection46Approval: hasApproval,
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
          value={taxYear}
          onChange={(event) => setTaxYear(event.target.value)}
          disabled={readOnly}
          className={fieldClasses}
        />
      </Field>
      <Field id="charity-institution-name" label={t('documentReview.fields.institutionName')}>
        <input
          id="charity-institution-name"
          type="text"
          value={institutionName}
          onChange={(event) => setInstitutionName(event.target.value)}
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
          value={registrationId}
          onChange={(event) => setRegistrationId(event.target.value)}
          disabled={readOnly}
          data-uncertain={uncertainAttr('institutionRegistrationId')}
          className={classesFor('institutionRegistrationId')}
        />
      </Field>
      <Field id="charity-receipt-number" label={t('documentReview.fields.receiptNumber')}>
        <input
          id="charity-receipt-number"
          type="text"
          value={receiptNumber}
          onChange={(event) => setReceiptNumber(event.target.value)}
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
          value={amountShekels}
          onChange={(event) => setAmountShekels(event.target.value)}
          disabled={readOnly}
          data-uncertain={uncertainAttr('amountAgorot')}
          className={classesFor('amountAgorot')}
        />
      </Field>
      <Field id="charity-donation-date" label={t('documentReview.fields.donationDate')}>
        <input
          id="charity-donation-date"
          type="date"
          value={donationDate}
          onChange={(event) => setDonationDate(event.target.value)}
          disabled={readOnly}
          data-uncertain={uncertainAttr('donationDate')}
          className={classesFor('donationDate')}
        />
      </Field>
      <div className="flex items-center gap-2">
        <input
          id="charity-section46"
          type="checkbox"
          checked={hasApproval}
          onChange={(event) => setHasApproval(event.target.checked)}
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

// --- review panel (status-driven) --------------------------------------------

function KindForm({
  doc,
  initial,
  readOnly,
  onConfirm,
  confirmPending,
  confirmFailed,
}: {
  doc: DocumentDetail;
  initial: DocumentPayload | null;
  readOnly: boolean;
  onConfirm: (payload: DocumentPayload) => void;
  confirmPending: boolean;
  confirmFailed: boolean;
}) {
  const shared = { readOnly, onConfirm, confirmPending, confirmFailed };
  switch (doc.kind) {
    case 'form106':
      return <Form106Form initial={initial as Form106 | null} {...shared} />;
    case 'form867':
      return <Form867Form initial={initial as Form867 | null} {...shared} />;
    case 'charity_receipt':
      return <CharityReceiptForm initial={initial as CharityReceipt | null} {...shared} />;
    default:
      return null;
  }
}

function ReviewPanel({ doc, taxYearId }: { doc: DocumentDetail; taxYearId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
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

  const confirmMutation = useMutation({
    mutationFn: (payload: DocumentPayload) => confirmDocument(doc.id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['documents', doc.id] });
      await queryClient.invalidateQueries({
        queryKey: ['tax-years', taxYearId, 'documents'],
      });
      await navigate({ to: '/tax-years/$taxYearId', params: { taxYearId } });
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
        <KindForm
          doc={doc}
          initial={initial}
          readOnly={readOnly}
          onConfirm={(payload) => confirmMutation.mutate(payload)}
          confirmPending={confirmMutation.isPending}
          confirmFailed={confirmMutation.isError}
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
