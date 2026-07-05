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
    if (!Number.isInteger(parsed)) return;
    mutation.mutate(parsed);
  }

  return (
    <section aria-labelledby="add-tax-year-title" className="mt-8">
      <h2 id="add-tax-year-title" className="text-lg font-semibold text-neutral-900">
        {t('dashboard.addYearTitle')}
      </h2>
      <form onSubmit={onSubmit} className="mt-2 flex items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label.Root htmlFor="add-tax-year-input" className="text-sm text-neutral-700">
            {t('dashboard.addYearLabel')}
          </Label.Root>
          <input
            id="add-tax-year-input"
            name="year"
            type="number"
            inputMode="numeric"
            min={2020}
            max={2100}
            required
            value={year}
            onChange={(event) => setYear(event.target.value)}
            className="w-28 rounded border border-neutral-300 px-2 py-1 text-start"
          />
        </div>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded bg-blue-700 px-4 py-1.5 font-medium text-white disabled:opacity-50"
        >
          {t('dashboard.addYearSubmit')}
        </button>
      </form>
      {mutation.isError ? (
        <p role="alert" className="mt-2 text-sm text-red-700">
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
      <h1 className="text-xl font-bold text-neutral-900">{t('dashboard.title')}</h1>

      {taxYearsQuery.isPending ? (
        <p className="mt-4 text-neutral-600">{t('common.loading')}</p>
      ) : taxYearsQuery.isError ? (
        <p role="alert" className="mt-4 text-red-700">
          {t('common.loadError')}
        </p>
      ) : taxYearsQuery.data.length === 0 ? (
        <p className="mt-4 text-neutral-600">{t('dashboard.empty')}</p>
      ) : (
        <table className="mt-4 w-full border-collapse text-start">
          <thead>
            <tr className="border-b border-neutral-300 text-sm text-neutral-600">
              <th scope="col" className="py-2 pe-4 text-start font-medium">
                {t('dashboard.columnYear')}
              </th>
              <th scope="col" className="py-2 pe-4 text-start font-medium">
                {t('dashboard.columnStatus')}
              </th>
              <th scope="col" className="py-2 pe-4 text-start font-medium">
                {t('dashboard.columnDeadline')}
              </th>
              <th scope="col" className="py-2 text-start font-medium">
                {t('dashboard.columnRefund')}
              </th>
            </tr>
          </thead>
          <tbody>
            {taxYearsQuery.data.map((taxYear) => (
              <tr key={taxYear.id} className="border-b border-neutral-200">
                <td className="py-2 pe-4">
                  <Link
                    to="/tax-years/$taxYearId"
                    params={{ taxYearId: taxYear.id }}
                    className="font-medium text-blue-700 underline"
                  >
                    {taxYear.year}
                  </Link>
                </td>
                <td className="py-2 pe-4">
                  <TaxYearStatusChip status={taxYear.status} />
                </td>
                <td className="py-2 pe-4">
                  {taxYear.deadline
                    ? deadlineFormatter.format(new Date(taxYear.deadline))
                    : t('common.none')}
                </td>
                <td className="py-2">{refundCell(taxYear, t('common.none'))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <AddTaxYearForm />
    </main>
  );
}
