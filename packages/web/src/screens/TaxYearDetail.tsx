import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRouteApi, Link } from '@tanstack/react-router';
import { Label } from 'radix-ui';
import { type FormEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type DocumentKind,
  listDocuments,
  listTaxYears,
  uploadDocument,
} from '../api/client';
import { ExtractionStatusChip } from '../components/StatusChip';

const route = getRouteApi('/tax-years/$taxYearId');

const DOCUMENT_KINDS: readonly DocumentKind[] = [
  'form106',
  'form867',
  'charity_receipt',
  'other',
];

const uploadedAtFormatter = new Intl.DateTimeFormat('he-IL', { dateStyle: 'medium' });

const labelClasses = 'text-sm font-medium text-neutral-700 dark:text-neutral-300';

const fieldClasses =
  'rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 shadow-sm ' +
  'transition-colors focus:border-blue-600 focus:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-blue-600 focus-visible:ring-offset-1 dark:border-neutral-700 dark:bg-neutral-900 ' +
  'dark:text-neutral-100 dark:focus-visible:ring-offset-neutral-950';

const fileFieldClasses =
  `${fieldClasses} file:me-3 file:rounded-md file:border-0 file:bg-neutral-100 file:px-3 file:py-1.5 ` +
  'file:text-sm file:font-medium file:text-neutral-700 hover:file:bg-neutral-200 dark:file:bg-neutral-800 ' +
  'dark:file:text-neutral-200 dark:hover:file:bg-neutral-700';

const primaryButtonClasses =
  'inline-flex items-center justify-center rounded-md bg-blue-700 px-4 py-1.5 text-sm font-medium text-white ' +
  'shadow-sm transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50 ' +
  'dark:bg-blue-600 dark:hover:bg-blue-500';

const alertClasses =
  'rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 ' +
  'dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300';

const mutedTextClasses = 'text-sm text-neutral-500 dark:text-neutral-400';

const panelClasses =
  'rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-6';

const panelHeadingClasses = 'text-base font-semibold text-neutral-900 dark:text-neutral-100';

function UploadDocumentForm({ taxYearId }: { taxYearId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<DocumentKind>('form106');
  const mutation = useMutation({
    mutationFn: (file: File) => uploadDocument(taxYearId, file, kind),
    onSuccess: async () => {
      if (fileInputRef.current) fileInputRef.current.value = '';
      await queryClient.invalidateQueries({
        queryKey: ['tax-years', taxYearId, 'documents'],
      });
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    mutation.mutate(file);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-4 flex flex-wrap items-end gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-800"
    >
      <div className="flex flex-col gap-1.5">
        <Label.Root htmlFor="upload-file-input" className={labelClasses}>
          {t('taxYearDetail.uploadFileLabel')}
        </Label.Root>
        {/* No `required`: jsdom (and some browsers with programmatic file
            selection) fail constraint validation even when files are set;
            onSubmit guards against an empty selection instead. */}
        <input
          id="upload-file-input"
          ref={fileInputRef}
          type="file"
          className={fileFieldClasses}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label.Root htmlFor="upload-kind-select" className={labelClasses}>
          {t('taxYearDetail.uploadKindLabel')}
        </Label.Root>
        <select
          id="upload-kind-select"
          value={kind}
          onChange={(event) => setKind(event.target.value as DocumentKind)}
          className={fieldClasses}
        >
          {DOCUMENT_KINDS.map((documentKind) => (
            <option key={documentKind} value={documentKind}>
              {t(`documentKind.${documentKind}`)}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={mutation.isPending} className={primaryButtonClasses}>
        {t('taxYearDetail.uploadSubmit')}
      </button>
      {mutation.isError ? (
        <p role="alert" className={`w-full ${alertClasses}`}>
          {t('taxYearDetail.uploadError')}
        </p>
      ) : null}
    </form>
  );
}

function DocumentsPanel({ taxYearId }: { taxYearId: string }) {
  const { t } = useTranslation();
  const documentsQuery = useQuery({
    queryKey: ['tax-years', taxYearId, 'documents'],
    queryFn: () => listDocuments(taxYearId),
  });

  return (
    <section aria-labelledby="documents-panel-title" className={panelClasses}>
      <h2 id="documents-panel-title" className={panelHeadingClasses}>
        {t('taxYearDetail.documentsPanel')}
      </h2>
      {documentsQuery.isPending ? (
        <p className={`mt-4 ${mutedTextClasses}`}>{t('common.loading')}</p>
      ) : documentsQuery.isError ? (
        <div role="alert" className={`mt-4 ${alertClasses}`}>
          {t('common.loadError')}
        </div>
      ) : documentsQuery.data.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-neutral-300 px-6 py-8 text-center dark:border-neutral-700">
          <p className={mutedTextClasses}>{t('taxYearDetail.noDocuments')}</p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-neutral-200 dark:divide-neutral-800">
          {documentsQuery.data.map((document) => (
            <li
              key={document.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 first:pt-0 last:pb-0"
            >
              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                {t(`documentKind.${document.kind}`)}
              </span>
              <span className="text-sm text-neutral-600 dark:text-neutral-400">
                {document.originalFilename}
              </span>
              <span className="text-sm text-neutral-500 dark:text-neutral-500">
                {uploadedAtFormatter.format(new Date(document.uploadedAt))}
              </span>
              <span className="ms-auto">
                <ExtractionStatusChip status={document.extractionStatus} />
              </span>
            </li>
          ))}
        </ul>
      )}
      <UploadDocumentForm taxYearId={taxYearId} />
    </section>
  );
}

function PlaceholderPanel({
  titleKey,
  bodyKey,
  id,
}: {
  titleKey: string;
  bodyKey: string;
  id: string;
}) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby={id} className={panelClasses}>
      <h2 id={id} className={panelHeadingClasses}>
        {t(titleKey)}
      </h2>
      <p className={`mt-3 ${mutedTextClasses}`}>{t(bodyKey)}</p>
    </section>
  );
}

export function TaxYearDetail() {
  const { t } = useTranslation();
  const { taxYearId } = route.useParams();
  const taxYearsQuery = useQuery({ queryKey: ['tax-years'], queryFn: listTaxYears });
  const taxYear = taxYearsQuery.data?.find((candidate) => candidate.id === taxYearId);

  return (
    <main>
      <nav className="mb-4 text-sm">
        <Link
          to="/"
          className="font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {t('taxYearDetail.backToDashboard')}
        </Link>
      </nav>
      <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
        {taxYear
          ? t('taxYearDetail.title', { year: taxYear.year })
          : t('taxYearDetail.titleUnknown')}
      </h1>
      <div className="mt-6 flex flex-col gap-4">
        <DocumentsPanel taxYearId={taxYearId} />
        <PlaceholderPanel
          id="data-panel-title"
          titleKey="taxYearDetail.dataPanel"
          bodyKey="taxYearDetail.dataPlaceholder"
        />
        <PlaceholderPanel
          id="calculation-panel-title"
          titleKey="taxYearDetail.calculationPanel"
          bodyKey="taxYearDetail.calculationPlaceholder"
        />
      </div>
    </main>
  );
}
