import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { agorot, formatILS } from '@taxreturns/shared';
import { Label } from 'radix-ui';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createTaxYear, listTaxYears, type TaxYear } from '../api/client';
import { TaxYearStatusChip } from '../components/StatusChip';

const deadlineFormatter = new Intl.DateTimeFormat('he-IL', { dateStyle: 'medium' });

function refundCell(taxYear: TaxYear, none: string): string {
  return taxYear.refundEstimateAgorot == null
    ? none
    : formatILS(agorot(taxYear.refundEstimateAgorot));
}

const labelClasses = 'text-sm font-medium text-neutral-700 dark:text-neutral-300';

const inputClasses =
  'w-28 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 shadow-sm ' +
  'transition-colors placeholder:text-neutral-400 focus:border-blue-600 focus:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 ' +
  'dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus-visible:ring-offset-neutral-950';

const primaryButtonClasses =
  'inline-flex items-center justify-center rounded-md bg-blue-700 px-4 py-1.5 text-sm font-medium text-white ' +
  'shadow-sm transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50 ' +
  'dark:bg-blue-600 dark:hover:bg-blue-500';

const alertClasses =
  'rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 ' +
  'dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300';

const mutedTextClasses = 'text-sm text-neutral-500 dark:text-neutral-400';

const headerCellClasses =
  'px-4 py-2.5 text-start text-xs font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-400';

const currentYear = new Date().getFullYear();

function AddTaxYearForm() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [year, setYear] = useState('');
  const mutation = useMutation({
    mutationFn: (value: number) => createTaxYear(value),
    onSuccess: async () => {
      setYear('');
      await queryClient.invalidateQueries({ queryKey: ['tax-years'] });
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = Number(year);
    if (!Number.isInteger(parsed) || parsed > currentYear) return;
    mutation.mutate(parsed);
  }

  return (
    <section aria-labelledby="add-tax-year-title" className="mt-8">
      <h2
        id="add-tax-year-title"
        className="text-base font-semibold text-neutral-900 dark:text-neutral-100"
      >
        {t('dashboard.addYearTitle')}
      </h2>
      <form onSubmit={onSubmit} className="mt-3 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label.Root htmlFor="add-tax-year-input" className={labelClasses}>
            {t('dashboard.addYearLabel')}
          </Label.Root>
          <input
            id="add-tax-year-input"
            name="year"
            type="number"
            inputMode="numeric"
            min={2020}
            max={currentYear}
            required
            value={year}
            onChange={(event) => setYear(event.target.value)}
            className={inputClasses}
          />
        </div>
        <button type="submit" disabled={mutation.isPending} className={primaryButtonClasses}>
          {t('dashboard.addYearSubmit')}
        </button>
      </form>
      {mutation.isError ? (
        <p role="alert" className={`mt-3 ${alertClasses}`}>
          {t('dashboard.addYearError')}
        </p>
      ) : null}
    </section>
  );
}

export function Dashboard() {
  const { t } = useTranslation();
  const taxYearsQuery = useQuery({ queryKey: ['tax-years'], queryFn: listTaxYears });

  return (
    <main>
      <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
        {t('dashboard.title')}
      </h1>

      {taxYearsQuery.isPending ? (
        <p className={`mt-6 ${mutedTextClasses}`}>{t('common.loading')}</p>
      ) : taxYearsQuery.isError ? (
        <div role="alert" className={`mt-6 ${alertClasses}`}>
          {t('common.loadError')}
        </div>
      ) : taxYearsQuery.data.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-neutral-300 px-6 py-10 text-center dark:border-neutral-700">
          <p className={mutedTextClasses}>{t('dashboard.empty')}</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full border-collapse text-start">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
                <th scope="col" className={headerCellClasses}>
                  {t('dashboard.columnYear')}
                </th>
                <th scope="col" className={headerCellClasses}>
                  {t('dashboard.columnStatus')}
                </th>
                <th scope="col" className={headerCellClasses}>
                  {t('dashboard.columnDeadline')}
                </th>
                <th scope="col" className={headerCellClasses}>
                  {t('dashboard.columnRefund')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {taxYearsQuery.data.map((taxYear) => (
                <tr
                  key={taxYear.id}
                  className="transition-colors even:bg-neutral-50/60 hover:bg-neutral-100 dark:even:bg-neutral-900/40 dark:hover:bg-neutral-800/60"
                >
                  <td className="px-4 py-3">
                    <Link
                      to="/tax-years/$taxYearId"
                      params={{ taxYearId: taxYear.id }}
                      className="rounded font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      {taxYear.year}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <TaxYearStatusChip status={taxYear.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-700 dark:text-neutral-300">
                    {taxYear.deadline
                      ? deadlineFormatter.format(new Date(taxYear.deadline))
                      : t('common.none')}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
                    {refundCell(taxYear, t('common.none'))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddTaxYearForm />
    </main>
  );
}
