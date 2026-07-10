import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { agorot, formatILS } from '@taxreturns/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TaxYear } from '../api/client';
import { createTaxYear, listTaxYears } from '../api/client';
import { renderApp } from '../test/render';

vi.mock('../api/client');

const taxYears: TaxYear[] = [
  {
    id: 'ty-2023',
    year: 2023,
    status: 'filed',
    deadline: '2024-06-30T00:00:00.000Z',
    filedAt: '2024-05-01T00:00:00.000Z',
    refundEstimateAgorot: 123_456,
  },
  {
    id: 'ty-2024',
    year: 2024,
    status: 'draft',
    deadline: null,
    filedAt: null,
    refundEstimateAgorot: null,
  },
];

beforeEach(() => {
  vi.mocked(listTaxYears).mockReset();
  vi.mocked(createTaxYear).mockReset();
});

describe('Dashboard', () => {
  it('renders the dashboard heading in Hebrew', async () => {
    vi.mocked(listTaxYears).mockResolvedValue([]);
    await renderApp('/');
    expect(await screen.findByRole('heading', { name: 'שנות מס' })).toBeTruthy();
  });

  it('lists tax years with Hebrew status chips', async () => {
    vi.mocked(listTaxYears).mockResolvedValue(taxYears);
    await renderApp('/');

    expect(await screen.findByRole('link', { name: '2023' })).toBeTruthy();
    expect(screen.getByRole('link', { name: '2024' })).toBeTruthy();
    expect(screen.getByText('הוגש')).toBeTruthy();
    expect(screen.getByText('טיוטה')).toBeTruthy();
  });

  it('shows the refund estimate via formatILS, or a placeholder when absent', async () => {
    vi.mocked(listTaxYears).mockResolvedValue(taxYears);
    await renderApp('/');

    const rowWithRefund = (await screen.findByRole('link', { name: '2023' })).closest('tr');
    const rowWithoutRefund = screen.getByRole('link', { name: '2024' }).closest('tr');
    // formatILS output contains non-breaking spaces; Testing Library hands the
    // matcher whitespace-normalized text, so normalize both sides.
    const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
    const expected = normalize(formatILS(agorot(123_456)));
    expect(
      within(rowWithRefund!).getByText((content) => normalize(content) === expected),
    ).toBeTruthy();
    expect(within(rowWithoutRefund!).getAllByText('—').length).toBeGreaterThan(0);
  });

  it('shows the Hebrew empty state when there are no tax years', async () => {
    vi.mocked(listTaxYears).mockResolvedValue([]);
    await renderApp('/');

    expect(
      await screen.findByText('אין עדיין שנות מס. הוסיפו שנה כדי להתחיל.'),
    ).toBeTruthy();
  });

  it('adds a tax year and refreshes the list', async () => {
    const created: TaxYear = { id: 'ty-2025', year: 2025, status: 'draft' };
    vi.mocked(listTaxYears)
      .mockResolvedValueOnce([])
      .mockResolvedValue([created]);
    vi.mocked(createTaxYear).mockResolvedValue(created);

    const user = userEvent.setup();
    await renderApp('/');

    const input = await screen.findByLabelText('שנה');
    await user.type(input, '2025');
    await user.click(screen.getByRole('button', { name: 'הוספה' }));

    await waitFor(() => expect(createTaxYear).toHaveBeenCalledWith(2025), {
      timeout: 10_000,
    });
    expect(await screen.findByRole('link', { name: '2025' })).toBeTruthy();
    expect(screen.getByText('טיוטה')).toBeTruthy();
  });

  it('caps the year input at the current year and refuses to submit a future year', async () => {
    vi.mocked(listTaxYears).mockResolvedValue([]);
    const user = userEvent.setup();
    await renderApp('/');

    const currentYear = new Date().getFullYear();
    const input = (await screen.findByLabelText('שנה')) as HTMLInputElement;
    expect(input.max).toBe(String(currentYear));

    await user.type(input, String(currentYear + 1));
    await user.click(screen.getByRole('button', { name: 'הוספה' }));

    // Give any (incorrect) submission a chance to fire before asserting it didn't.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(createTaxYear).not.toHaveBeenCalled();
  });
});
