import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { deleteDocument } from '../api/client';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';

/**
 * "מחיקת מסמך" — a confirmation-gated delete for a single document. A thin
 * wrapper over `ConfirmDeleteDialog` (icon-only trigger at the row's
 * inline-end). On success it invalidates the documents list, the confirmed-data
 * panel and the calculation query — deleting a confirmed document flips the
 * calculation's `stale` flag server-side.
 */

export function DeleteDocumentDialog({
  taxYearId,
  documentId,
  filename,
}: {
  taxYearId: string;
  documentId: string;
  filename: string;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return (
    <ConfirmDeleteDialog
      variant="row"
      triggerLabel={t('deleteDocument.triggerAria', { filename })}
      title={t('deleteDocument.dialogTitle')}
      description={t('deleteDocument.dialogBody', { filename })}
      confirmLabel={t('deleteDocument.confirm')}
      cancelLabel={t('deleteDocument.cancel')}
      errorFallback={t('deleteDocument.error')}
      onConfirm={() => deleteDocument(documentId)}
      onSuccess={async () => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: ['tax-years', taxYearId, 'documents'],
          }),
          queryClient.invalidateQueries({
            queryKey: ['tax-years', taxYearId, 'confirmed-data'],
          }),
          // The stale flag may have just flipped (a confirmed input was removed).
          queryClient.invalidateQueries({
            queryKey: ['tax-years', taxYearId, 'calculation'],
          }),
        ]);
      }}
    />
  );
}
