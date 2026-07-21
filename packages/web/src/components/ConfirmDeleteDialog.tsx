import { useMutation } from '@tanstack/react-query';
import { AlertDialog } from 'radix-ui';
import { useState } from 'react';
import { ApiError } from '../api/client';
import { TrashIcon } from './TrashIcon';

/**
 * Shared confirmation-gated delete dialog, built on Radix `AlertDialog`
 * (destructive dialogs need the alertdialog role + focus trap). Backs both
 * `DeleteTaxYearDialog` and `DeleteDocumentDialog`, which supply the
 * entity-specific i18n text, trigger appearance and delete action.
 *
 * The dialog is CONTROLLED so it can stay open and render the server's Hebrew
 * error inside itself when the DELETE fails (e.g. a 409 for a filed year or a
 * 404). It only closes on success — the caller's `onSuccess` handler runs the
 * query invalidations (and any navigation) after the dialog is closed.
 */

type Variant = 'header' | 'row';

const overlayClasses =
  'fixed inset-0 z-40 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in';

// Center via a flex wrapper (positioningClasses) rather than a logical inset +
// physical transform, which don't compose under RTL and push the dialog
// off-center. The wrapper holds the fixed positioning; Content is a flow child.
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

const alertClasses =
  'mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 ' +
  'dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300';

export type ConfirmDeleteDialogProps = {
  /** `header` renders a labelled text button; `row` renders the icon-only trigger. */
  variant: Variant;
  /**
   * Accessible name for the trigger. Rendered as the button text in the
   * `header` variant; used as `aria-label`/`title` on the icon in the `row`
   * variant.
   */
  triggerLabel: string;
  /**
   * Stop the trigger click from bubbling — needed when the trigger sits inside
   * a clickable/navigating row (the dashboard year rows).
   */
  stopTriggerPropagation?: boolean;
  /** Dialog heading. */
  title: string;
  /** Dialog body / description. */
  description: string;
  /** Label for the destructive confirm button. */
  confirmLabel: string;
  /** Label for the cancel button. */
  cancelLabel: string;
  /** Hebrew fallback shown when the failure is not an `ApiError` with a message. */
  errorFallback: string;
  /** The delete request. Rejection keeps the dialog open with the error text. */
  onConfirm: () => Promise<unknown>;
  /**
   * Runs after a successful delete, once the dialog has closed — the caller's
   * query invalidations and any navigation.
   */
  onSuccess?: () => void | Promise<void>;
};

export function ConfirmDeleteDialog({
  variant,
  triggerLabel,
  stopTriggerPropagation = false,
  title,
  description,
  confirmLabel,
  cancelLabel,
  errorFallback,
  onConfirm,
  onSuccess,
}: ConfirmDeleteDialogProps) {
  const [open, setOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: onConfirm,
    onSuccess: async () => {
      // Close first, then run the caller's invalidations/navigation so we never
      // toggle open state on an unmounted tree (the tax-year case navigates away).
      setOpen(false);
      await onSuccess?.();
    },
  });

  const errorText =
    mutation.error instanceof ApiError && mutation.error.message
      ? mutation.error.message
      : errorFallback;

  const isRow = variant === 'row';

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
        aria-label={isRow ? triggerLabel : undefined}
        title={isRow ? triggerLabel : undefined}
        onClick={
          stopTriggerPropagation ? (event) => event.stopPropagation() : undefined
        }
      >
        {isRow ? <TrashIcon /> : triggerLabel}
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={overlayClasses} />
        <div className={positioningClasses}>
          <AlertDialog.Content className={contentClasses}>
            <AlertDialog.Title className={titleClasses}>{title}</AlertDialog.Title>
            <AlertDialog.Description className={bodyClasses}>
              {description}
            </AlertDialog.Description>
            {mutation.isError ? (
              <p role="alert" className={alertClasses}>
                {errorText}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <AlertDialog.Cancel className={cancelButtonClasses} disabled={mutation.isPending}>
                {cancelLabel}
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
                {confirmLabel}
              </button>
            </div>
          </AlertDialog.Content>
        </div>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
