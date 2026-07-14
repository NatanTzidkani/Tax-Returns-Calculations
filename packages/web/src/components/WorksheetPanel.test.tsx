import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { agorot, formatILS } from '@taxreturns/shared';
import type { TaxReturnResult } from '@taxreturns/tax-engine';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CalculateResponse,
  CalculationSnapshot,
  TaxYear,
} from '../api/client';
import {
  ApiError,
  calculateTaxYear,
  getCalculation,
  getMe,
  listDocuments,
  listTaxYears,
} from '../api/client';
import { renderApp } from '../test/render';

// Partial mock: keep the real `ApiError` class so the panel's
// `instanceof ApiError` check (server Hebrew message surfacing) works.
vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    getMe: vi.fn(),
    listTaxYears: vi.fn(),
    listDocuments: vi.fn(),
    getCalculation: vi.fn(),
    calculateTaxYear: vi.fn(),
  };
});

const a = agorot;

const taxYear: TaxYear = { id: 'ty-2024', year: 2024, status: 'in_review' };

/** A full engine result — plain fixture numbers, not real tax math. */
function makeResult(overrides: Partial<TaxReturnResult> = {}): TaxReturnResult {
  return {
    engineVersion: 'il-2024.1',
    year: 2024,
    incomeTax: {
      taxableIncomeAgorot: a(24_000_000),
      rows: [
        {
          fromAgorot: a(0),
          toAgorot: a(8_412_000),
          rateBp: 1000,
          taxedAmountAgorot: a(8_412_000),
          taxAgorot: a(841_200),
        },
        {
          fromAgorot: a(8_412_000),
          toAgorot: null,
          rateBp: 1400,
          taxedAmountAgorot: a(15_588_000),
          taxAgorot: a(2_182_320),
        },
      ],
      totalAgorot: a(3_023_520),
    },
    creditPoints: {
      points: 2.25,
      breakdown: [{ reason: 'resident', points: 2.25 }],
      valueAgorot: a(653_400),
    },
    pension: {
      totalEmployeeContributionsAgorot: a(1_200_000),
      qualifyingIncomeAgorot: a(24_000_000),
      contributionCapAgorot: a(1_680_000),
      creditedContributionAgorot: a(1_200_000),
      creditAgorot: a(420_000),
    },
    charity: {
      totalDonationsAgorot: a(500_000),
      appliedCeilingAgorot: a(7_200_000),
      eligibleAgorot: a(500_000),
      creditAgorot: a(175_000),
      carryforwardOutAgorot: a(0),
      belowMinimum: false,
    },
    creditsAppliedAgorot: a(1_248_400),
    creditsUnusedAgorot: a(0),
    incomeTaxAfterCreditsAgorot: a(1_775_120),
    capitalGains: {
      totalRealGainsAgorot: a(1_000_000),
      totalRealLossesAgorot: a(200_000),
      totalInterestDividendAgorot: a(300_000),
      lossCarryforwardInAgorot: a(0),
      lossesOffsetAgainstGainsAgorot: a(200_000),
      lossesOffsetAgainstInterestDividendAgorot: a(0),
      carryforwardConsumedAgorot: a(0),
      taxableGainAgorot: a(800_000),
      taxableInterestDividendAgorot: a(300_000),
      taxAgorot: a(275_000),
      withheldAgorot: a(250_000),
      lossCarryforwardOutAgorot: a(0),
    },
    nonLinkedInterest: {
      reason: 'nonLinkedInterest',
      amountAgorot: a(0),
      rateBp: 1500,
      taxAgorot: a(0),
      withheldAgorot: a(0),
    },
    surtax: {
      thresholdAgorot: a(72_000_000),
      baseAgorot: a(0),
      basicSurtaxAgorot: a(0),
      capitalBaseAgorot: a(0),
      capitalAdditionalSurtaxAgorot: a(0),
      totalAgorot: a(0),
    },
    totalLiabilityAgorot: a(2_050_120),
    totalWithheldAgorot: a(2_173_576),
    refundAgorot: a(123_456),
    lossCarryforwardOutAgorot: a(0),
    nationalInsurance: {
      informational: true,
      expectedEmployeeAgorot: a(0),
      withheldEmployeeAgorot: null,
      differenceAgorot: null,
    },
    form1301Fields: {},
    ...overrides,
  };
}

function makeCalculation(
  overrides: Partial<CalculationSnapshot> = {},
  resultOverrides: Partial<TaxReturnResult> = {},
): CalculationSnapshot {
  return {
    id: 'calc-1',
    taxYearId: 'ty-2024',
    engineVersion: 'il-2024.1',
    input: {} as CalculationSnapshot['input'],
    result: makeResult(resultOverrides),
    createdAt: '2026-07-10T09:30:00.000Z',
    stale: false,
    ...overrides,
  };
}

/** A successful calculate response wrapping the default fixture result. */
function makeResponse(): CalculateResponse {
  const calculated = makeCalculation();
  return {
    id: calculated.id,
    taxYearId: calculated.taxYearId,
    engineVersion: calculated.engineVersion,
    input: calculated.input,
    result: calculated.result,
    createdAt: calculated.createdAt,
    metadata: { excludedDonations: 0 },
  };
}

// formatILS output contains non-breaking/direction marks; Testing Library
// hands matchers whitespace-normalized text, so normalize both sides.
const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
const ils = (value: number) => normalize(formatILS(a(value)));

function findMoneyText(amountAgorot: number) {
  return screen.getAllByText(
    (content) => normalize(content) === ils(amountAgorot),
  );
}

/** The refund/owed headline <p> (its text is split across nodes). */
function headline() {
  return screen.getByText(
    (_, element) =>
      element?.tagName === 'P' &&
      (normalize(element.textContent ?? '').startsWith('החזר מס') ||
        normalize(element.textContent ?? '').startsWith('יתרה לתשלום')),
  );
}

beforeEach(() => {
  vi.mocked(listTaxYears).mockReset().mockResolvedValue([taxYear]);
  vi.mocked(listDocuments).mockReset().mockResolvedValue([]);
  vi.mocked(getCalculation).mockReset();
  vi.mocked(calculateTaxYear).mockReset();
  vi.mocked(getMe)
    .mockReset()
    .mockResolvedValue({ id: 'u1', email: 'owner@example.com' });
});

describe('WorksheetPanel', () => {
  it('shows the empty state with the taxpayer form when no calculation exists', async () => {
    vi.mocked(getCalculation).mockResolvedValue(null);
    await renderApp('/tax-years/ty-2024');

    expect(
      await screen.findByText(
        'עדיין לא בוצע חישוב לשנת מס זו. מלאו את פרטי הנישום ולחצו על "חישוב".',
      ),
    ).toBeTruthy();
    expect(screen.getByLabelText('מין')).toBeTruthy();
    expect(screen.getByLabelText('נקודות זיכוי נוספות')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'חישוב' })).toBeTruthy();
    expect(vi.mocked(getCalculation)).toHaveBeenCalledWith('ty-2024');
  });

  it('POSTs the exact calculate body shape and shows the excluded-donations note', async () => {
    const calculated = makeCalculation();
    vi.mocked(getCalculation)
      .mockResolvedValueOnce(null)
      .mockResolvedValue(calculated);
    const response: CalculateResponse = {
      id: calculated.id,
      taxYearId: calculated.taxYearId,
      engineVersion: calculated.engineVersion,
      input: calculated.input,
      result: calculated.result,
      createdAt: calculated.createdAt,
      metadata: { excludedDonations: 2 },
    };
    vi.mocked(calculateTaxYear).mockResolvedValue(response);

    const user = userEvent.setup();
    await renderApp('/tax-years/ty-2024');

    await user.selectOptions(await screen.findByLabelText('מין'), 'female');
    await user.type(screen.getByLabelText('נקודות זיכוי נוספות'), '2.25');
    await user.click(screen.getByRole('button', { name: 'חישוב' }));

    await waitFor(
      () =>
        expect(calculateTaxYear).toHaveBeenCalledWith('ty-2024', {
          taxpayer: { gender: 'female', additionalCreditPoints: 2.25 },
        }),
      { timeout: 10_000 },
    );
    expect(
      await screen.findByText(
        'תרומות שלא נכללו בחישוב בהיעדר אישור לפי סעיף 46: 2',
        undefined,
        { timeout: 10_000 },
      ),
    ).toBeTruthy();
  });

  it('POSTs 15% non-linked interest (078/043) as integer agorot and renders its audit line', async () => {
    const calculated = makeCalculation({}, {
      nonLinkedInterest: {
        reason: 'nonLinkedInterest',
        amountAgorot: a(1_234_500),
        rateBp: 1500,
        taxAgorot: a(185_175),
        withheldAgorot: a(50_000),
      },
    });
    vi.mocked(getCalculation)
      .mockResolvedValueOnce(null)
      .mockResolvedValue(calculated);
    const response: CalculateResponse = {
      id: calculated.id,
      taxYearId: calculated.taxYearId,
      engineVersion: calculated.engineVersion,
      input: calculated.input,
      result: calculated.result,
      createdAt: calculated.createdAt,
      metadata: { excludedDonations: 0 },
    };
    vi.mocked(calculateTaxYear).mockResolvedValue(response);

    const user = userEvent.setup();
    await renderApp('/tax-years/ty-2024');

    // ₪12,345.00 income, ₪500.00 withheld → integer agorot.
    await user.type(
      await screen.findByLabelText('הכנסת ריבית על נכס שאינו צמוד מדד (15%) (₪)'),
      '12345',
    );
    await user.type(
      screen.getByLabelText('ניכוי במקור על הריבית (₪)'),
      '500',
    );
    await user.click(screen.getByRole('button', { name: 'חישוב' }));

    await waitFor(
      () =>
        expect(calculateTaxYear).toHaveBeenCalledWith('ty-2024', {
          taxpayer: { gender: 'male', additionalCreditPoints: 0 },
          nonLinkedInterestAgorot: 1_234_500,
          nonLinkedInterestWithheldAgorot: 50_000,
        }),
      { timeout: 10_000 },
    );

    // The worksheet audit section for the interest renders after calculation.
    expect(
      await screen.findByText(
        (c) => normalize(c).includes('הכנסת ריבית (שדה 078)'),
        undefined,
        { timeout: 10_000 },
      ),
    ).toBeTruthy();
  });

  it('rejects a negative non-linked interest amount without POSTing', async () => {
    vi.mocked(getCalculation).mockResolvedValue(null);
    const user = userEvent.setup();
    await renderApp('/tax-years/ty-2024');

    await user.type(
      await screen.findByLabelText('הכנסת ריבית על נכס שאינו צמוד מדד (15%) (₪)'),
      '-5',
    );
    await user.click(screen.getByRole('button', { name: 'חישוב' }));

    expect(
      await screen.findByText(
        'הכנסת הריבית והניכוי במקור חייבים להיות סכומים לא שליליים בשקלים',
      ),
    ).toBeTruthy();
    expect(calculateTaxYear).not.toHaveBeenCalled();
  });

  it('rejects additional credit points that are not a multiple of 0.25 without POSTing', async () => {
    vi.mocked(getCalculation).mockResolvedValue(null);
    const user = userEvent.setup();
    await renderApp('/tax-years/ty-2024');

    await user.type(await screen.findByLabelText('נקודות זיכוי נוספות'), '0.3');
    await user.click(screen.getByRole('button', { name: 'חישוב' }));

    expect(
      await screen.findByText(
        'נקודות הזיכוי הנוספות חייבות להיות מספר לא שלילי בכפולות של 0.25',
      ),
    ).toBeTruthy();
    expect(calculateTaxYear).not.toHaveBeenCalled();
  });

  it('renders the full worksheet: brackets, credit points, sections, audit stamp', async () => {
    vi.mocked(getCalculation).mockResolvedValue(makeCalculation());
    await renderApp('/tax-years/ty-2024');

    // Bracket rows: rates, open-ended top bracket, per-bracket tax via formatILS.
    expect(await screen.findByText('10%')).toBeTruthy();
    expect(screen.getByText('14%')).toBeTruthy();
    expect(screen.getByText('ומעלה')).toBeTruthy();
    expect(findMoneyText(841_200).length).toBeGreaterThan(0);
    expect(findMoneyText(2_182_320).length).toBeGreaterThan(0);
    expect(findMoneyText(3_023_520).length).toBeGreaterThan(0);

    // Credit points breakdown + section headings.
    expect(screen.getByText('תושב/ת ישראל')).toBeTruthy();
    expect(screen.getAllByText('2.25').length).toBeGreaterThan(0);
    expect(screen.getByText('זיכוי בגין קופת גמל (סעיף 45א)')).toBeTruthy();
    expect(screen.getByText('זיכוי בגין תרומות (סעיף 46)')).toBeTruthy();
    expect(screen.getByText('רווח הון וניירות ערך (טופס 867)')).toBeTruthy();
    expect(screen.getByText('מס יסף')).toBeTruthy();
    expect(screen.getByText('סיכום')).toBeTruthy();

    // Charity ceiling, capital offsets, totals amounts render via formatILS.
    expect(findMoneyText(7_200_000).length).toBeGreaterThan(0);
    expect(findMoneyText(200_000).length).toBeGreaterThan(0);
    expect(findMoneyText(2_173_576).length).toBeGreaterThan(0);

    // Audit stamp carries the engine version.
    expect(
      screen.getByText((content) => content.includes('il-2024.1')),
    ).toBeTruthy();
  });

  it('styles a positive refund green with the החזר label', async () => {
    vi.mocked(getCalculation).mockResolvedValue(makeCalculation());
    await renderApp('/tax-years/ty-2024');
    await screen.findByText('10%');

    const element = headline();
    expect(normalize(element.textContent ?? '')).toBe(`החזר מס: ${ils(123_456)}`);
    expect(element.className).toContain('green');
    expect(element.className).not.toContain('red');
  });

  it('styles a negative refund red as balance owed, with the absolute amount', async () => {
    vi.mocked(getCalculation).mockResolvedValue(
      makeCalculation({}, { refundAgorot: a(-54_321) }),
    );
    await renderApp('/tax-years/ty-2024');
    await screen.findByText('10%');

    const element = headline();
    expect(normalize(element.textContent ?? '')).toBe(
      `יתרה לתשלום: ${ils(54_321)}`,
    );
    expect(element.className).toContain('red');
    expect(element.className).not.toContain('green');
  });

  it('shows the amber stale notice with a recalculate nudge', async () => {
    vi.mocked(getCalculation).mockResolvedValue(
      makeCalculation({ stale: true }),
    );
    await renderApp('/tax-years/ty-2024');

    const notice = await screen.findByText(
      'הנתונים המאושרים עודכנו לאחר החישוב האחרון — יש לבצע חישוב מחדש.',
    );
    expect(notice.className).toContain('amber');
  });

  it('hides the stale notice when the calculation is current', async () => {
    vi.mocked(getCalculation).mockResolvedValue(makeCalculation());
    await renderApp('/tax-years/ty-2024');
    await screen.findByText('10%');

    expect(
      screen.queryByText(
        'הנתונים המאושרים עודכנו לאחר החישוב האחרון — יש לבצע חישוב מחדש.',
      ),
    ).toBeNull();
  });

  it('notes the carry-forward limitations when losses flow in and out', async () => {
    const calculation = makeCalculation(
      {},
      { lossCarryforwardOutAgorot: a(300_000) },
    );
    calculation.result.capitalGains = {
      ...calculation.result.capitalGains,
      lossCarryforwardInAgorot: a(150_000),
      lossCarryforwardOutAgorot: a(300_000),
    };
    vi.mocked(getCalculation).mockResolvedValue(calculation);
    await renderApp('/tax-years/ty-2024');
    await screen.findByText('10%');

    // Carry-forward IN: the documented phase-1 limitation.
    expect(
      screen.getByText((content) =>
        normalize(content).includes(
          'חישוב מחדש של שנה מוקדמת אינו מעדכן שנה זו אוטומטית',
        ),
      ),
    ).toBeTruthy();
    // Carry-forward OUT: carried to later years.
    expect(
      screen.getByText((content) =>
        normalize(content).includes('מועבר לקיזוז בשנים הבאות'),
      ),
    ).toBeTruthy();
  });

  it('renders one line per breakdown row, preferring the engine Hebrew label', async () => {
    vi.mocked(getCalculation).mockResolvedValue(
      makeCalculation(
        {},
        {
          creditPoints: {
            points: 10.25,
            breakdown: [
              { reason: 'resident', points: 2.25 },
              { reason: 'child', points: 1.5, label: 'ילד — גיל 1 בשנת המס (סעיף 40)' },
              { reason: 'child', points: 2.5, label: 'ילד — גיל 4 בשנת המס (סעיף 40)' },
              { reason: 'oleh', points: 3, label: 'עולה — 18 החודשים הראשונים (סעיף 35)' },
              { reason: 'degree', points: 1, label: 'תואר ראשון — שנה ראשונה (סעיף 40ג)' },
            ],
            valueAgorot: a(2_976_600),
          },
        },
      ),
    );
    await renderApp('/tax-years/ty-2024');
    await screen.findByText('10%');

    // Every row renders exactly once (getByText throws on 0 or 2 matches):
    // two child rows must not collapse into one via a duplicate React key.
    expect(screen.getByText('תושב/ת ישראל')).toBeTruthy();
    expect(screen.getByText('ילד — גיל 1 בשנת המס (סעיף 40)')).toBeTruthy();
    expect(screen.getByText('ילד — גיל 4 בשנת המס (סעיף 40)')).toBeTruthy();
    expect(screen.getByText('עולה — 18 החודשים הראשונים (סעיף 35)')).toBeTruthy();
    expect(screen.getByText('תואר ראשון — שנה ראשונה (סעיף 40ג)')).toBeTruthy();
    expect(screen.getByText('1.5')).toBeTruthy();
    expect(screen.getByText('2.5')).toBeTruthy();
  });

  it('falls back to official reason terminology when a breakdown row has no label', async () => {
    vi.mocked(getCalculation).mockResolvedValue(
      makeCalculation(
        {},
        {
          creditPoints: {
            points: 8,
            breakdown: [
              { reason: 'child', points: 1.5 },
              { reason: 'child', points: 2.5 },
              { reason: 'oleh', points: 3 },
              { reason: 'degree', points: 1 },
            ],
            valueAgorot: a(2_323_200),
          },
        },
      ),
    );
    await renderApp('/tax-years/ty-2024');
    await screen.findByText('10%');

    // Two label-less child rows → two identical fallback lines, both kept.
    expect(screen.getAllByText('נקודות זיכוי בגין ילד (סעיף 40)')).toHaveLength(2);
    expect(screen.getByText('עולה חדש (סעיף 35)')).toBeTruthy();
    expect(
      screen.getByText('תואר אקדמי / תעודת מקצוע (סעיפים 40ג-40ה)'),
    ).toBeTruthy();
  });

  it('never renders a raw i18n key for an unknown future breakdown reason', async () => {
    type Reason = TaxReturnResult['creditPoints']['breakdown'][number]['reason'];
    vi.mocked(getCalculation).mockResolvedValue(
      makeCalculation(
        {},
        {
          creditPoints: {
            points: 1,
            breakdown: [{ reason: 'disability' as Reason, points: 1 }],
            valueAgorot: a(290_400),
          },
        },
      ),
    );
    await renderApp('/tax-years/ty-2024');
    await screen.findByText('10%');

    expect(screen.queryByText(/worksheet\.creditReason/)).toBeNull();
    // Sensible fallback: the raw reason token, never the i18n key path.
    expect(screen.getByText('disability')).toBeTruthy();
  });

  it('shows the server Hebrew message when calculate fails with an ApiError', async () => {
    vi.mocked(getCalculation).mockResolvedValue(null);
    const serverMessage =
      'נקודות זיכוי בגין ילד בגיל 7 אינן נתמכות עדיין — יש להזין ידנית בשדה הנקודות הנוספות';
    vi.mocked(calculateTaxYear).mockRejectedValue(new ApiError(400, serverMessage));

    const user = userEvent.setup();
    await renderApp('/tax-years/ty-2024');
    await user.click(await screen.findByRole('button', { name: 'חישוב' }));

    const alert = await screen.findByText(serverMessage);
    expect(alert.getAttribute('role')).toBe('alert');
    expect(screen.queryByText('החישוב נכשל')).toBeNull();
  });

  it('clears a stale server error when a later submit fails client-side validation', async () => {
    vi.mocked(getCalculation).mockResolvedValue(null);
    const serverMessage =
      'נקודות זיכוי בגין ילד בגיל 7 אינן נתמכות עדיין — יש להזין ידנית בשדה הנקודות הנוספות';
    vi.mocked(calculateTaxYear).mockRejectedValue(new ApiError(400, serverMessage));

    const user = userEvent.setup();
    await renderApp('/tax-years/ty-2024');
    await user.click(await screen.findByRole('button', { name: 'חישוב' }));
    await screen.findByText(serverMessage);

    // A Zod-shape failure returns before mutate(); the old engine error must
    // not linger next to the new client-side message.
    await user.type(screen.getByLabelText('נקודות זיכוי נוספות'), '0.3');
    await user.click(screen.getByRole('button', { name: 'חישוב' }));

    expect(
      await screen.findByText(
        'נקודות הזיכוי הנוספות חייבות להיות מספר לא שלילי בכפולות של 0.25',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(serverMessage)).toBeNull();
  });

  it('falls back to the generic error when an ApiError carries no usable message', async () => {
    vi.mocked(getCalculation).mockResolvedValue(null);
    vi.mocked(calculateTaxYear).mockRejectedValue(new ApiError(502, ''));

    const user = userEvent.setup();
    await renderApp('/tax-years/ty-2024');
    await user.click(await screen.findByRole('button', { name: 'חישוב' }));

    expect(await screen.findByText('החישוב נכשל')).toBeTruthy();
  });

  it('falls back to the generic error for non-ApiError failures, hiding raw error text', async () => {
    vi.mocked(getCalculation).mockResolvedValue(null);
    vi.mocked(calculateTaxYear).mockRejectedValue(new Error('fetch failed'));

    const user = userEvent.setup();
    await renderApp('/tax-years/ty-2024');
    await user.click(await screen.findByRole('button', { name: 'חישוב' }));

    expect(await screen.findByText('החישוב נכשל')).toBeTruthy();
    expect(screen.queryByText('fetch failed')).toBeNull();
  });

  it('adds and removes child rows and POSTs the remaining structured children', async () => {
    vi.mocked(getCalculation).mockResolvedValue(null);
    vi.mocked(calculateTaxYear).mockResolvedValue(makeResponse());

    const user = userEvent.setup();
    await renderApp('/tax-years/ty-2024');

    // The 6-17 help note is visible under the children section.
    expect(
      await screen.findByText((c) => normalize(c).includes('ילדים בגילאי 6-17 אינם נתמכים עדיין')),
    ).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'הוספת ילד' }));
    await user.click(screen.getByRole('button', { name: 'הוספת ילד' }));
    await user.click(screen.getByRole('button', { name: 'הוספת ילד' }));

    const ages = screen.getAllByLabelText('גיל בשנת המס');
    expect(ages).toHaveLength(3);
    await user.selectOptions(ages[0]!, '2');
    await user.selectOptions(ages[1]!, '4');
    await user.selectOptions(ages[2]!, '18');
    const roles = screen.getAllByLabelText('תפקיד ההורה');
    await user.selectOptions(roles[1]!, 'other');

    // Removing the last row leaves the first two intact.
    await user.click(screen.getAllByRole('button', { name: 'הסרת ילד' })[2]!);
    expect(screen.getAllByLabelText('גיל בשנת המס')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'חישוב' }));
    await waitFor(
      () =>
        expect(calculateTaxYear).toHaveBeenCalledWith('ty-2024', {
          taxpayer: {
            gender: 'male',
            additionalCreditPoints: 0,
            children: [
              { ageInTaxYear: 2, role: 'custodial' },
              { ageInTaxYear: 4, role: 'other' },
            ],
          },
        }),
      { timeout: 10_000 },
    );
  });

  it('toggles the aliyah section and POSTs the structured aliyah record', async () => {
    vi.mocked(getCalculation).mockResolvedValue(null);
    vi.mocked(calculateTaxYear).mockResolvedValue(makeResponse());

    const user = userEvent.setup();
    await renderApp('/tax-years/ty-2024');

    // Off by default: no aliyah detail inputs.
    expect(await screen.findByLabelText('עלייה לישראל (סעיף 35)')).toBeTruthy();
    expect(screen.queryByLabelText('שנת העלייה')).toBeNull();

    await user.click(screen.getByLabelText('עלייה לישראל (סעיף 35)'));
    await user.type(screen.getByLabelText('שנת העלייה'), '2024');
    await user.selectOptions(screen.getByLabelText('חודש העלייה'), '7');
    await user.selectOptions(
      screen.getByLabelText('מסלול הזיכוי'),
      'from2022',
    );

    await user.click(screen.getByRole('button', { name: 'חישוב' }));
    await waitFor(
      () =>
        expect(calculateTaxYear).toHaveBeenCalledWith('ty-2024', {
          taxpayer: {
            gender: 'male',
            additionalCreditPoints: 0,
            aliyah: { aliyahYear: 2024, aliyahMonth: 7, scheduleVariant: 'from2022' },
          },
        }),
      { timeout: 10_000 },
    );
  });

  it('POSTs degrees with elected year and internship; elected year shows only for completions ≤ 2022', async () => {
    vi.mocked(getCalculation).mockResolvedValue(null);
    vi.mocked(calculateTaxYear).mockResolvedValue(makeResponse());

    const user = userEvent.setup();
    await renderApp('/tax-years/ty-2024');

    await user.click(await screen.findByRole('button', { name: 'הוספת תואר' }));

    // Blank completion year → the elected-year input is hidden.
    expect(screen.queryByLabelText('שנת הזיכוי שנבחרה')).toBeNull();
    // 2023+ cohort → still hidden (display convenience; the engine validates).
    await user.type(screen.getByLabelText('שנת סיום הלימודים'), '2023');
    expect(screen.queryByLabelText('שנת הזיכוי שנבחרה')).toBeNull();
    // ≤ 2022 cohort → visible.
    await user.clear(screen.getByLabelText('שנת סיום הלימודים'));
    await user.type(screen.getByLabelText('שנת סיום הלימודים'), '2020');
    expect(screen.getByLabelText('שנת הזיכוי שנבחרה')).toBeTruthy();

    await user.selectOptions(screen.getByLabelText('מסלול'), 'master');
    await user.type(screen.getByLabelText('שנות הלימוד'), '3');
    await user.type(screen.getByLabelText('שנת הזיכוי שנבחרה'), '2022');

    // The internship toggle reveals the start/end year inputs.
    expect(screen.queryByLabelText('שנת תחילת ההתמחות')).toBeNull();
    await user.click(screen.getByLabelText('התמחות (טופס 119)'));
    await user.type(screen.getByLabelText('שנת תחילת ההתמחות'), '2020');
    await user.type(screen.getByLabelText('שנת סיום ההתמחות'), '2021');

    await user.click(screen.getByRole('button', { name: 'חישוב' }));
    await waitFor(
      () =>
        expect(calculateTaxYear).toHaveBeenCalledWith('ty-2024', {
          taxpayer: {
            gender: 'male',
            additionalCreditPoints: 0,
            degrees: [
              {
                track: 'master',
                completionYear: 2020,
                studyYears: 3,
                electedClaimYear: 2022,
                internship: { startYear: 2020, endYear: 2021 },
              },
            ],
          },
        }),
      { timeout: 10_000 },
    );
  });

  it('omits children/aliyah/degrees keys entirely when sections are removed or off', async () => {
    vi.mocked(getCalculation).mockResolvedValue(null);
    vi.mocked(calculateTaxYear).mockResolvedValue(makeResponse());

    const user = userEvent.setup();
    await renderApp('/tax-years/ty-2024');

    // Touch every section, then undo: add+remove a child, toggle aliyah
    // on+off, add+remove a degree.
    await user.click(await screen.findByRole('button', { name: 'הוספת ילד' }));
    await user.click(screen.getByRole('button', { name: 'הסרת ילד' }));
    await user.click(screen.getByLabelText('עלייה לישראל (סעיף 35)'));
    await user.type(screen.getByLabelText('שנת העלייה'), '2024');
    await user.click(screen.getByLabelText('עלייה לישראל (סעיף 35)'));
    await user.click(screen.getByRole('button', { name: 'הוספת תואר' }));
    await user.click(screen.getByRole('button', { name: 'הסרת תואר' }));

    await user.click(screen.getByRole('button', { name: 'חישוב' }));
    await waitFor(() => expect(calculateTaxYear).toHaveBeenCalled(), {
      timeout: 10_000,
    });

    // `toHaveBeenCalledWith` ignores explicit-undefined keys, so assert key
    // ABSENCE directly — the engine distinguishes `undefined` from `[]`.
    const body = vi.mocked(calculateTaxYear).mock.calls[0]![1];
    expect('children' in body.taxpayer).toBe(false);
    expect('aliyah' in body.taxpayer).toBe(false);
    expect('degrees' in body.taxpayer).toBe(false);
  });

  it('shows a Hebrew aliyah message and does not POST when the aliyah year is blank', async () => {
    vi.mocked(getCalculation).mockResolvedValue(null);

    const user = userEvent.setup();
    await renderApp('/tax-years/ty-2024');

    await user.click(await screen.findByLabelText('עלייה לישראל (סעיף 35)'));
    await user.click(screen.getByRole('button', { name: 'חישוב' }));

    expect(
      await screen.findByText(
        'פרטי העלייה אינם תקינים — יש להזין שנת עלייה (מספר שלם), חודש ומסלול.',
      ),
    ).toBeTruthy();
    expect(calculateTaxYear).not.toHaveBeenCalled();
  });

  it('shows a Hebrew degrees message and does not POST when a degree row is incomplete', async () => {
    vi.mocked(getCalculation).mockResolvedValue(null);

    const user = userEvent.setup();
    await renderApp('/tax-years/ty-2024');

    await user.click(await screen.findByRole('button', { name: 'הוספת תואר' }));
    await user.click(screen.getByRole('button', { name: 'חישוב' }));

    expect(
      await screen.findByText(
        'פרטי התארים אינם תקינים — יש לבדוק שנת סיום, שנות לימוד, שנת זיכוי ושנות התמחות.',
      ),
    ).toBeTruthy();
    expect(calculateTaxYear).not.toHaveBeenCalled();
  });

  it('surfaces the engine Hebrew 400 for a child age the engine rejects (6-17 band)', async () => {
    vi.mocked(getCalculation).mockResolvedValue(null);
    const serverMessage =
      'נקודות זיכוי בגין ילד בגיל 7 אינן נתמכות עדיין — יש להזין ידנית בשדה הנקודות הנוספות';
    vi.mocked(calculateTaxYear).mockRejectedValue(new ApiError(400, serverMessage));

    const user = userEvent.setup();
    await renderApp('/tax-years/ty-2024');

    // Age 7 is inside the shared schema's 0-18 statutory domain, so the
    // request is submitted and the ENGINE rejects it — in Hebrew.
    await user.click(await screen.findByRole('button', { name: 'הוספת ילד' }));
    await user.selectOptions(screen.getByLabelText('גיל בשנת המס'), '7');
    await user.click(screen.getByRole('button', { name: 'חישוב' }));

    const alert = await screen.findByText(serverMessage);
    expect(alert.getAttribute('role')).toBe('alert');
    expect(calculateTaxYear).toHaveBeenCalledWith('ty-2024', {
      taxpayer: {
        gender: 'male',
        additionalCreditPoints: 0,
        children: [{ ageInTaxYear: 7, role: 'custodial' }],
      },
    });
  });

  it('renders the 15% non-linked-interest audit section only when there is such income', async () => {
    // Default fixture has zero non-linked interest → section hidden.
    vi.mocked(getCalculation).mockResolvedValue(makeCalculation());
    await renderApp('/tax-years/ty-2024');
    await screen.findByText('10%');
    expect(
      screen.queryByText((c) => normalize(c).includes('הכנסת ריבית (שדה 078)')),
    ).toBeNull();

    // Non-zero interest → section renders the income/tax/withholding lines.
    const calculation = makeCalculation();
    calculation.result.nonLinkedInterest = {
      reason: 'nonLinkedInterest',
      amountAgorot: a(1_000_000),
      rateBp: 1500,
      taxAgorot: a(150_000),
      withheldAgorot: a(100_000),
    };
    vi.mocked(getCalculation).mockResolvedValue(calculation);
    await renderApp('/tax-years/ty-2024');
    await screen.findByText('10%');
    expect(
      screen.getByText((c) => normalize(c).includes('הכנסת ריבית (שדה 078)')),
    ).toBeTruthy();
    expect(
      screen.getByText((c) => normalize(c).includes('ניכוי במקור (שדה 043)')),
    ).toBeTruthy();
  });
});
