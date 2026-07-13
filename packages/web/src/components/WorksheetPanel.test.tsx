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
  calculateTaxYear,
  getCalculation,
  getMe,
  listDocuments,
  listTaxYears,
} from '../api/client';
import { renderApp } from '../test/render';

vi.mock('../api/client');

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
