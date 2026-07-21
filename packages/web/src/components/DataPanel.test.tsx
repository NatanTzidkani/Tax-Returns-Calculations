import { screen } from '@testing-library/react';
import { agorot, formatILS } from '@taxreturns/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfirmedDataSummary } from '../api/client';
import {
  ApiError,
  getCalculation,
  getConfirmedData,
  getMe,
  getTaxpayerProfile,
  listDocuments,
  listTaxYears,
} from '../api/client';
import { renderApp } from '../test/render';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    getMe: vi.fn(),
    listTaxYears: vi.fn(),
    listDocuments: vi.fn(),
    getCalculation: vi.fn(),
    getTaxpayerProfile: vi.fn(),
    getConfirmedData: vi.fn(),
  };
});

const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
const ils = (value: number) => normalize(formatILS(agorot(value)));

const a = agorot;

const emptySummary: ConfirmedDataSummary = {
  salaries: [],
  donations: [],
  excludedDonations: 0,
  capital: { entries: [], lossCarryforwardInAgorot: a(0) },
};

beforeEach(() => {
  vi.mocked(listTaxYears)
    .mockReset()
    .mockResolvedValue([{ id: 'ty-2024', year: 2024, status: 'in_review' }]);
  vi.mocked(listDocuments).mockReset().mockResolvedValue([]);
  vi.mocked(getCalculation).mockReset().mockResolvedValue(null);
  vi.mocked(getTaxpayerProfile).mockReset().mockResolvedValue(null);
  vi.mocked(getConfirmedData).mockReset();
  vi.mocked(getMe)
    .mockReset()
    .mockResolvedValue({ id: 'u1', email: 'owner@example.com' });
});

describe('DataPanel — confirmed values grouped (spec §6 screen 2)', () => {
  it('renders the three groups with formatted agorot and the carry-forward row', async () => {
    vi.mocked(getConfirmedData).mockResolvedValue({
      salaries: [
        {
          employerName: 'אקמי בע"מ',
          grossSalaryAgorot: a(12_000_000),
          taxWithheldAgorot: a(1_200_000),
          pensionEmployeeContributionAgorot: a(720_000),
        },
      ],
      donations: [{ institutionName: 'עמותה', amountAgorot: a(100_000) }],
      excludedDonations: 1,
      capital: {
        entries: [
          {
            brokerName: 'ברוקר',
            realGainAgorot: a(100_000),
            realLossAgorot: a(500_000),
            interestDividendAgorot: a(20_000),
            taxWithheldAgorot: a(25_000),
          },
        ],
        lossCarryforwardInAgorot: a(300_000),
      },
    });
    await renderApp('/tax-years/ty-2024');

    // שכר group: employer + the three Form-106 box rows.
    expect(await screen.findByText('אקמי בע"מ')).toBeTruthy();
    expect(
      screen.getByText((c) => normalize(c) === ils(12_000_000)),
    ).toBeTruthy();
    expect(
      screen.getByText((c) => normalize(c).includes('תיבה 158')),
    ).toBeTruthy();
    // תרומות group + the excluded-receipts note.
    expect(screen.getByText('עמותה')).toBeTruthy();
    expect(
      screen.getByText((c) => normalize(c).includes('ללא אישור לפי סעיף 46')),
    ).toBeTruthy();
    // שוק ההון group + carry-forward-in row.
    expect(screen.getByText('ברוקר')).toBeTruthy();
    expect(
      screen.getByText((c) => normalize(c).includes('הפסד הון מועבר משנים קודמות')),
    ).toBeTruthy();
    expect(vi.mocked(getConfirmedData)).toHaveBeenCalledWith('ty-2024');
  });

  it("renders the 867 appendix-ד' non-linked interest rows under שוק ההון", async () => {
    vi.mocked(getConfirmedData).mockResolvedValue({
      ...emptySummary,
      nonLinkedInterest: {
        amountAgorot: a(1_400_000),
        taxWithheldAgorot: a(210_000),
      },
    });
    await renderApp('/tax-years/ty-2024');

    expect(
      await screen.findByText((c) => normalize(c).includes('הכנסת ריבית (שדה 078)')),
    ).toBeTruthy();
    expect(
      screen.getByText((c) => normalize(c).includes('מס שנוכה במקור מריבית פקדונות (שדה 043)')),
    ).toBeTruthy();
    expect(screen.getByText((c) => normalize(c) === ils(1_400_000))).toBeTruthy();
    expect(screen.getByText((c) => normalize(c) === ils(210_000))).toBeTruthy();
  });

  it('an empty year keeps the placeholder sentence and hides all groups', async () => {
    vi.mocked(getConfirmedData).mockResolvedValue(emptySummary);
    await renderApp('/tax-years/ty-2024');

    expect(
      await screen.findByText('הנתונים המאושרים יוצגו כאן לאחר אישור המסמכים'),
    ).toBeTruthy();
    expect(screen.queryByText((c) => normalize(c).includes('תיבה 158'))).toBeNull();
  });

  it('hides the carry-forward row and excluded note when zero', async () => {
    vi.mocked(getConfirmedData).mockResolvedValue({
      ...emptySummary,
      salaries: [
        {
          employerName: 'אקמי בע"מ',
          grossSalaryAgorot: a(12_000_000),
          taxWithheldAgorot: a(1_200_000),
          pensionEmployeeContributionAgorot: a(0),
        },
      ],
    });
    await renderApp('/tax-years/ty-2024');

    await screen.findByText('אקמי בע"מ');
    expect(
      screen.queryByText((c) => normalize(c).includes('הפסד הון מועבר')),
    ).toBeNull();
    expect(
      screen.queryByText((c) => normalize(c).includes('ללא אישור לפי סעיף 46')),
    ).toBeNull();
  });

  it('a fetch error shows the standard load-error alert inside the panel', async () => {
    vi.mocked(getConfirmedData).mockRejectedValue(new ApiError(500, 'שגיאה'));
    await renderApp('/tax-years/ty-2024');

    const panel = (await screen.findByText('נתונים')).closest('section');
    expect(panel).toBeTruthy();
    const alerts = await screen.findAllByRole('alert');
    expect(alerts.some((el) => panel!.contains(el))).toBe(true);
  });
});
