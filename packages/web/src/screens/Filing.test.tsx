import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { agorot, formatILS } from '@taxreturns/shared';
import type { TaxReturnResult } from '@taxreturns/tax-engine';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CalculationSnapshot, TaxYear } from '../api/client';
import {
  ApiError,
  getCalculation,
  getMe,
  listTaxYears,
  updateTaxYearStatus,
} from '../api/client';
import { renderApp } from '../test/render';

// Keep ApiError (and anything else not stubbed) real: the screen relies on
// `instanceof ApiError` to decide whether to show the server's message.
vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    getMe: vi.fn(),
    listTaxYears: vi.fn(),
    getCalculation: vi.fn(),
    updateTaxYearStatus: vi.fn(),
  };
});

/** formatILS output contains non-breaking spaces; normalize both sides. */
const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();

function findMoney(container: HTMLElement, agorotValue: number) {
  const expected = normalize(formatILS(agorot(agorotValue)));
  return within(container).getByText((content) => normalize(content) === expected);
}

const draftYear: TaxYear = { id: 'ty-2024', year: 2024, status: 'draft' };

const snapshot: CalculationSnapshot = {
  id: 'calc-1',
  taxYearId: 'ty-2024',
  engineVersion: 'il-1.0.0',
  input: {} as CalculationSnapshot['input'],
  result: {
    form1301Fields: {
      '158': 12_000_000,
      '042': 1_500_000,
      '045': 700_000,
      donationsEligible: 100_000,
      capitalTaxableGain: 0,
      capitalTax: 0,
      surtax: 0,
      totalLiability: 1_400_000,
      refund: 100_000,
    },
  } as unknown as TaxReturnResult,
  createdAt: '2026-07-10T10:00:00.000Z',
  stale: false,
};

beforeEach(() => {
  vi.mocked(getMe)
    .mockReset()
    .mockResolvedValue({ id: 'u1', email: 'owner@example.com' });
  vi.mocked(listTaxYears).mockReset().mockResolvedValue([draftYear]);
  vi.mocked(getCalculation).mockReset().mockResolvedValue(snapshot);
  vi.mocked(updateTaxYearStatus).mockReset();
});

describe('Filing', () => {
  it('renders the 1301 transcription table: code, Hebrew label, formatILS value', async () => {
    await renderApp('/tax-years/ty-2024/filing');

    const table = await screen.findByRole('table');
    const salaryRow = within(table).getByText('158').closest('tr')!;
    expect(within(salaryRow).getByText('שכר/הכנסה ברוטו')).toBeTruthy();
    expect(findMoney(salaryRow, 12_000_000)).toBeTruthy();

    const withheldRow = within(table).getByText('042').closest('tr')!;
    expect(
      within(withheldRow).getByText('מס הכנסה שנוכה במקור ממשכורת ומשכר עבודה'),
    ).toBeTruthy();
    expect(findMoney(withheldRow, 1_500_000)).toBeTruthy();

    const refundRow = within(table).getByText('refund').closest('tr')!;
    expect(within(refundRow).getByText('החזר מס (שלילי = יתרה לתשלום)')).toBeTruthy();
    expect(findMoney(refundRow, 100_000)).toBeTruthy();

    // Audit stamp shows the engine version.
    expect(screen.getByText(/il-1\.0\.0/)).toBeTruthy();
  });

  it('renders engine keys it does not know generically: raw key as the label', async () => {
    vi.mocked(getCalculation).mockResolvedValue({
      ...snapshot,
      result: {
        form1301Fields: {
          '037': 100_000,
          brandNewEngineField: 4_200,
        },
      } as unknown as TaxReturnResult,
    });
    await renderApp('/tax-years/ty-2024/filing');

    const table = await screen.findByRole('table');
    // Known numeric code gets its official Hebrew label…
    const donationsRow = within(table).getByText('037').closest('tr')!;
    expect(
      within(donationsRow).getByText('תרומות למוסדות ציבור בישראל (סעיף 46)'),
    ).toBeTruthy();
    // …and an unknown key still renders (raw key as label) with its value.
    const unknownRow = within(table)
      .getAllByText('brandNewEngineField')[0]!
      .closest('tr')!;
    expect(findMoney(unknownRow, 4_200)).toBeTruthy();
  });

  it('shows the owner-verification warning (לא להגיש בלי בדיקה)', async () => {
    await renderApp('/tax-years/ty-2024/filing');

    expect(await screen.findByText(/לא להגיש בלי בדיקה/)).toBeTruthy();
  });

  it('shows an amber stale warning only when the calculation is stale', async () => {
    vi.mocked(getCalculation).mockResolvedValue({ ...snapshot, stale: true });
    const { unmount } = await renderApp('/tax-years/ty-2024/filing');

    expect(
      await screen.findByText(/נתונים אושרו לאחר החישוב האחרון/),
    ).toBeTruthy();
    unmount();

    vi.mocked(getCalculation).mockResolvedValue(snapshot);
    await renderApp('/tax-years/ty-2024/filing');
    await screen.findByRole('table');
    expect(screen.queryByText(/נתונים אושרו לאחר החישוב האחרון/)).toBeNull();
  });

  it('shows the empty state with a link back to the year when there is no calculation', async () => {
    vi.mocked(getCalculation).mockResolvedValue(null);
    await renderApp('/tax-years/ty-2024/filing');

    expect(
      await screen.findByText(/עדיין לא בוצע חישוב לשנת מס זו/),
    ).toBeTruthy();
    const backLink = screen.getByRole('link', { name: 'למסך שנת המס' });
    expect(backLink.getAttribute('href')).toBe('/tax-years/ty-2024');
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('offers ONLY the legal next transitions — draft must not offer "filed"', async () => {
    await renderApp('/tax-years/ty-2024/filing');

    expect(
      await screen.findByRole('button', { name: 'העברה לבדיקה' }),
    ).toBeTruthy();
    // Illegal from draft: filed, ready_to_file, amended, draft itself.
    expect(screen.queryByRole('button', { name: 'סימון כהוגש' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'סימון כמוכן להגשה' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'פתיחת דוח מתקן' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'החזרה לטיוטה' })).toBeNull();
  });

  it('offers both legal transitions from ready_to_file', async () => {
    vi.mocked(listTaxYears).mockResolvedValue([
      { ...draftYear, status: 'ready_to_file' },
    ]);
    await renderApp('/tax-years/ty-2024/filing');

    expect(await screen.findByRole('button', { name: 'סימון כהוגש' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'העברה לבדיקה' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'החזרה לטיוטה' })).toBeNull();
  });

  it('sends the transition via PATCH body { status } and refreshes the queries', async () => {
    vi.mocked(updateTaxYearStatus).mockResolvedValue({
      ...draftYear,
      status: 'in_review',
    });
    const user = userEvent.setup();
    await renderApp('/tax-years/ty-2024/filing');

    await user.click(await screen.findByRole('button', { name: 'העברה לבדיקה' }));

    await waitFor(
      () => expect(updateTaxYearStatus).toHaveBeenCalledWith('ty-2024', 'in_review'),
      { timeout: 10_000 },
    );
    // The list query is refetched after the transition.
    await waitFor(() =>
      expect(vi.mocked(listTaxYears).mock.calls.length).toBeGreaterThan(1),
    );
  });

  it('renders filedAt when the year has been filed', async () => {
    vi.mocked(listTaxYears).mockResolvedValue([
      { ...draftYear, status: 'filed', filedAt: '2026-07-11T09:30:00.000Z' },
    ]);
    await renderApp('/tax-years/ty-2024/filing');

    const expectedDate = new Intl.DateTimeFormat('he-IL', {
      dateStyle: 'medium',
    }).format(new Date('2026-07-11T09:30:00.000Z'));
    expect(await screen.findByText(`הוגש בתאריך ${expectedDate}`)).toBeTruthy();
    // From filed only "amended" is offered.
    expect(screen.getByRole('button', { name: 'פתיחת דוח מתקן' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'העברה לבדיקה' })).toBeNull();
  });

  it('shows the server Hebrew message when a transition is rejected with 400', async () => {
    const serverMessage =
      'לא ניתן לעבור מסטטוס "טיוטה" (draft) לסטטוס "הוגש" (filed)';
    vi.mocked(updateTaxYearStatus).mockRejectedValue(new ApiError(400, serverMessage));
    const user = userEvent.setup();
    await renderApp('/tax-years/ty-2024/filing');

    await user.click(await screen.findByRole('button', { name: 'העברה לבדיקה' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(serverMessage);
  });
});
