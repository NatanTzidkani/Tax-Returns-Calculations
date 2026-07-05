import { useTranslation } from 'react-i18next';
import type { ExtractionStatus, TaxYearStatus } from '../api/client';

const chipBase =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset';

const taxYearStatusStyles: Record<TaxYearStatus, string> = {
  draft:
    'bg-neutral-100 text-neutral-700 ring-neutral-300 dark:bg-neutral-800 dark:text-neutral-300 dark:ring-neutral-700',
  in_review:
    'bg-amber-50 text-amber-800 ring-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800',
  ready_to_file:
    'bg-blue-50 text-blue-800 ring-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-800',
  filed:
    'bg-green-50 text-green-800 ring-green-300 dark:bg-green-900/30 dark:text-green-300 dark:ring-green-800',
  amended:
    'bg-purple-50 text-purple-800 ring-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:ring-purple-800',
};

const extractionStatusStyles: Record<ExtractionStatus, string> = {
  pending:
    'bg-neutral-100 text-neutral-700 ring-neutral-300 dark:bg-neutral-800 dark:text-neutral-300 dark:ring-neutral-700',
  extracted:
    'bg-blue-50 text-blue-800 ring-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-800',
  confirmed:
    'bg-green-50 text-green-800 ring-green-300 dark:bg-green-900/30 dark:text-green-300 dark:ring-green-800',
  failed:
    'bg-red-50 text-red-800 ring-red-300 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-800',
};

function ChipDot() {
  return <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />;
}

export function TaxYearStatusChip({ status }: { status: TaxYearStatus }) {
  const { t } = useTranslation();
  return (
    <span className={`${chipBase} ${taxYearStatusStyles[status]}`}>
      <ChipDot />
      {t(`taxYearStatus.${status}`)}
    </span>
  );
}

export function ExtractionStatusChip({ status }: { status: ExtractionStatus }) {
  const { t } = useTranslation();
  return (
    <span className={`${chipBase} ${extractionStatusStyles[status]}`}>
      <ChipDot />
      {t(`extractionStatus.${status}`)}
    </span>
  );
}
