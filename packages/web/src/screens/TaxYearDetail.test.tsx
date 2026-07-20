import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { agorot } from '@taxreturns/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfirmedDataSummary, TaxDocument, TaxYear } from '../api/client';
import {
  ApiError,
  deleteDocument,
  deleteTaxYear,
  getCalculation,
  getConfirmedData,
  getMe,
  listDocuments,
  listTaxYears,
  uploadDocument,
} from '../api/client';
import { renderApp } from '../test/render';

// Partial mock: keep the real `ApiError` class (so `instanceof` + `.message`
// work) and stub only the network functions.
vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  return {
    ...actual,
    listTaxYears: vi.fn(),
    listDocuments: vi.fn(),
    uploadDocument: vi.fn(),
    getCalculation: vi.fn(),
    getConfirmedData: vi.fn(),
    deleteTaxYear: vi.fn(),
    deleteDocument: vi.fn(),
    getMe: vi.fn(),
  };
});

const taxYear: TaxYear = { id: 'ty-2024', year: 2024, status: 'in_review' };

const documents: TaxDocument[] = [
  {
    id: 'doc-1',
    taxYearId: 'ty-2024',
    kind: 'form106',
    originalFilename: 'tofes106.pdf',
    uploadedAt: '2026-03-01T10:00:00.000Z',
    extractionStatus: 'pending',
    extractionError: null,
  },
  {
    id: 'doc-2',
    taxYearId: 'ty-2024',
    kind: 'charity_receipt',
    originalFilename: 'receipt.jpg',
    uploadedAt: '2026-03-02T10:00:00.000Z',
    extractionStatus: 'confirmed',
    extractionError: null,
  },
];

const emptySummary: ConfirmedDataSummary = {
  salaries: [],
  donations: [],
  excludedDonations: 0,
  capital: { entries: [], lossCarryforwardInAgorot: agorot(0) },
};

beforeEach(() => {
  vi.mocked(listTaxYears).mockReset().mockResolvedValue([taxYear]);
  vi.mocked(listDocuments).mockReset().mockResolvedValue(documents);
  vi.mocked(uploadDocument).mockReset();
  vi.mocked(getCalculation).mockReset().mockResolvedValue(null);
  vi.mocked(getConfirmedData).mockReset().mockResolvedValue(emptySummary);
  vi.mocked(deleteTaxYear).mockReset().mockResolvedValue(undefined);
  vi.mocked(deleteDocument).mockReset().mockResolvedValue(undefined);
  vi.mocked(getMe)
    .mockReset()
    .mockResolvedValue({ id: 'u1', email: 'owner@example.com' });
});

describe('TaxYearDetail', () => {
  it('renders the year title and the three panels', async () => {
    await renderApp('/tax-years/ty-2024');

    expect(await screen.findByRole('heading', { name: 'שנת מס 2024' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'מסמכים' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'נתונים' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'חישוב' })).toBeTruthy();
  });

  it('lists documents with official form labels and extraction-status chips', async () => {
    await renderApp('/tax-years/ty-2024');

    const list = await screen.findByRole('list');
    expect(within(list).getByText('טופס 106')).toBeTruthy();
    expect(within(list).getByText('קבלת תרומה (סעיף 46)')).toBeTruthy();
    expect(within(list).getByText('ממתין לחילוץ')).toBeTruthy();
    expect(within(list).getByText('אושר')).toBeTruthy();
    expect(vi.mocked(listDocuments)).toHaveBeenCalledWith('ty-2024');
  });

  it('links each document row to the review screen', async () => {
    await renderApp('/tax-years/ty-2024');

    const list = await screen.findByRole('list');
    const reviewLinks = within(list).getAllByRole('link', { name: 'בדיקה ואישור' });
    expect(reviewLinks).toHaveLength(2);
    expect(reviewLinks[0]!.getAttribute('href')).toBe(
      '/tax-years/ty-2024/documents/doc-1',
    );
    expect(reviewLinks[1]!.getAttribute('href')).toBe(
      '/tax-years/ty-2024/documents/doc-2',
    );
  });

  it('uploads a document with the selected kind', async () => {
    const uploaded: TaxDocument = {
      id: 'doc-3',
      taxYearId: 'ty-2024',
      kind: 'form867',
      originalFilename: 'broker.pdf',
      uploadedAt: '2026-03-03T10:00:00.000Z',
      extractionStatus: 'pending',
      extractionError: null,
    };
    vi.mocked(uploadDocument).mockResolvedValue(uploaded);

    const user = userEvent.setup();
    await renderApp('/tax-years/ty-2024');

    const file = new File(['pdf-bytes'], 'broker.pdf', { type: 'application/pdf' });
    await user.upload(await screen.findByLabelText('קובץ'), file);
    await user.selectOptions(screen.getByLabelText('סוג מסמך'), 'form867');
    await user.click(screen.getByRole('button', { name: 'העלאה' }));

    await waitFor(
      () => expect(uploadDocument).toHaveBeenCalledWith('ty-2024', file, 'form867'),
      { timeout: 10_000 },
    );
  });

  it('links to the Form 1301 filing view from the header', async () => {
    await renderApp('/tax-years/ty-2024');

    const filingLink = await screen.findByRole('link', { name: 'טופס 1301 והגשה' });
    expect(filingLink.getAttribute('href')).toBe('/tax-years/ty-2024/filing');
  });

  it('deletes the tax year through the confirmation dialog and returns to the dashboard', async () => {
    const user = userEvent.setup();
    await renderApp('/tax-years/ty-2024');

    await user.click(await screen.findByRole('button', { name: 'מחיקת שנת מס' }));

    // The confirmation dialog (alertdialog role) appears with the Hebrew body.
    const dialog = await screen.findByRole('alertdialog');
    expect(
      within(dialog).getByText(
        'האם אתה בטוח שברצונך למחוק את שנת המס 2024? כל המסמכים והחישובים יימחקו לצמיתות. פעולה זו בלתי הפיכה.',
      ),
    ).toBeTruthy();
    // Not called until the user confirms.
    expect(deleteTaxYear).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'מחיקה' }));

    await waitFor(() => expect(deleteTaxYear).toHaveBeenCalledWith('ty-2024'), {
      timeout: 10_000,
    });
    // On success the detail screen navigates back to the dashboard.
    expect(await screen.findByRole('heading', { name: 'שנות מס' })).toBeTruthy();
  });

  it('does not delete the tax year when the dialog is cancelled', async () => {
    const user = userEvent.setup();
    await renderApp('/tax-years/ty-2024');

    await user.click(await screen.findByRole('button', { name: 'מחיקת שנת מס' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'ביטול' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(deleteTaxYear).not.toHaveBeenCalled();
    // Still on the detail screen.
    expect(screen.getByRole('heading', { name: 'שנת מס 2024' })).toBeTruthy();
  });

  it('surfaces the backend Hebrew error and stays on the screen when the delete fails', async () => {
    vi.mocked(deleteTaxYear).mockRejectedValue(new ApiError(404, 'שנת המס לא נמצאה'));
    const user = userEvent.setup();
    const { router } = await renderApp('/tax-years/ty-2024');

    await user.click(await screen.findByRole('button', { name: 'מחיקת שנת מס' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'מחיקה' }));

    // The ApiError message is shown verbatim inside the still-open dialog.
    expect(await within(dialog).findByRole('alert')).toHaveProperty(
      'textContent',
      'שנת המס לא נמצאה',
    );
    // No navigation away from the detail screen on failure. (The heading is
    // aria-hidden behind the open modal, so assert via the router instead.)
    expect(router.state.location.pathname).toBe('/tax-years/ty-2024');
  });

  it('shows a per-row delete button labelled with the document filename', async () => {
    await renderApp('/tax-years/ty-2024');

    const list = await screen.findByRole('list');
    expect(
      within(list).getByRole('button', { name: 'מחיקת המסמך tofes106.pdf' }),
    ).toBeTruthy();
    expect(
      within(list).getByRole('button', { name: 'מחיקת המסמך receipt.jpg' }),
    ).toBeTruthy();
  });

  it('deletes a document through the confirmation dialog and refetches the documents and data panels', async () => {
    const user = userEvent.setup();
    await renderApp('/tax-years/ty-2024');

    const list = await screen.findByRole('list');
    const documentsFetches = vi.mocked(listDocuments).mock.calls.length;
    const confirmedDataFetches = vi.mocked(getConfirmedData).mock.calls.length;
    const calculationFetches = vi.mocked(getCalculation).mock.calls.length;

    await user.click(
      within(list).getByRole('button', { name: 'מחיקת המסמך tofes106.pdf' }),
    );

    const dialog = await screen.findByRole('alertdialog');
    expect(
      within(dialog).getByText(
        'האם אתה בטוח שברצונך למחוק את המסמך tofes106.pdf? הנתונים שחולצו ואושרו ממנו יימחקו לצמיתות. פעולה זו בלתי הפיכה.',
      ),
    ).toBeTruthy();
    // Not called until the user confirms.
    expect(deleteDocument).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'מחיקה' }));

    await waitFor(() => expect(deleteDocument).toHaveBeenCalledWith('doc-1'), {
      timeout: 10_000,
    });
    // The dialog closes and the affected queries refetch: documents list,
    // confirmed-data panel, and the calculation (its stale flag may have
    // flipped server-side).
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    await waitFor(() => {
      expect(vi.mocked(listDocuments).mock.calls.length).toBeGreaterThan(
        documentsFetches,
      );
      expect(vi.mocked(getConfirmedData).mock.calls.length).toBeGreaterThan(
        confirmedDataFetches,
      );
      expect(vi.mocked(getCalculation).mock.calls.length).toBeGreaterThan(
        calculationFetches,
      );
    });
  });

  it('does not delete the document when the dialog is cancelled', async () => {
    const user = userEvent.setup();
    await renderApp('/tax-years/ty-2024');

    const list = await screen.findByRole('list');
    await user.click(
      within(list).getByRole('button', { name: 'מחיקת המסמך tofes106.pdf' }),
    );
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'ביטול' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(deleteDocument).not.toHaveBeenCalled();
  });

  it('shows the server Hebrew error verbatim inside the open dialog when the document delete fails', async () => {
    // The API's 409 for a filed year — the message must render verbatim.
    vi.mocked(deleteDocument).mockRejectedValue(
      new ApiError(
        409,
        'לא ניתן למחוק מסמך משנת מס שהוגשה — מסמכי המקור של דוח שהוגש חייבים להישמר',
      ),
    );
    const user = userEvent.setup();
    await renderApp('/tax-years/ty-2024');

    const list = await screen.findByRole('list');
    await user.click(
      within(list).getByRole('button', { name: 'מחיקת המסמך tofes106.pdf' }),
    );
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'מחיקה' }));

    expect(await within(dialog).findByRole('alert')).toHaveProperty(
      'textContent',
      'לא ניתן למחוק מסמך משנת מס שהוגשה — מסמכי המקור של דוח שהוגש חייבים להישמר',
    );
  });
});
