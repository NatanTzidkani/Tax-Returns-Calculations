import { useQuery } from '@tanstack/react-query';
import { type Agorot, agorot, formatILS } from '@taxreturns/shared';
import { useTranslation } from 'react-i18next';
import { getConfirmedData } from '../api/client';

/**
 * The tax-year detail's DATA panel (design spec §6 screen 2): the year's
 * confirmed document values grouped שכר / תרומות / שוק ההון — served by the
 * same server-side mapper the calculate route consumes, so what the reviewer
 * sees here is exactly what the next calculation will use. Read-only:
 * corrections belong to the document-review screen.
 */

const panelClasses =
  'rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-6';

const panelHeadingClasses = 'text-base font-semibold text-neutral-900 dark:text-neutral-100';

const groupHeadingClasses =
  'text-sm font-semibold text-neutral-800 dark:text-neutral-200';

const itemNameClasses = 'text-sm font-medium text-neutral-900 dark:text-neutral-100';

const mutedTextClasses = 'text-sm text-neutral-500 dark:text-neutral-400';

const alertClasses =
  'rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 ' +
  'dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300';

const amberNoticeClasses =
  'rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 ' +
  'dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200';

function MoneyRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-0.5">
      <span className={mutedTextClasses}>{label}</span>
      <span className="text-sm tabular-nums text-neutral-900 dark:text-neutral-100">
        {formatILS(agorot(value) as Agorot)}
      </span>
    </div>
  );
}

export function DataPanel({ taxYearId }: { taxYearId: string }) {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: ['tax-years', taxYearId, 'confirmed-data'],
    queryFn: () => getConfirmedData(taxYearId),
  });
  const data = query.data;
  const isEmpty =
    data !== undefined &&
    data.salaries.length === 0 &&
    data.donations.length === 0 &&
    data.excludedDonations === 0 &&
    data.capital.entries.length === 0 &&
    data.capital.lossCarryforwardInAgorot === 0;

  return (
    <section aria-labelledby="data-panel-title" className={panelClasses}>
      <h2 id="data-panel-title" className={panelHeadingClasses}>
        {t('taxYearDetail.dataPanel')}
      </h2>
      {query.isPending ? (
        <p className={`mt-4 ${mutedTextClasses}`}>{t('common.loading')}</p>
      ) : query.isError ? (
        <div role="alert" className={`mt-4 ${alertClasses}`}>
          {t('common.loadError')}
        </div>
      ) : isEmpty ? (
        <p className={`mt-4 ${mutedTextClasses}`}>{t('taxYearDetail.dataPlaceholder')}</p>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          <p className={mutedTextClasses}>{t('dataPanel.note')}</p>
          {data!.salaries.length > 0 ? (
            <div>
              <h3 className={groupHeadingClasses}>{t('dataPanel.salariesTitle')}</h3>
              {data!.salaries.map((salary, index) => (
                <div key={index} className="mt-2">
                  <p className={itemNameClasses}>{salary.employerName}</p>
                  <MoneyRow label={t('dataPanel.gross')} value={salary.grossSalaryAgorot} />
                  <MoneyRow
                    label={t('dataPanel.withheld')}
                    value={salary.taxWithheldAgorot}
                  />
                  <MoneyRow
                    label={t('dataPanel.pension')}
                    value={salary.pensionEmployeeContributionAgorot}
                  />
                </div>
              ))}
            </div>
          ) : null}
          {data!.donations.length > 0 || data!.excludedDonations > 0 ? (
            <div>
              <h3 className={groupHeadingClasses}>{t('dataPanel.donationsTitle')}</h3>
              {data!.donations.map((donation, index) => (
                <div key={index} className="mt-1">
                  <MoneyRow label={donation.institutionName} value={donation.amountAgorot} />
                </div>
              ))}
              {data!.excludedDonations > 0 ? (
                <p className={`mt-2 ${amberNoticeClasses}`}>
                  {t('dataPanel.excludedDonationsNote', { n: data!.excludedDonations })}
                </p>
              ) : null}
            </div>
          ) : null}
          {data!.capital.entries.length > 0 ||
          data!.capital.lossCarryforwardInAgorot > 0 ? (
            <div>
              <h3 className={groupHeadingClasses}>{t('dataPanel.capitalTitle')}</h3>
              {data!.capital.entries.map((entry, index) => (
                <div key={index} className="mt-2">
                  <p className={itemNameClasses}>{entry.brokerName}</p>
                  <MoneyRow label={t('dataPanel.realGains')} value={entry.realGainAgorot} />
                  <MoneyRow label={t('dataPanel.realLosses')} value={entry.realLossAgorot} />
                  <MoneyRow
                    label={t('dataPanel.interestDividend')}
                    value={entry.interestDividendAgorot}
                  />
                  <MoneyRow
                    label={t('dataPanel.capitalWithheld')}
                    value={entry.taxWithheldAgorot}
                  />
                </div>
              ))}
              {data!.capital.lossCarryforwardInAgorot > 0 ? (
                <div className="mt-2 border-t border-neutral-200 pt-1 dark:border-neutral-800">
                  <MoneyRow
                    label={t('dataPanel.carryIn')}
                    value={data!.capital.lossCarryforwardInAgorot}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
