import { useTranslation } from 'react-i18next';
import type { ExtractionStatus, TaxYearStatus } from '../api/client';

const chipBase =
  'inline-block rounded-full px-2.5 py-0.5 text-sm font-medium whitespace-nowrap';

const taxYearStatusStyles: Record<TaxYearStatus, string> = {
  draft: 'bg-neutral-100 text-neutral-700',
  in_review: 'bg-amber-100 text-amber-800',
  ready_to_file: 'bg-blue-100 text-blue-800',
  filed: 'bg-green-100 text-green-800',
  amended: 'bg-purple-100 text-purple-800',
};

const extractionStatusStyles: Record<ExtractionStatus, string> = {
  pending: 'bg-neutral-100 text-neutral-700',
  extracted: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

export function TaxYearStatusChip({ status }: { status: TaxYearStatus }) {
  const { t } = useTranslation();
  return (
    <span className={`${chipBase} ${taxYearStatusStyles[status]}`}>
      {t(`taxYearStatus.${status}`)}
    </span>
  );
}

export function ExtractionStatusChip({ status }: { status: ExtractionStatus }) {
  const { t } = useTranslation();
  return (
    <span className={`${chipBase} ${extractionStatusStyles[status]}`}>
      {t(`extractionStatus.${status}`)}
    </span>
  );
}
