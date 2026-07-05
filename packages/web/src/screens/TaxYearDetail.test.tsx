import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TaxDocument, TaxYear } from '../api/client';
import { listDocuments, listTaxYears, uploadDocument } from '../api/client';
import { renderApp } from '../test/render';

vi.mock('../api/client');

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

beforeEach(() => {
  vi.mocked(listTaxYears).mockReset().mockResolvedValue([taxYear]);
  vi.mocked(listDocuments).mockReset().mockResolvedValue(documents);
  vi.mocked(uploadDocument).mockReset();
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
});
