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
    <form onSubmit={onSubmit} className="mt-4 flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <Label.Root htmlFor="upload-file-input" className="text-sm text-neutral-700">
          {t('taxYearDetail.uploadFileLabel')}
        </Label.Root>
        {/* No `required`: jsdom (and some browsers with programmatic file
            selection) fail constraint validation even when files are set;
            onSubmit guards against an empty selection instead. */}
        <input
          id="upload-file-input"
          ref={fileInputRef}
          type="file"
          className="text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label.Root htmlFor="upload-kind-select" className="text-sm text-neutral-700">
          {t('taxYearDetail.uploadKindLabel')}
        </Label.Root>
        <select
          id="upload-kind-select"
          value={kind}
          onChange={(event) => setKind(event.target.value as DocumentKind)}
          className="rounded border border-neutral-300 px-2 py-1"
        >
          {DOCUMENT_KINDS.map((documentKind) => (
            <option key={documentKind} value={documentKind}>
              {t(`documentKind.${documentKind}`)}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={mutation.isPending}
        className="rounded bg-blue-700 px-4 py-1.5 font-medium text-white disabled:opacity-50"
      >
        {t('taxYearDetail.uploadSubmit')}
      </button>
      {mutation.isError ? (
        <p role="alert" className="w-full text-sm text-red-700">
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
    <section
      aria-labelledby="documents-panel-title"
      className="rounded-lg border border-neutral-200 p-4"
    >
      <h2 id="documents-panel-title" className="text-lg font-semibold text-neutral-900">
        {t('taxYearDetail.documentsPanel')}
      </h2>
      {documentsQuery.isPending ? (
        <p className="mt-3 text-neutral-600">{t('common.loading')}</p>
      ) : documentsQuery.isError ? (
        <p role="alert" className="mt-3 text-red-700">
          {t('common.loadError')}
        </p>
      ) : documentsQuery.data.length === 0 ? (
        <p className="mt-3 text-neutral-600">{t('taxYearDetail.noDocuments')}</p>
      ) : (
        <ul className="mt-3 divide-y divide-neutral-200">
          {documentsQuery.data.map((document) => (
            <li key={document.id} className="flex items-center gap-3 py-2">
              <span className="font-medium text-neutral-900">
                {t(`documentKind.${document.kind}`)}
              </span>
              <span className="text-sm text-neutral-600">
                {document.originalFilename}
              </span>
              <span className="text-sm text-neutral-500">
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
    <section aria-labelledby={id} className="rounded-lg border border-neutral-200 p-4">
      <h2 id={id} className="text-lg font-semibold text-neutral-900">
        {t(titleKey)}
      </h2>
      <p className="mt-3 text-neutral-600">{t(bodyKey)}</p>
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
        <Link to="/" className="text-blue-700 underline">
          {t('taxYearDetail.backToDashboard')}
        </Link>
      </nav>
      <h1 className="text-xl font-bold text-neutral-900">
        {taxYear
          ? t('taxYearDetail.title', { year: taxYear.year })
          : t('taxYearDetail.titleUnknown')}
      </h1>
      <div className="mt-4 flex flex-col gap-4">
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
