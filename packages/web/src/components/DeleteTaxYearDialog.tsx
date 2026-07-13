import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertDialog } from 'radix-ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, deleteTaxYear } from '../api/client';

/**
 * "מחיקת שנת מס" — a confirmation-gated delete for a single tax year, built on
 * Radix `AlertDialog` (destructive dialogs need the alertdialog role + focus
 * trap). The dialog is controlled so it can stay open and show a Hebrew error
 * when the DELETE fails; on success it invalidates the years list plus this
 * year's detail/calculation queries and calls `onDeleted` (the detail screen
 * uses it to navigate back to the dashboard).
 */

type Variant = 'header' | 'row';

const overlayClasses =
  'fixed inset-0 z-40 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in';

const contentClasses =
  'fixed top-1/2 start-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 ' +
  'rounded-lg border border-neutral-200 bg-white p-6 shadow-xl ' +
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

const headerTriggerClasses =
  'inline-flex items-center justify-center rounded-md border border-red-300 bg-white px-3 py-1.5 ' +
  'text-sm font-medium text-red-700 shadow-sm transition-colors hover:bg-red-50 ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 ' +
  'dark:border-red-900/60 dark:bg-neutral-900 dark:text-red-400 dark:hover:bg-red-950/40';

// Icon-only per-row control: muted by default, red on hover, sits at the
// row's inline-end. Logical properties keep it correct under RTL.
const rowTriggerClasses =
  'inline-flex items-center justify-center rounded-md p-1.5 text-neutral-500 transition-colors ' +
  'hover:bg-red-50 hover:text-red-700 focus-visible:outline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-red-600 dark:text-neutral-400 ' +
  'dark:hover:bg-red-950/40 dark:hover:text-red-400';

/** Inline trash-can icon (no icon dependency in this app's package.json). */
function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

const alertClasses =
  'mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 ' +
  'dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300';

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
  const [open, setOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: () => deleteTaxYear(taxYearId),
    onSuccess: async () => {
      // Prefix invalidation covers the years list (dashboard/detail) plus this
      // year's detail, documents and calculation queries (['tax-years', id, …]).
      await queryClient.invalidateQueries({ queryKey: ['tax-years'] });
      setOpen(false);
      onDeleted?.();
    },
  });

  const errorText =
    mutation.error instanceof ApiError && mutation.error.message
      ? mutation.error.message
      : t('deleteTaxYear.error');

  const isRow = variant === 'row';
  const rowLabel = t('deleteTaxYear.rowTriggerAria', { year });

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
        className={isRow ? rowTriggerClasses : headerTriggerClasses}
        aria-label={isRow ? rowLabel : undefined}
        title={isRow ? rowLabel : undefined}
        // The dashboard row's year cell links to the detail screen; keep a
        // click on the icon from bubbling up so it never triggers navigation.
        onClick={isRow ? (event) => event.stopPropagation() : undefined}
      >
        {isRow ? <TrashIcon /> : t('deleteTaxYear.trigger')}
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={overlayClasses} />
        <AlertDialog.Content className={contentClasses}>
          <AlertDialog.Title className={titleClasses}>
            {t('deleteTaxYear.dialogTitle')}
          </AlertDialog.Title>
          <AlertDialog.Description className={bodyClasses}>
            {t('deleteTaxYear.dialogBody', { year })}
          </AlertDialog.Description>
          {mutation.isError ? (
            <p role="alert" className={alertClasses}>
              {errorText}
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <AlertDialog.Cancel className={cancelButtonClasses} disabled={mutation.isPending}>
              {t('deleteTaxYear.cancel')}
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
              {t('deleteTaxYear.confirm')}
            </button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
