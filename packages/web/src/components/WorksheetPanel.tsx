import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type Agorot,
  agorot,
  CalculateRequestSchema,
  formatILS,
  shekelsToAgorot,
} from '@taxreturns/shared';
import type { BracketRow, TaxReturnResult } from '@taxreturns/tax-engine';
import { Label } from 'radix-ui';
import { type FormEvent, type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ApiError,
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

const secondaryButtonClasses =
  'inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm ' +
  'font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50 focus-visible:outline ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ' +
  'dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800';

const checkboxClasses = 'size-4 accent-blue-700 dark:accent-blue-500';

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

/**
 * A blank ₪ entry → `undefined` (omit from the body: absent = 0, unchanged
 * behavior). Otherwise convert shekels to integer agorot via the shared money
 * helper (never hand-rolled float math); garbage/overflow becomes NaN so the
 * shared Zod schema rejects it instead of silently defaulting to 0.
 */
function optionalShekelsToAgorot(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return Number.NaN;
  try {
    return shekelsToAgorot(parsed);
  } catch {
    return Number.NaN;
  }
}

/**
 * A required integer entry → number for the shared Zod gate. Blank becomes
 * NaN (never a silent 0 — `Number('') === 0`) so `z.number().int()` rejects
 * it and the form shows the localized section message instead of submitting.
 */
function requiredInt(value: string): number {
  const trimmed = value.trim();
  if (trimmed === '') return Number.NaN;
  return Number(trimmed);
}

/**
 * The elected-claim-year input is shown only for completion years ≤ 2022
 * (the 2014-2022 cohort's single-elective rule). This is a DISPLAY
 * convenience only — the value is sent verbatim and the ENGINE remains the
 * validator of the cohort rules (plan:
 * docs/superpowers/plans/2026-07-14-credit-points-wiring.md).
 */
function electedYearVisible(completionYear: string): boolean {
  const trimmed = completionYear.trim();
  if (trimmed === '') return false;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed <= 2022;
}

/** Worksheet-form row state (strings: controlled inputs, parsed on submit). */
interface ChildRow {
  age: string;
  role: 'custodial' | 'other';
}

interface DegreeRow {
  track: 'bachelor' | 'master' | 'vocational';
  completionYear: string;
  studyYears: string;
  electedClaimYear: string;
  internship: boolean;
  internshipStart: string;
  internshipEnd: string;
}

const CHILD_AGES = Array.from({ length: 19 }, (_, age) => age);
const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

type InvalidSection = 'points' | 'interest' | 'children' | 'aliyah' | 'degrees';

const invalidMessageKeys: Record<InvalidSection, string> = {
  points: 'worksheet.invalidPoints',
  interest: 'worksheet.invalidInterest',
  children: 'worksheet.invalidChildren',
  aliyah: 'worksheet.invalidAliyah',
  degrees: 'worksheet.invalidDegrees',
};

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
  const [interest, setInterest] = useState('');
  const [interestWithheld, setInterestWithheld] = useState('');
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [aliyahOn, setAliyahOn] = useState(false);
  const [aliyahYear, setAliyahYear] = useState('');
  const [aliyahMonth, setAliyahMonth] = useState('1');
  const [aliyahVariant, setAliyahVariant] = useState<'pre2022' | 'from2022'>('from2022');
  const [degrees, setDegrees] = useState<DegreeRow[]>([]);
  const [invalid, setInvalid] = useState<InvalidSection | null>(null);
  const mutation = useMutation({
    mutationFn: (body: CalculateRequestBody) => calculateTaxYear(taxYearId, body),
    onSuccess: async (response) => {
      onCalculated(response.metadata.excludedDonations);
      // Prefix invalidation refreshes both this year's calculation query and
      // the dashboard's refund estimates.
      await queryClient.invalidateQueries({ queryKey: ['tax-years'] });
    },
  });

  function updateChild(index: number, patch: Partial<ChildRow>) {
    setChildren((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function updateDegree(index: number, patch: Partial<DegreeRow>) {
    setDegrees((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nonLinkedInterestAgorot = optionalShekelsToAgorot(interest);
    const nonLinkedInterestWithheldAgorot =
      optionalShekelsToAgorot(interestWithheld);
    const body: CalculateRequestBody = {
      taxpayer: {
        gender,
        additionalCreditPoints:
          additionalPoints.trim() === '' ? 0 : Number(additionalPoints),
        // Empty/off sections OMIT their key entirely — the engine
        // distinguishes `undefined` (not supplied) from `[]`.
        ...(children.length > 0
          ? {
              children: children.map((child) => ({
                ageInTaxYear: Number(child.age),
                role: child.role,
              })),
            }
          : {}),
        ...(aliyahOn
          ? {
              aliyah: {
                aliyahYear: requiredInt(aliyahYear),
                aliyahMonth: Number(aliyahMonth),
                scheduleVariant: aliyahVariant,
              },
            }
          : {}),
        ...(degrees.length > 0
          ? {
              degrees: degrees.map((degree) => ({
                track: degree.track,
                completionYear: requiredInt(degree.completionYear),
                studyYears: requiredInt(degree.studyYears),
                // Hidden (2023+) or blank elected year → omit; the visible
                // value is sent verbatim — the engine validates the cohort.
                ...(electedYearVisible(degree.completionYear) &&
                degree.electedClaimYear.trim() !== ''
                  ? { electedClaimYear: requiredInt(degree.electedClaimYear) }
                  : {}),
                ...(degree.internship
                  ? {
                      internship: {
                        startYear: requiredInt(degree.internshipStart),
                        endYear: requiredInt(degree.internshipEnd),
                      },
                    }
                  : {}),
              })),
            }
          : {}),
      },
      // Blank → omit so absent means 0 (unchanged behavior).
      ...(nonLinkedInterestAgorot !== undefined ? { nonLinkedInterestAgorot } : {}),
      ...(nonLinkedInterestWithheldAgorot !== undefined
        ? { nonLinkedInterestWithheldAgorot }
        : {}),
    };
    // The shared schema is the single source of truth for validity. On a
    // shape failure, point the Hebrew message at the offending section.
    const parsed = CalculateRequestSchema.safeParse(body);
    if (!parsed.success) {
      let section: InvalidSection = 'points';
      for (const issue of parsed.error.issues) {
        const head = issue.path[0];
        const second = issue.path[1];
        if (head === 'taxpayer' && second === 'children') {
          section = 'children';
          break;
        }
        if (head === 'taxpayer' && second === 'aliyah') {
          section = 'aliyah';
          break;
        }
        if (head === 'taxpayer' && second === 'degrees') {
          section = 'degrees';
          break;
        }
        if (String(head ?? '').startsWith('nonLinkedInterest')) {
          section = 'interest';
          break;
        }
      }
      setInvalid(section);
      return;
    }
    setInvalid(null);
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
        <div className="flex flex-col gap-1.5">
          <Label.Root
            htmlFor="worksheet-interest-input"
            className={labelClasses}
          >
            {t('worksheet.nonLinkedInterestInputLabel')}
          </Label.Root>
          <input
            id="worksheet-interest-input"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={interest}
            onChange={(event) => setInterest(event.target.value)}
            className={`${fieldClasses} w-36`}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label.Root
            htmlFor="worksheet-interest-withheld-input"
            className={labelClasses}
          >
            {t('worksheet.nonLinkedInterestWithheldInputLabel')}
          </Label.Root>
          <input
            id="worksheet-interest-withheld-input"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={interestWithheld}
            onChange={(event) => setInterestWithheld(event.target.value)}
            className={`${fieldClasses} w-36`}
          />
        </div>
      </div>
      <p className={mutedTextClasses}>{t('worksheet.additionalPointsHelp')}</p>
      <p className={mutedTextClasses}>{t('worksheet.nonLinkedInterestInputHelp')}</p>

      {/* Children (§40): dynamic rows — age in the tax year + parent role. */}
      <div className="flex flex-col gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
        <h3 className={sectionHeadingClasses}>{t('worksheet.childrenTitle')}</h3>
        {children.map((child, index) => (
          // Index keys are safe: rows are fully controlled from state.
          <div key={index} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label.Root htmlFor={`worksheet-child-${index}-age`} className={labelClasses}>
                {t('worksheet.childAgeLabel')}
              </Label.Root>
              <select
                id={`worksheet-child-${index}-age`}
                value={child.age}
                onChange={(event) => updateChild(index, { age: event.target.value })}
                className={`${fieldClasses} w-24`}
              >
                {CHILD_AGES.map((age) => (
                  <option key={age} value={String(age)}>
                    {age}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label.Root htmlFor={`worksheet-child-${index}-role`} className={labelClasses}>
                {t('worksheet.childRoleLabel')}
              </Label.Root>
              <select
                id={`worksheet-child-${index}-role`}
                value={child.role}
                onChange={(event) =>
                  updateChild(index, { role: event.target.value as 'custodial' | 'other' })
                }
                className={fieldClasses}
              >
                <option value="custodial">{t('worksheet.childRoleCustodial')}</option>
                <option value="other">{t('worksheet.childRoleOther')}</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() => setChildren((rows) => rows.filter((_, i) => i !== index))}
              className={secondaryButtonClasses}
            >
              {t('worksheet.removeChild')}
            </button>
          </div>
        ))}
        <div>
          <button
            type="button"
            onClick={() =>
              setChildren((rows) => [...rows, { age: '0', role: 'custodial' }])
            }
            className={secondaryButtonClasses}
          >
            {t('worksheet.addChild')}
          </button>
        </div>
        <p className={mutedTextClasses}>{t('worksheet.childrenHelp')}</p>
      </div>

      {/* Oleh (§35): an optional toggled record — year, month, schedule. */}
      <div className="flex flex-col gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <input
            id="worksheet-aliyah-toggle"
            type="checkbox"
            checked={aliyahOn}
            onChange={(event) => setAliyahOn(event.target.checked)}
            className={checkboxClasses}
          />
          <Label.Root htmlFor="worksheet-aliyah-toggle" className={labelClasses}>
            {t('worksheet.aliyahToggle')}
          </Label.Root>
        </div>
        {aliyahOn ? (
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label.Root htmlFor="worksheet-aliyah-year" className={labelClasses}>
                {t('worksheet.aliyahYearLabel')}
              </Label.Root>
              <input
                id="worksheet-aliyah-year"
                type="number"
                inputMode="numeric"
                value={aliyahYear}
                onChange={(event) => setAliyahYear(event.target.value)}
                className={`${fieldClasses} w-28`}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label.Root htmlFor="worksheet-aliyah-month" className={labelClasses}>
                {t('worksheet.aliyahMonthLabel')}
              </Label.Root>
              <select
                id="worksheet-aliyah-month"
                value={aliyahMonth}
                onChange={(event) => setAliyahMonth(event.target.value)}
                className={`${fieldClasses} w-24`}
              >
                {MONTHS.map((month) => (
                  <option key={month} value={String(month)}>
                    {month}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label.Root htmlFor="worksheet-aliyah-variant" className={labelClasses}>
                {t('worksheet.aliyahVariantLabel')}
              </Label.Root>
              <select
                id="worksheet-aliyah-variant"
                value={aliyahVariant}
                onChange={(event) =>
                  setAliyahVariant(event.target.value as 'pre2022' | 'from2022')
                }
                className={fieldClasses}
              >
                <option value="pre2022">{t('worksheet.aliyahVariantPre2022')}</option>
                <option value="from2022">{t('worksheet.aliyahVariantFrom2022')}</option>
              </select>
            </div>
          </div>
        ) : null}
      </div>

      {/* Degrees (§40ג-§40ה): dynamic rows — track, years, elective, internship. */}
      <div className="flex flex-col gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
        <h3 className={sectionHeadingClasses}>{t('worksheet.degreesTitle')}</h3>
        {degrees.map((degree, index) => (
          <div
            key={index}
            className="flex flex-col gap-2 rounded-md border border-neutral-200 p-3 dark:border-neutral-800"
          >
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <Label.Root htmlFor={`worksheet-degree-${index}-track`} className={labelClasses}>
                  {t('worksheet.degreeTrackLabel')}
                </Label.Root>
                <select
                  id={`worksheet-degree-${index}-track`}
                  value={degree.track}
                  onChange={(event) =>
                    updateDegree(index, {
                      track: event.target.value as DegreeRow['track'],
                    })
                  }
                  className={fieldClasses}
                >
                  <option value="bachelor">{t('worksheet.degreeTrackBachelor')}</option>
                  <option value="master">{t('worksheet.degreeTrackMaster')}</option>
                  <option value="vocational">{t('worksheet.degreeTrackVocational')}</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label.Root
                  htmlFor={`worksheet-degree-${index}-completion`}
                  className={labelClasses}
                >
                  {t('worksheet.degreeCompletionYearLabel')}
                </Label.Root>
                <input
                  id={`worksheet-degree-${index}-completion`}
                  type="number"
                  inputMode="numeric"
                  value={degree.completionYear}
                  onChange={(event) =>
                    updateDegree(index, { completionYear: event.target.value })
                  }
                  className={`${fieldClasses} w-28`}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label.Root
                  htmlFor={`worksheet-degree-${index}-study-years`}
                  className={labelClasses}
                >
                  {t('worksheet.degreeStudyYearsLabel')}
                </Label.Root>
                <input
                  id={`worksheet-degree-${index}-study-years`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={degree.studyYears}
                  onChange={(event) => updateDegree(index, { studyYears: event.target.value })}
                  className={`${fieldClasses} w-24`}
                />
              </div>
              {electedYearVisible(degree.completionYear) ? (
                <div className="flex flex-col gap-1.5">
                  <Label.Root
                    htmlFor={`worksheet-degree-${index}-elected`}
                    className={labelClasses}
                  >
                    {t('worksheet.degreeElectedYearLabel')}
                  </Label.Root>
                  <input
                    id={`worksheet-degree-${index}-elected`}
                    type="number"
                    inputMode="numeric"
                    value={degree.electedClaimYear}
                    onChange={(event) =>
                      updateDegree(index, { electedClaimYear: event.target.value })
                    }
                    className={`${fieldClasses} w-28`}
                  />
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => setDegrees((rows) => rows.filter((_, i) => i !== index))}
                className={secondaryButtonClasses}
              >
                {t('worksheet.removeDegree')}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                id={`worksheet-degree-${index}-internship`}
                type="checkbox"
                checked={degree.internship}
                onChange={(event) => updateDegree(index, { internship: event.target.checked })}
                className={checkboxClasses}
              />
              <Label.Root
                htmlFor={`worksheet-degree-${index}-internship`}
                className={labelClasses}
              >
                {t('worksheet.degreeInternshipToggle')}
              </Label.Root>
            </div>
            {degree.internship ? (
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label.Root
                    htmlFor={`worksheet-degree-${index}-internship-start`}
                    className={labelClasses}
                  >
                    {t('worksheet.degreeInternshipStartLabel')}
                  </Label.Root>
                  <input
                    id={`worksheet-degree-${index}-internship-start`}
                    type="number"
                    inputMode="numeric"
                    value={degree.internshipStart}
                    onChange={(event) =>
                      updateDegree(index, { internshipStart: event.target.value })
                    }
                    className={`${fieldClasses} w-28`}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label.Root
                    htmlFor={`worksheet-degree-${index}-internship-end`}
                    className={labelClasses}
                  >
                    {t('worksheet.degreeInternshipEndLabel')}
                  </Label.Root>
                  <input
                    id={`worksheet-degree-${index}-internship-end`}
                    type="number"
                    inputMode="numeric"
                    value={degree.internshipEnd}
                    onChange={(event) =>
                      updateDegree(index, { internshipEnd: event.target.value })
                    }
                    className={`${fieldClasses} w-28`}
                  />
                </div>
              </div>
            ) : null}
          </div>
        ))}
        <div>
          <button
            type="button"
            onClick={() =>
              setDegrees((rows) => [
                ...rows,
                {
                  track: 'bachelor',
                  completionYear: '',
                  studyYears: '',
                  electedClaimYear: '',
                  internship: false,
                  internshipStart: '',
                  internshipEnd: '',
                },
              ])
            }
            className={secondaryButtonClasses}
          >
            {t('worksheet.addDegree')}
          </button>
        </div>
      </div>

      <div className="border-t border-neutral-200 pt-3 dark:border-neutral-800">
        <button type="submit" disabled={mutation.isPending} className={primaryButtonClasses}>
          {t('worksheet.calculateButton')}
        </button>
      </div>
      {invalid !== null ? (
        <p role="alert" className={alertClasses}>
          {t(invalidMessageKeys[invalid])}
        </p>
      ) : null}
      {mutation.isError ? (
        <p role="alert" className={alertClasses}>
          {/* The engine's fail-loud errors reach us as 400s whose body is a
              Hebrew `{ message }` (ApiError.message) — show them verbatim so
              the reviewer sees WHY (e.g. the unsupported 6–17 child band).
              Anything without a usable message → generic Hebrew fallback. */}
          {mutation.error instanceof ApiError && mutation.error.message
            ? mutation.error.message
            : t('worksheet.calculateError')}
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
          {/* Index keys are safe here: the breakdown is a snapshot rendered
              whole (engine row order is stable), and reasons repeat (one row
              per child/degree) so `row.reason` alone would collide. */}
          {result.creditPoints.breakdown.map((row, index) => (
            <li
              key={`${index}-${row.reason}`}
              className="flex items-baseline justify-between gap-4 py-1 text-sm text-neutral-600 dark:text-neutral-400"
            >
              {/* The engine's Hebrew label says WHY (age band, degree year…);
                  the i18n reason name is only the label-less fallback. An
                  unknown future reason falls back to its raw token — never a
                  raw `worksheet.creditReason.*` key path. */}
              <span>
                {row.label ??
                  t(`worksheet.creditReason.${row.reason}`, {
                    defaultValue: row.reason,
                  })}
              </span>
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
