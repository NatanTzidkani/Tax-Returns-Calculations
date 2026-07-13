import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type Agorot,
  agorot,
  CalculateRequestSchema,
  formatILS,
} from '@taxreturns/shared';
import type { BracketRow, TaxReturnResult } from '@taxreturns/tax-engine';
import { Label } from 'radix-ui';
import { type FormEvent, type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type CalculateRequestBody,
  calculateTaxYear,
  getCalculation,
} from '../api/client';

/**
 * The calculation worksheet (Plan 5): a small taxpayer form + the full,
 * auditable breakdown of the latest calculation snapshot. Renders ONLY the
 * engine's `result` — every intermediate number the engine exposes.
 */

const createdAtFormatter = new Intl.DateTimeFormat('he-IL', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const labelClasses = 'text-sm font-medium text-neutral-700 dark:text-neutral-300';

const fieldClasses =
  'rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 shadow-sm ' +
  'transition-colors focus:border-blue-600 focus:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-blue-600 focus-visible:ring-offset-1 dark:border-neutral-700 dark:bg-neutral-900 ' +
  'dark:text-neutral-100 dark:focus-visible:ring-offset-neutral-950';

const primaryButtonClasses =
  'inline-flex items-center justify-center rounded-md bg-blue-700 px-4 py-1.5 text-sm font-medium text-white ' +
  'shadow-sm transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50 ' +
  'dark:bg-blue-600 dark:hover:bg-blue-500';

const alertClasses =
  'rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 ' +
  'dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300';

const amberNoticeClasses =
  'rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 ' +
  'dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-300';

const infoNoticeClasses =
  'rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 ' +
  'dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300';

const mutedTextClasses = 'text-sm text-neutral-500 dark:text-neutral-400';

const panelClasses =
  'rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-6';

const panelHeadingClasses = 'text-base font-semibold text-neutral-900 dark:text-neutral-100';

const sectionHeadingClasses =
  'text-sm font-semibold text-neutral-900 dark:text-neutral-100';

const headerCellClasses =
  'px-3 py-2 text-start text-xs font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-400';

const moneyCellClasses =
  'px-3 py-2 text-sm tabular-nums text-neutral-900 dark:text-neutral-100';

/** rateBp (e.g. 1400 = 14%) → "14%". Basis points are exact integers. */
function formatRateBp(rateBp: number): string {
  return `${rateBp / 100}%`;
}

function MoneyRow({ label, value }: { label: string; value: Agorot }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <dt className="text-sm text-neutral-600 dark:text-neutral-400">{label}</dt>
      <dd className="text-sm font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
        {formatILS(value)}
      </dd>
    </div>
  );
}

function WorksheetSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-neutral-200 pt-4 dark:border-neutral-800">
      <h3 className={sectionHeadingClasses}>{title}</h3>
      {children}
    </section>
  );
}

function BracketsTable({ rows }: { rows: BracketRow[] }) {
  const { t } = useTranslation();
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
      <table className="w-full border-collapse text-start">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950/40">
            <th scope="col" className={headerCellClasses}>
              {t('worksheet.bracketFrom')}
            </th>
            <th scope="col" className={headerCellClasses}>
              {t('worksheet.bracketTo')}
            </th>
            <th scope="col" className={headerCellClasses}>
              {t('worksheet.bracketRate')}
            </th>
            <th scope="col" className={headerCellClasses}>
              {t('worksheet.bracketTaxed')}
            </th>
            <th scope="col" className={headerCellClasses}>
              {t('worksheet.bracketTax')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {rows.map((row) => (
            <tr key={row.fromAgorot}>
              <td className={moneyCellClasses}>{formatILS(row.fromAgorot)}</td>
              <td className={moneyCellClasses}>
                {row.toAgorot === null
                  ? t('worksheet.bracketOpenEnded')
                  : formatILS(row.toAgorot)}
              </td>
              <td className={moneyCellClasses}>{formatRateBp(row.rateBp)}</td>
              <td className={moneyCellClasses}>{formatILS(row.taxedAmountAgorot)}</td>
              <td className={moneyCellClasses}>{formatILS(row.taxAgorot)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TaxpayerForm({
  taxYearId,
  onCalculated,
}: {
  taxYearId: string;
  onCalculated: (excludedDonations: number) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [additionalPoints, setAdditionalPoints] = useState('');
  const [invalidPoints, setInvalidPoints] = useState(false);
  const mutation = useMutation({
    mutationFn: (body: CalculateRequestBody) => calculateTaxYear(taxYearId, body),
    onSuccess: async (response) => {
      onCalculated(response.metadata.excludedDonations);
      // Prefix invalidation refreshes both this year's calculation query and
      // the dashboard's refund estimates.
      await queryClient.invalidateQueries({ queryKey: ['tax-years'] });
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body: CalculateRequestBody = {
      taxpayer: {
        gender,
        additionalCreditPoints:
          additionalPoints.trim() === '' ? 0 : Number(additionalPoints),
      },
    };
    // The shared schema is the single source of truth for validity.
    if (!CalculateRequestSchema.safeParse(body).success) {
      setInvalidPoints(true);
      return;
    }
    setInvalidPoints(false);
    mutation.mutate(body);
  }

  return (
    // noValidate: the shared Zod schema owns validity (see onSubmit). Native
    // number-input constraints (step/min) would otherwise block submit for a
    // step-invalid entry before our localized Hebrew message could show.
    <form onSubmit={onSubmit} noValidate className="mt-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label.Root htmlFor="worksheet-gender-select" className={labelClasses}>
            {t('worksheet.genderLabel')}
          </Label.Root>
          <select
            id="worksheet-gender-select"
            value={gender}
            onChange={(event) => setGender(event.target.value as 'male' | 'female')}
            className={fieldClasses}
          >
            <option value="male">{t('worksheet.genderMale')}</option>
            <option value="female">{t('worksheet.genderFemale')}</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label.Root htmlFor="worksheet-points-input" className={labelClasses}>
            {t('worksheet.additionalPointsLabel')}
          </Label.Root>
          <input
            id="worksheet-points-input"
            type="number"
            inputMode="decimal"
            min={0}
            step={0.25}
            value={additionalPoints}
            onChange={(event) => setAdditionalPoints(event.target.value)}
            className={`${fieldClasses} w-28`}
          />
        </div>
        <button type="submit" disabled={mutation.isPending} className={primaryButtonClasses}>
          {t('worksheet.calculateButton')}
        </button>
      </div>
      <p className={mutedTextClasses}>{t('worksheet.additionalPointsHelp')}</p>
      {invalidPoints ? (
        <p role="alert" className={alertClasses}>
          {t('worksheet.invalidPoints')}
        </p>
      ) : null}
      {mutation.isError ? (
        <p role="alert" className={alertClasses}>
          {t('worksheet.calculateError')}
        </p>
      ) : null}
    </form>
  );
}

function RefundHeadline({ refundAgorot }: { refundAgorot: Agorot }) {
  const { t } = useTranslation();
  const isRefund = refundAgorot >= 0;
  const amount = formatILS(agorot(Math.abs(refundAgorot)));
  return (
    <p
      className={
        isRefund
          ? 'rounded-lg bg-green-50 px-4 py-3 text-lg font-bold tabular-nums text-green-800 dark:bg-green-950/40 dark:text-green-300'
          : 'rounded-lg bg-red-50 px-4 py-3 text-lg font-bold tabular-nums text-red-800 dark:bg-red-950/40 dark:text-red-300'
      }
    >
      {t(isRefund ? 'worksheet.refund' : 'worksheet.owed')}: {amount}
    </p>
  );
}

function Worksheet({
  result,
  engineVersion,
  createdAt,
  stale,
  excludedDonations,
}: {
  result: TaxReturnResult;
  engineVersion: string;
  createdAt: string;
  stale: boolean;
  excludedDonations: number | null;
}) {
  const { t } = useTranslation();
  return (
    <div className="mt-4 flex flex-col gap-4">
      {stale ? (
        <p role="alert" className={amberNoticeClasses}>
          {t('worksheet.staleNotice')}
        </p>
      ) : null}

      <RefundHeadline refundAgorot={result.refundAgorot} />

      {excludedDonations !== null && excludedDonations > 0 ? (
        <p className={infoNoticeClasses}>
          {t('worksheet.excludedDonationsNote', { n: excludedDonations })}
        </p>
      ) : null}
      {result.capitalGains.lossCarryforwardInAgorot !== 0 ? (
        <p className={amberNoticeClasses}>
          {t('worksheet.carryInNote', {
            amount: formatILS(result.capitalGains.lossCarryforwardInAgorot),
          })}
        </p>
      ) : null}
      {result.lossCarryforwardOutAgorot > 0 ? (
        <p className={infoNoticeClasses}>
          {t('worksheet.carryOutNote', {
            amount: formatILS(result.lossCarryforwardOutAgorot),
          })}
        </p>
      ) : null}

      <WorksheetSection title={t('worksheet.incomeTaxTitle')}>
        <dl className="mt-2">
          <MoneyRow
            label={t('worksheet.taxableIncome')}
            value={result.incomeTax.taxableIncomeAgorot}
          />
        </dl>
        <BracketsTable rows={result.incomeTax.rows} />
        <dl className="mt-2">
          <MoneyRow
            label={t('worksheet.incomeTaxTotal')}
            value={result.incomeTax.totalAgorot}
          />
        </dl>
      </WorksheetSection>

      <WorksheetSection title={t('worksheet.creditPointsTitle')}>
        <ul className="mt-2">
          {result.creditPoints.breakdown.map((row) => (
            <li
              key={row.reason}
              className="flex items-baseline justify-between gap-4 py-1 text-sm text-neutral-600 dark:text-neutral-400"
            >
              <span>{t(`worksheet.creditReason.${row.reason}`)}</span>
              <span className="font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
                {row.points}
              </span>
            </li>
          ))}
        </ul>
        <dl>
          <div className="flex items-baseline justify-between gap-4 py-1">
            <dt className="text-sm text-neutral-600 dark:text-neutral-400">
              {t('worksheet.creditPointsTotal')}
            </dt>
            <dd className="text-sm font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
              {result.creditPoints.points}
            </dd>
          </div>
          <MoneyRow
            label={t('worksheet.creditPointsValue')}
            value={result.creditPoints.valueAgorot}
          />
        </dl>
      </WorksheetSection>

      <WorksheetSection title={t('worksheet.pensionTitle')}>
        <dl className="mt-2">
          <MoneyRow
            label={t('worksheet.pensionContributions')}
            value={result.pension.totalEmployeeContributionsAgorot}
          />
          <MoneyRow
            label={t('worksheet.pensionQualifyingIncome')}
            value={result.pension.qualifyingIncomeAgorot}
          />
          <MoneyRow
            label={t('worksheet.pensionContributionCap')}
            value={result.pension.contributionCapAgorot}
          />
          <MoneyRow
            label={t('worksheet.pensionCredited')}
            value={result.pension.creditedContributionAgorot}
          />
          <MoneyRow label={t('worksheet.pensionCredit')} value={result.pension.creditAgorot} />
        </dl>
      </WorksheetSection>

      <WorksheetSection title={t('worksheet.charityTitle')}>
        {result.charity.belowMinimum ? (
          <p className={`mt-2 ${mutedTextClasses}`}>{t('worksheet.charityBelowMinimum')}</p>
        ) : null}
        <dl className="mt-2">
          <MoneyRow
            label={t('worksheet.charityTotal')}
            value={result.charity.totalDonationsAgorot}
          />
          <MoneyRow
            label={t('worksheet.charityAppliedCeiling')}
            value={result.charity.appliedCeilingAgorot}
          />
          <MoneyRow
            label={t('worksheet.charityEligible')}
            value={result.charity.eligibleAgorot}
          />
          <MoneyRow label={t('worksheet.charityCredit')} value={result.charity.creditAgorot} />
          <MoneyRow
            label={t('worksheet.charityCarryforwardOut')}
            value={result.charity.carryforwardOutAgorot}
          />
        </dl>
      </WorksheetSection>

      <WorksheetSection title={t('worksheet.capitalTitle')}>
        <dl className="mt-2">
          <MoneyRow
            label={t('worksheet.capitalRealGains')}
            value={result.capitalGains.totalRealGainsAgorot}
          />
          <MoneyRow
            label={t('worksheet.capitalRealLosses')}
            value={result.capitalGains.totalRealLossesAgorot}
          />
          <MoneyRow
            label={t('worksheet.capitalInterestDividend')}
            value={result.capitalGains.totalInterestDividendAgorot}
          />
          <MoneyRow
            label={t('worksheet.capitalCarryIn')}
            value={result.capitalGains.lossCarryforwardInAgorot}
          />
          <MoneyRow
            label={t('worksheet.capitalOffsetGains')}
            value={result.capitalGains.lossesOffsetAgainstGainsAgorot}
          />
          <MoneyRow
            label={t('worksheet.capitalOffsetInterest')}
            value={result.capitalGains.lossesOffsetAgainstInterestDividendAgorot}
          />
          <MoneyRow
            label={t('worksheet.capitalCarryConsumed')}
            value={result.capitalGains.carryforwardConsumedAgorot}
          />
          <MoneyRow
            label={t('worksheet.capitalTaxableGain')}
            value={result.capitalGains.taxableGainAgorot}
          />
          <MoneyRow
            label={t('worksheet.capitalTaxableInterest')}
            value={result.capitalGains.taxableInterestDividendAgorot}
          />
          <MoneyRow label={t('worksheet.capitalTax')} value={result.capitalGains.taxAgorot} />
          <MoneyRow
            label={t('worksheet.capitalWithheld')}
            value={result.capitalGains.withheldAgorot}
          />
          <MoneyRow
            label={t('worksheet.capitalCarryOut')}
            value={result.capitalGains.lossCarryforwardOutAgorot}
          />
        </dl>
      </WorksheetSection>

      {(result.nonLinkedInterest.amountAgorot > 0 ||
        result.nonLinkedInterest.withheldAgorot > 0) && (
        <WorksheetSection title={t('worksheet.nonLinkedInterest')}>
          <dl className="mt-2">
            <MoneyRow
              label={t('worksheet.nonLinkedInterestAmount')}
              value={result.nonLinkedInterest.amountAgorot}
            />
            <MoneyRow
              label={t('worksheet.nonLinkedInterestTax')}
              value={result.nonLinkedInterest.taxAgorot}
            />
            <MoneyRow
              label={t('worksheet.nonLinkedInterestWithheld')}
              value={result.nonLinkedInterest.withheldAgorot}
            />
          </dl>
        </WorksheetSection>
      )}

      <WorksheetSection title={t('worksheet.surtaxTitle')}>
        <dl className="mt-2">
          <MoneyRow
            label={t('worksheet.surtaxThreshold')}
            value={result.surtax.thresholdAgorot}
          />
          <MoneyRow label={t('worksheet.surtaxBase')} value={result.surtax.baseAgorot} />
          <MoneyRow
            label={t('worksheet.surtaxBasic')}
            value={result.surtax.basicSurtaxAgorot}
          />
          <MoneyRow
            label={t('worksheet.surtaxCapitalBase')}
            value={result.surtax.capitalBaseAgorot}
          />
          <MoneyRow
            label={t('worksheet.surtaxCapitalAdditional')}
            value={result.surtax.capitalAdditionalSurtaxAgorot}
          />
          <MoneyRow label={t('worksheet.surtaxTotal')} value={result.surtax.totalAgorot} />
        </dl>
      </WorksheetSection>

      <WorksheetSection title={t('worksheet.totalsTitle')}>
        <dl className="mt-2">
          <MoneyRow
            label={t('worksheet.creditsApplied')}
            value={result.creditsAppliedAgorot}
          />
          <MoneyRow label={t('worksheet.creditsUnused')} value={result.creditsUnusedAgorot} />
          <MoneyRow
            label={t('worksheet.incomeTaxAfterCredits')}
            value={result.incomeTaxAfterCreditsAgorot}
          />
          <MoneyRow label={t('worksheet.totalLiability')} value={result.totalLiabilityAgorot} />
          <MoneyRow label={t('worksheet.totalWithheld')} value={result.totalWithheldAgorot} />
        </dl>
      </WorksheetSection>

      <p className={`border-t border-neutral-200 pt-3 dark:border-neutral-800 ${mutedTextClasses}`}>
        {t('worksheet.auditStamp', {
          version: engineVersion,
          date: createdAtFormatter.format(new Date(createdAt)),
        })}
      </p>
    </div>
  );
}

export function WorksheetPanel({ taxYearId }: { taxYearId: string }) {
  const { t } = useTranslation();
  // excludedDonations arrives only on the calculate response's metadata (the
  // GET has no mapping context), so it is kept from the last mutation.
  const [excludedDonations, setExcludedDonations] = useState<number | null>(null);
  const calculationQuery = useQuery({
    queryKey: ['tax-years', taxYearId, 'calculation'],
    queryFn: () => getCalculation(taxYearId),
  });

  return (
    <section aria-labelledby="calculation-panel-title" className={panelClasses}>
      <h2 id="calculation-panel-title" className={panelHeadingClasses}>
        {t('taxYearDetail.calculationPanel')}
      </h2>
      {calculationQuery.isPending ? (
        <p className={`mt-4 ${mutedTextClasses}`}>{t('common.loading')}</p>
      ) : calculationQuery.isError ? (
        <div role="alert" className={`mt-4 ${alertClasses}`}>
          {t('common.loadError')}
        </div>
      ) : (
        <>
          {calculationQuery.data === null ? (
            <div className="mt-4 rounded-lg border border-dashed border-neutral-300 px-6 py-8 text-center dark:border-neutral-700">
              <p className={mutedTextClasses}>{t('worksheet.empty')}</p>
            </div>
          ) : null}
          <TaxpayerForm taxYearId={taxYearId} onCalculated={setExcludedDonations} />
          {calculationQuery.data !== null ? (
            <Worksheet
              result={calculationQuery.data.result}
              engineVersion={calculationQuery.data.engineVersion}
              createdAt={calculationQuery.data.createdAt}
              stale={calculationQuery.data.stale}
              excludedDonations={excludedDonations}
            />
          ) : null}
        </>
      )}
    </section>
  );
}
