import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRouteApi, Link } from '@tanstack/react-router';
import { formatILS } from '@taxreturns/shared';
import { useTranslation } from 'react-i18next';
import {
  ApiError,
  type CalculationSnapshot,
  getCalculation,
  listTaxYears,
  type TaxYear,
  type TaxYearStatus,
  updateTaxYearStatus,
} from '../api/client';
import { TaxYearStatusChip } from '../components/StatusChip';

const route = getRouteApi('/tax-years/$taxYearId/filing');

/**
 * Legal next steps per current status — MUST mirror the server-side map in
 * packages/api/src/routes/calculations.ts (the server enforces; the UI only
 * offers what the server would accept).
 */
const LEGAL_TRANSITIONS: Record<TaxYearStatus, readonly TaxYearStatus[]> = {
  draft: ['in_review'],
  in_review: ['draft', 'ready_to_file'],
  ready_to_file: ['in_review', 'filed'],
  filed: ['amended'],
  amended: ['in_review'],
};

/**
 * Preferred display order for `result.form1301Fields` keys. The map is
 * rendered GENERICALLY: every key the engine emits shows up — keys listed
 * here first, anything else appended in the engine's own order — and labels
 * come from i18n when present, falling back to the raw key. Engine-side key
 * renames (e.g. donationsEligible → '037') therefore cannot break this view.
 */
const FORM1301_FIELD_ORDER: readonly string[] = [
  '158',
  '042',
  '045',
  '037',
  '040',
  '166',
  'donationsEligible',
  'capitalTaxableGain',
  'capitalTax',
  'surtax',
  'totalLiability',
  'refund',
];

const dateFormatter = new Intl.DateTimeFormat('he-IL', { dateStyle: 'medium' });
const dateTimeFormatter = new Intl.DateTimeFormat('he-IL', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const panelClasses =
  'rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-6';

const panelHeadingClasses = 'text-base font-semibold text-neutral-900 dark:text-neutral-100';

const mutedTextClasses = 'text-sm text-neutral-500 dark:text-neutral-400';

const linkClasses =
  'font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300';

const primaryButtonClasses =
  'inline-flex items-center justify-center rounded-md bg-blue-700 px-4 py-1.5 text-sm font-medium text-white ' +
  'shadow-sm transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50 ' +
  'dark:bg-blue-600 dark:hover:bg-blue-500';

const alertClasses =
  'rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 ' +
  'dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300';

const amberNoticeClasses =
  'rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 ' +
  'dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200';

const strongWarningClasses =
  'rounded-lg border-2 border-amber-500 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950 ' +
  'dark:border-amber-500 dark:bg-amber-950/50 dark:text-amber-100';

// --- status flow -------------------------------------------------------------

function StatusPanel({ taxYear }: { taxYear: TaxYear }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (status: TaxYearStatus) => updateTaxYearStatus(taxYear.id, status),
    onSuccess: async () => {
      // Prefix invalidation refreshes the years list (dashboard + this
      // screen's chip), the detail screen, and the calculation query
      // (['tax-years', id, 'calculation']).
      await queryClient.invalidateQueries({ queryKey: ['tax-years'] });
    },
  });

  const error = mutation.error;
  const errorText =
    error instanceof ApiError && error.status === 400
      ? error.message
      : t('filing.statusUpdateError');

  return (
    <section aria-labelledby="filing-status-title" className={panelClasses}>
      <h2 id="filing-status-title" className={panelHeadingClasses}>
        {t('filing.statusPanel')}
      </h2>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <TaxYearStatusChip status={taxYear.status} />
        {taxYear.filedAt ? (
          <span className={mutedTextClasses}>
            {t('filing.filedAt', {
              date: dateFormatter.format(new Date(taxYear.filedAt)),
            })}
          </span>
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        {LEGAL_TRANSITIONS[taxYear.status].map((next) => (
          <button
            key={next}
            type="button"
            onClick={() => mutation.mutate(next)}
            disabled={mutation.isPending}
            className={primaryButtonClasses}
          >
            {t(`filing.transitions.${next}`)}
          </button>
        ))}
      </div>
      {mutation.isError ? (
        <p role="alert" className={`mt-4 ${alertClasses}`}>
          {errorText}
        </p>
      ) : null}
    </section>
  );
}

// --- Form 1301 transcription table -------------------------------------------

type Form1301Fields = CalculationSnapshot['result']['form1301Fields'];
type Form1301Entry = [string, Form1301Fields[string]];

function orderedForm1301Entries(fields: Form1301Fields): Form1301Entry[] {
  const known = FORM1301_FIELD_ORDER.filter((code) => code in fields).map(
    (code): Form1301Entry => [code, fields[code]!],
  );
  const unknown = Object.entries(fields).filter(
    ([code]) => !FORM1301_FIELD_ORDER.includes(code),
  );
  return [...known, ...unknown];
}

function Form1301Panel({ snapshot }: { snapshot: CalculationSnapshot }) {
  const { t, i18n } = useTranslation();

  /** Hebrew label for a 1301 field key; unknown keys fall back to the key. */
  function fieldLabel(code: string): string {
    const key = `filing.form1301Labels.${code}`;
    return i18n.exists(key) ? t(key) : code;
  }

  const cellClasses = 'px-3 py-2';
  const headerCellClasses =
    'px-3 py-2 text-start text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400';

  return (
    <section aria-labelledby="form1301-panel-title" className={panelClasses}>
      <h2 id="form1301-panel-title" className={panelHeadingClasses}>
        {t('filing.form1301Panel')}
      </h2>
      <div className={`mt-3 ${strongWarningClasses}`}>
        {t('filing.ownerVerificationWarning')}
      </div>
      {snapshot.stale ? (
        <div className={`mt-3 ${amberNoticeClasses}`}>{t('filing.staleWarning')}</div>
      ) : null}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-800">
              <th scope="col" className={headerCellClasses}>
                {t('filing.columnCode')}
              </th>
              <th scope="col" className={headerCellClasses}>
                {t('filing.columnLabel')}
              </th>
              <th scope="col" className={headerCellClasses}>
                {t('filing.columnValue')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {orderedForm1301Entries(snapshot.result.form1301Fields).map(
              ([code, value]) => (
                <tr key={code}>
                  <th
                    scope="row"
                    className={`${cellClasses} text-start font-mono font-medium text-neutral-900 dark:text-neutral-100`}
                  >
                    {code}
                  </th>
                  <td className={`${cellClasses} text-neutral-700 dark:text-neutral-300`}>
                    {fieldLabel(code)}
                  </td>
                  {/* All form1301Fields values are integer agorot
                      (Record<string, Agorot> in the engine) — always money. */}
                  <td
                    className={`${cellClasses} whitespace-nowrap font-medium tabular-nums text-neutral-900 dark:text-neutral-100`}
                  >
                    {formatILS(value)}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
      <p className={`mt-4 ${mutedTextClasses}`}>
        {t('filing.auditStamp', {
          engineVersion: snapshot.engineVersion,
          createdAt: dateTimeFormatter.format(new Date(snapshot.createdAt)),
        })}
      </p>
    </section>
  );
}

function NoCalculationPanel({ taxYearId }: { taxYearId: string }) {
  const { t } = useTranslation();
  return (
    <section className={panelClasses}>
      <div className="rounded-lg border border-dashed border-neutral-300 px-6 py-8 text-center dark:border-neutral-700">
        <p className={mutedTextClasses}>{t('filing.noCalculation')}</p>
        <p className="mt-3">
          <Link
            to="/tax-years/$taxYearId"
            params={{ taxYearId }}
            className={`text-sm ${linkClasses}`}
          >
            {t('filing.goToYear')}
          </Link>
        </p>
      </div>
    </section>
  );
}

// --- screen -------------------------------------------------------------------

export function Filing() {
  const { t } = useTranslation();
  const { taxYearId } = route.useParams();
  const taxYearsQuery = useQuery({ queryKey: ['tax-years'], queryFn: listTaxYears });
  const taxYear = taxYearsQuery.data?.find((candidate) => candidate.id === taxYearId);
  const calculationQuery = useQuery({
    queryKey: ['tax-years', taxYearId, 'calculation'],
    queryFn: () => getCalculation(taxYearId),
  });

  return (
    <main>
      <nav className="mb-4 text-sm">
        <Link to="/tax-years/$taxYearId" params={{ taxYearId }} className={linkClasses}>
          {t('filing.backToYear')}
        </Link>
      </nav>
      <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
        {taxYear
          ? t('filing.title', { year: taxYear.year })
          : t('filing.titleUnknown')}
      </h1>
      <div className="mt-6 flex flex-col gap-4">
        {taxYear ? <StatusPanel taxYear={taxYear} /> : null}
        {calculationQuery.isPending ? (
          <p className={mutedTextClasses}>{t('common.loading')}</p>
        ) : calculationQuery.isError ? (
          <div role="alert" className={alertClasses}>
            {t('common.loadError')}
          </div>
        ) : calculationQuery.data === null ? (
          <NoCalculationPanel taxYearId={taxYearId} />
        ) : (
          <Form1301Panel snapshot={calculationQuery.data} />
        )}
      </div>
    </main>
  );
}
