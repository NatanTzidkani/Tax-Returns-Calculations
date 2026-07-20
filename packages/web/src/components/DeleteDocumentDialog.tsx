import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertDialog } from 'radix-ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, deleteDocument } from '../api/client';
import { TrashIcon } from './TrashIcon';

/**
 * "מחיקת מסמך" — a confirmation-gated delete for a single document, modeled on
 * `DeleteTaxYearDialog` (Radix `AlertDialog`, icon-only trigger at the row's
 * inline-end). The dialog is controlled so it stays open and shows the server's
 * Hebrew message when the DELETE fails (e.g. the 409 for a filed year). On
 * success it invalidates the documents list, the confirmed-data panel and the
 * calculation query — deleting a confirmed document flips the calculation's
 * `stale` flag server-side.
 */

const overlayClasses =
  'fixed inset-0 z-40 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in';

// Center via a flex wrapper rather than a logical inset + physical transform,
// which don't compose under RTL (see DeleteTaxYearDialog).
const positioningClasses = 'fixed inset-0 z-50 flex items-center justify-center p-4';

const contentClasses =
  'w-full max-w-md rounded-lg border border-neutral-200 bg-white p-6 shadow-xl ' +
  'dark:border-neutral-800 dark:bg-neutral-900';

const titleClasses = 'text-lg font-semibold text-neutral-900 dark:text-neutral-100';

const bodyClasses = 'mt-2 text-sm text-neutral-600 dark:text-neutral-400';

const cancelButtonClasses =
  'inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-1.5 ' +
  'text-sm font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-100 ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ' +
  'disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 ' +
  'dark:text-neutral-200 dark:hover:bg-neutral-800';

const destructiveButtonClasses =
  'inline-flex items-center justify-center rounded-md bg-red-700 px-4 py-1.5 text-sm font-medium text-white ' +
  'shadow-sm transition-colors hover:bg-red-800 focus-visible:outline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-50 ' +
  'dark:bg-red-600 dark:hover:bg-red-500';

// Icon-only per-row control: muted by default, red on hover, sits at the
// row's inline-end. Logical properties keep it correct under RTL.
const rowTriggerClasses =
  'inline-flex items-center justify-center rounded-md p-1.5 text-neutral-500 transition-colors ' +
  'hover:bg-red-50 hover:text-red-700 focus-visible:outline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-red-600 dark:text-neutral-400 ' +
  'dark:hover:bg-red-950/40 dark:hover:text-red-400';

const alertClasses =
  'mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 ' +
  'dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300';

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
  const [open, setOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: () => deleteDocument(documentId),
    onSuccess: async () => {
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
      setOpen(false);
    },
  });

  const errorText =
    mutation.error instanceof ApiError && mutation.error.message
      ? mutation.error.message
      : t('deleteDocument.error');

  const triggerLabel = t('deleteDocument.triggerAria', { filename });

  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        // Reset any prior error each time the dialog re-opens.
        if (next) mutation.reset();
        setOpen(next);
      }}
    >
      <AlertDialog.Trigger
        className={rowTriggerClasses}
        aria-label={triggerLabel}
        title={triggerLabel}
      >
        <TrashIcon />
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={overlayClasses} />
        <div className={positioningClasses}>
          <AlertDialog.Content className={contentClasses}>
            <AlertDialog.Title className={titleClasses}>
              {t('deleteDocument.dialogTitle')}
            </AlertDialog.Title>
            <AlertDialog.Description className={bodyClasses}>
              {t('deleteDocument.dialogBody', { filename })}
            </AlertDialog.Description>
            {mutation.isError ? (
              <p role="alert" className={alertClasses}>
                {errorText}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <AlertDialog.Cancel className={cancelButtonClasses} disabled={mutation.isPending}>
                {t('deleteDocument.cancel')}
              </AlertDialog.Cancel>
              {/* Not AlertDialog.Action: that auto-closes on click, but we keep
                  the dialog open to show an error when the DELETE fails and only
                  close it ourselves in the mutation's onSuccess. */}
              <button
                type="button"
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
                className={destructiveButtonClasses}
              >
                {t('deleteDocument.confirm')}
              </button>
            </div>
          </AlertDialog.Content>
        </div>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
