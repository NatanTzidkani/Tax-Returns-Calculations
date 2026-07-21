import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { deleteTaxYear } from '../api/client';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';

/**
 * "מחיקת שנת מס" — a confirmation-gated delete for a single tax year. A thin
 * wrapper over `ConfirmDeleteDialog`: on success it invalidates the years list
 * plus this year's detail/documents/calculation queries (the ['tax-years', …]
 * prefix) and calls `onDeleted` (the detail screen uses it to navigate back to
 * the dashboard). Two triggers: the detail-header text button and the
 * dashboard per-row icon (which must not bubble a click into the row's link).
 */

type Variant = 'header' | 'row';

export function DeleteTaxYearDialog({
  taxYearId,
  year,
  variant = 'header',
  onDeleted,
}: {
  taxYearId: string;
  year: number;
  variant?: Variant;
  onDeleted?: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const isRow = variant === 'row';
  const triggerLabel = isRow
    ? t('deleteTaxYear.rowTriggerAria', { year })
    : t('deleteTaxYear.trigger');

  return (
    <ConfirmDeleteDialog
      variant={variant}
      triggerLabel={triggerLabel}
      // The dashboard row's year cell links to the detail screen; keep a click
      // on the icon from bubbling up so it never triggers navigation.
      stopTriggerPropagation={isRow}
      title={t('deleteTaxYear.dialogTitle')}
      description={t('deleteTaxYear.dialogBody', { year })}
      confirmLabel={t('deleteTaxYear.confirm')}
      cancelLabel={t('deleteTaxYear.cancel')}
      errorFallback={t('deleteTaxYear.error')}
      onConfirm={() => deleteTaxYear(taxYearId)}
      onSuccess={async () => {
        // Prefix invalidation covers the years list (dashboard/detail) plus this
        // year's detail, documents and calculation queries (['tax-years', id, …]).
        await queryClient.invalidateQueries({ queryKey: ['tax-years'] });
        onDeleted?.();
      }}
    />
  );
}
