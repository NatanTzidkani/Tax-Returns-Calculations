import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CharityReceipt, Form106, Form867 } from '@taxreturns/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentDetail, TaxYear } from '../api/client';
import {
  confirmDocument,
  extractDocument,
  getDocument,
  getMe,
  listDocuments,
  listTaxYears,
} from '../api/client';
import { renderApp } from '../test/render';

vi.mock('../api/client');

const REVIEW_PATH = '/tax-years/ty-2024/documents/doc-1';

const taxYear: TaxYear = { id: 'ty-2024', year: 2024, status: 'in_review' };

function makeDoc(overrides: Partial<DocumentDetail> = {}): DocumentDetail {
  return {
    id: 'doc-1',
    taxYearId: 'ty-2024',
    kind: 'form106',
    originalFilename: 'tofes106.pdf',
    uploadedAt: '2026-03-01T10:00:00.000Z',
    extractionStatus: 'pending',
    extractionError: null,
    extractedPayload: null,
    confirmedPayload: null,
    ...overrides,
  };
}

const form106Payload: Form106 = {
  taxYear: 2024,
  employerName: 'אקמה בע"מ',
  employerDeductionsFileId: '123456789',
  employeeNationalId: '012345678',
  boxes: { '158': 24_000_000, '042': 3_600_000, '036': 50_000 },
  uncertainBoxes: ['042'],
};

const form867Payload: Form867 = {
  taxYear: 2024,
  brokerName: 'בנק הפועלים',
  accountId: '12-345',
  realGainsAgorot: 1_234_500,
  realLossesAgorot: 0,
  interestDividendAgorot: 45_600,
  taxWithheldAgorot: 308_625,
  uncertainFields: ['taxWithheldAgorot'],
};

const charityPayload: CharityReceipt = {
  taxYear: 2024,
  institutionName: 'עמותת קו לחיים',
  amountAgorot: 50_000,
  hasSection46Approval: true,
  uncertainFields: [],
};

beforeEach(() => {
  vi.mocked(getDocument).mockReset();
  vi.mocked(extractDocument).mockReset();
  vi.mocked(confirmDocument).mockReset();
  vi.mocked(listTaxYears).mockReset().mockResolvedValue([taxYear]);
  vi.mocked(listDocuments).mockReset().mockResolvedValue([]);
  vi.mocked(getMe)
    .mockReset()
    .mockResolvedValue({ id: 'u1', email: 'owner@example.com' });
});

describe('DocumentReview', () => {
  it('shows a pending PDF document with the file viewer, extract and manual-entry actions', async () => {
    vi.mocked(getDocument).mockResolvedValue(makeDoc());

    await renderApp(REVIEW_PATH);

    expect(await screen.findByRole('heading', { name: 'בדיקת מסמך' })).toBeTruthy();
    const frame = screen.getByTitle('תצוגת המסמך tofes106.pdf');
    expect(frame.getAttribute('src')).toBe('/api/documents/doc-1/file');
    expect(screen.getByText(/המסמך טרם עבר חילוץ נתונים/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'חילוץ נתונים' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'הזנה ידנית' })).toBeTruthy();
    expect(vi.mocked(getDocument)).toHaveBeenCalledWith('doc-1');
  });

  it('runs extraction from pending and shows the extracted form', async () => {
    const pending = makeDoc();
    const extracted = makeDoc({
      extractionStatus: 'extracted',
      extractedPayload: form106Payload,
    });
    vi.mocked(getDocument)
      .mockResolvedValueOnce(pending)
      .mockResolvedValue(extracted);
    vi.mocked(extractDocument).mockResolvedValue({ ...extracted });

    const user = userEvent.setup();
    await renderApp(REVIEW_PATH);

    await user.click(await screen.findByRole('button', { name: 'חילוץ נתונים' }));

    await waitFor(() => expect(extractDocument).toHaveBeenCalledWith('doc-1'), {
      timeout: 10_000,
    });
    const employerInput = (await screen.findByLabelText(
      'שם המעסיק',
    )) as HTMLInputElement;
    expect(employerInput.value).toBe('אקמה בע"מ');
  });

  it('renders extracted form106 boxes with labels only for documented codes and highlights uncertain rows', async () => {
    vi.mocked(getDocument).mockResolvedValue(
      makeDoc({ extractionStatus: 'extracted', extractedPayload: form106Payload }),
    );

    await renderApp(REVIEW_PATH);

    // Documented code shows its Hebrew label; undocumented code stays bare.
    expect(await screen.findByText('תיבה 158 — שכר/הכנסה ברוטו')).toBeTruthy();
    expect(screen.getByText('תיבה 042 — מס הכנסה שנוכה')).toBeTruthy();
    expect(screen.getByText('תיבה 036')).toBeTruthy();
    expect(screen.queryByText(/תיבה 036 —/)).toBeNull();

    // Amounts are displayed as shekels.
    const amountValues = screen
      .getAllByLabelText('סכום (בש"ח)')
      .map((input) => (input as HTMLInputElement).value);
    expect(amountValues).toContain('240000');
    expect(amountValues).toContain('36000');
    expect(amountValues).toContain('500');

    // The uncertain box (042) row gets the amber treatment; others do not.
    const codeInputs = screen.getAllByLabelText('קוד תיבה') as HTMLInputElement[];
    const uncertainRow = codeInputs
      .find((input) => input.value === '042')!
      .closest('[data-uncertain="true"]');
    expect(uncertainRow).toBeTruthy();
    expect(uncertainRow!.className).toMatch(/amber/);
    expect(
      codeInputs
        .find((input) => input.value === '158')!
        .closest('[data-uncertain="true"]'),
    ).toBeNull();
    expect(screen.getByText(/שדות מסומנים בכתום/)).toBeTruthy();
  });

  it('confirms an edited form106 with the schema payload in agorot and navigates back', async () => {
    vi.mocked(getDocument).mockResolvedValue(
      makeDoc({ extractionStatus: 'extracted', extractedPayload: form106Payload }),
    );
    vi.mocked(confirmDocument).mockResolvedValue(
      makeDoc({ extractionStatus: 'confirmed' }),
    );

    const user = userEvent.setup();
    const { router } = await renderApp(REVIEW_PATH);

    const employerInput = await screen.findByLabelText('שם המעסיק');
    await user.clear(employerInput);
    await user.type(employerInput, 'מעסיק חדש');

    const amountInput = screen
      .getAllByLabelText('סכום (בש"ח)')
      .find((input) => (input as HTMLInputElement).value === '500')!;
    await user.clear(amountInput);
    await user.type(amountInput, '750.5');

    await user.click(screen.getByRole('button', { name: 'אישור הנתונים' }));

    await waitFor(
      () =>
        expect(confirmDocument).toHaveBeenCalledWith('doc-1', {
          taxYear: 2024,
          employerName: 'מעסיק חדש',
          employerDeductionsFileId: '123456789',
          employeeNationalId: '012345678',
          boxes: { '158': 24_000_000, '042': 3_600_000, '036': 75_050 },
          uncertainBoxes: [],
        }),
      { timeout: 10_000 },
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/tax-years/ty-2024'),
    );
  });

  it('adds a box row and includes it in the confirmed payload', async () => {
    vi.mocked(getDocument).mockResolvedValue(
      makeDoc({ extractionStatus: 'extracted', extractedPayload: form106Payload }),
    );
    vi.mocked(confirmDocument).mockResolvedValue(
      makeDoc({ extractionStatus: 'confirmed' }),
    );

    const user = userEvent.setup();
    await renderApp(REVIEW_PATH);

    await user.click(await screen.findByRole('button', { name: 'הוספת תיבה' }));

    const codeInputs = screen.getAllByLabelText('קוד תיבה') as HTMLInputElement[];
    const newCodeInput = codeInputs.find((input) => input.value === '')!;
    await user.type(newCodeInput, '045');
    const amountInputs = screen.getAllByLabelText('סכום (בש"ח)') as HTMLInputElement[];
    const newAmountInput = amountInputs.find((input) => input.value === '')!;
    await user.type(newAmountInput, '1200');

    await user.click(screen.getByRole('button', { name: 'אישור הנתונים' }));

    await waitFor(
      () =>
        expect(confirmDocument).toHaveBeenCalledWith(
          'doc-1',
          expect.objectContaining({
            boxes: {
              '158': 24_000_000,
              '042': 3_600_000,
              '036': 50_000,
              '045': 120_000,
            },
          }),
        ),
      { timeout: 10_000 },
    );
  });

  it('rejects an invalid form client-side without calling the API', async () => {
    vi.mocked(getDocument).mockResolvedValue(
      makeDoc({ extractionStatus: 'extracted', extractedPayload: form106Payload }),
    );

    const user = userEvent.setup();
    await renderApp(REVIEW_PATH);

    const nationalIdInput = await screen.findByLabelText('תעודת זהות העובד');
    await user.clear(nationalIdInput);
    await user.type(nationalIdInput, 'abc');
    await user.click(screen.getByRole('button', { name: 'אישור הנתונים' }));

    expect(await screen.findByText(/הנתונים שהוזנו אינם תקינים/)).toBeTruthy();
    expect(confirmDocument).not.toHaveBeenCalled();
  });

  it('rejects a duplicate box code with a specific error instead of silently dropping an amount', async () => {
    vi.mocked(getDocument).mockResolvedValue(
      makeDoc({ extractionStatus: 'extracted', extractedPayload: form106Payload }),
    );

    const user = userEvent.setup();
    await renderApp(REVIEW_PATH);

    // Add a second row with a code that already exists (042).
    await user.click(await screen.findByRole('button', { name: 'הוספת תיבה' }));
    const codeInputs = screen.getAllByLabelText('קוד תיבה') as HTMLInputElement[];
    await user.type(codeInputs.find((input) => input.value === '')!, '042');
    const amountInputs = screen.getAllByLabelText('סכום (בש"ח)') as HTMLInputElement[];
    await user.type(amountInputs.find((input) => input.value === '')!, '999');

    await user.click(screen.getByRole('button', { name: 'אישור הנתונים' }));

    expect(await screen.findByText(/קוד התיבה 042 מופיע ביותר משורה אחת/)).toBeTruthy();
    expect(confirmDocument).not.toHaveBeenCalled();
  });

  it('rejects a blank money field client-side — a cleared amount never confirms as 0', async () => {
    vi.mocked(getDocument).mockResolvedValue(
      makeDoc({ extractionStatus: 'extracted', extractedPayload: form106Payload }),
    );

    const user = userEvent.setup();
    await renderApp(REVIEW_PATH);

    const amountInputs = (await screen.findAllByLabelText(
      'סכום (בש"ח)',
    )) as HTMLInputElement[];
    await user.clear(amountInputs[0]!);
    await user.click(screen.getByRole('button', { name: 'אישור הנתונים' }));

    expect(await screen.findByText(/הנתונים שהוזנו אינם תקינים/)).toBeTruthy();
    expect(confirmDocument).not.toHaveBeenCalled();
  });

  it('rejects a negative amount client-side — box amounts are non-negative agorot', async () => {
    vi.mocked(getDocument).mockResolvedValue(
      makeDoc({ extractionStatus: 'extracted', extractedPayload: form106Payload }),
    );

    const user = userEvent.setup();
    await renderApp(REVIEW_PATH);

    const amountInputs = (await screen.findAllByLabelText(
      'סכום (בש"ח)',
    )) as HTMLInputElement[];
    await user.clear(amountInputs[0]!);
    await user.type(amountInputs[0]!, '-100');
    await user.click(screen.getByRole('button', { name: 'אישור הנתונים' }));

    expect(await screen.findByText(/הנתונים שהוזנו אינם תקינים/)).toBeTruthy();
    expect(confirmDocument).not.toHaveBeenCalled();
  });

  it('rejects an absurdly large amount gracefully instead of throwing on agorot overflow', async () => {
    vi.mocked(getDocument).mockResolvedValue(
      makeDoc({ extractionStatus: 'extracted', extractedPayload: form106Payload }),
    );

    const user = userEvent.setup();
    await renderApp(REVIEW_PATH);

    const amountInputs = (await screen.findAllByLabelText(
      'סכום (בש"ח)',
    )) as HTMLInputElement[];
    await user.clear(amountInputs[0]!);
    await user.type(amountInputs[0]!, '1e20');
    await user.click(screen.getByRole('button', { name: 'אישור הנתונים' }));

    expect(await screen.findByText(/הנתונים שהוזנו אינם תקינים/)).toBeTruthy();
    expect(confirmDocument).not.toHaveBeenCalled();
  });

  it('shows the extraction error with retry and manual entry for a failed document', async () => {
    vi.mocked(getDocument).mockResolvedValue(
      makeDoc({
        kind: 'charity_receipt',
        originalFilename: 'receipt.jpg',
        extractionStatus: 'failed',
        extractionError: 'קובץ לא קריא',
      }),
    );
    vi.mocked(extractDocument).mockResolvedValue(
      makeDoc({ kind: 'charity_receipt', extractionStatus: 'extracted' }),
    );

    const user = userEvent.setup();
    await renderApp(REVIEW_PATH);

    expect(await screen.findByText(/קובץ לא קריא/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'הזנה ידנית' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'ניסיון חילוץ חוזר' }));
    await waitFor(() => expect(extractDocument).toHaveBeenCalledWith('doc-1'), {
      timeout: 10_000,
    });
  });

  it('confirms a manually entered charity receipt from pending', async () => {
    vi.mocked(getDocument).mockResolvedValue(
      makeDoc({
        kind: 'charity_receipt',
        originalFilename: 'receipt.jpg',
        extractionStatus: 'pending',
      }),
    );
    vi.mocked(confirmDocument).mockResolvedValue(
      makeDoc({ kind: 'charity_receipt', extractionStatus: 'confirmed' }),
    );

    const user = userEvent.setup();
    await renderApp(REVIEW_PATH);

    await user.click(await screen.findByRole('button', { name: 'הזנה ידנית' }));

    await user.type(await screen.findByLabelText('שנת מס'), '2024');
    await user.type(screen.getByLabelText('שם המוסד'), 'עמותת מים');
    await user.type(screen.getByLabelText('סכום התרומה (בש"ח)'), '500');
    await user.click(screen.getByLabelText('אישור לפי סעיף 46'));
    await user.click(screen.getByRole('button', { name: 'אישור הנתונים' }));

    await waitFor(
      () =>
        expect(confirmDocument).toHaveBeenCalledWith('doc-1', {
          taxYear: 2024,
          institutionName: 'עמותת מים',
          amountAgorot: 50_000,
          hasSection46Approval: true,
          uncertainFields: [],
        }),
      { timeout: 10_000 },
    );
  });

  it('renders extracted form867 in shekels, highlights uncertain fields, and confirms agorot', async () => {
    vi.mocked(getDocument).mockResolvedValue(
      makeDoc({
        kind: 'form867',
        originalFilename: 'broker.pdf',
        extractionStatus: 'extracted',
        extractedPayload: form867Payload,
      }),
    );
    vi.mocked(confirmDocument).mockResolvedValue(
      makeDoc({ kind: 'form867', extractionStatus: 'confirmed' }),
    );

    const user = userEvent.setup();
    await renderApp(REVIEW_PATH);

    const withheldInput = (await screen.findByLabelText(
      'מס שנוכה בשוק ההון (בש"ח)',
    )) as HTMLInputElement;
    expect(withheldInput.value).toBe('3086.25');
    expect(withheldInput.dataset.uncertain).toBe('true');
    expect(withheldInput.className).toMatch(/amber/);

    const gainsInput = screen.getByLabelText('רווח הון ריאלי (בש"ח)') as HTMLInputElement;
    expect(gainsInput.value).toBe('12345');
    expect(gainsInput.dataset.uncertain).toBeUndefined();

    await user.clear(gainsInput);
    await user.type(gainsInput, '20000.5');
    await user.click(screen.getByRole('button', { name: 'אישור הנתונים' }));

    await waitFor(
      () =>
        expect(confirmDocument).toHaveBeenCalledWith('doc-1', {
          taxYear: 2024,
          brokerName: 'בנק הפועלים',
          accountId: '12-345',
          realGainsAgorot: 2_000_050,
          realLossesAgorot: 0,
          interestDividendAgorot: 45_600,
          taxWithheldAgorot: 308_625,
          uncertainFields: [],
        }),
      { timeout: 10_000 },
    );
  });

  it('shows a confirmed document read-only and allows editing to re-confirm', async () => {
    vi.mocked(getDocument).mockResolvedValue(
      makeDoc({
        kind: 'charity_receipt',
        originalFilename: 'receipt.jpg',
        extractionStatus: 'confirmed',
        confirmedPayload: charityPayload,
      }),
    );
    vi.mocked(confirmDocument).mockResolvedValue(
      makeDoc({ kind: 'charity_receipt', extractionStatus: 'confirmed' }),
    );

    const user = userEvent.setup();
    await renderApp(REVIEW_PATH);

    expect(await screen.findByText(/המסמך אושר/)).toBeTruthy();
    const nameInput = screen.getByLabelText('שם המוסד') as HTMLInputElement;
    expect(nameInput.value).toBe('עמותת קו לחיים');
    expect(nameInput.disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'אישור הנתונים' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'עריכה ואישור מחדש' }));
    expect((screen.getByLabelText('שם המוסד') as HTMLInputElement).disabled).toBe(false);

    const amountInput = screen.getByLabelText('סכום התרומה (בש"ח)');
    await user.clear(amountInput);
    await user.type(amountInput, '600');
    await user.click(screen.getByRole('button', { name: 'אישור הנתונים' }));

    await waitFor(
      () =>
        expect(confirmDocument).toHaveBeenCalledWith(
          'doc-1',
          expect.objectContaining({ amountAgorot: 60_000 }),
        ),
      { timeout: 10_000 },
    );
  });

  it('shows only the file viewer for kind "other"', async () => {
    vi.mocked(getDocument).mockResolvedValue(
      makeDoc({ kind: 'other', originalFilename: 'note.png' }),
    );

    await renderApp(REVIEW_PATH);

    expect(await screen.findByAltText('תצוגת המסמך note.png')).toBeTruthy();
    expect(screen.getByText(/אין נתונים לחילוץ/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'חילוץ נתונים' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'הזנה ידנית' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'אישור הנתונים' })).toBeNull();
  });

  it('zooms the image viewer via the zoom buttons', async () => {
    vi.mocked(getDocument).mockResolvedValue(
      makeDoc({
        kind: 'charity_receipt',
        originalFilename: 'receipt.jpg',
        extractionStatus: 'pending',
      }),
    );

    const user = userEvent.setup();
    await renderApp(REVIEW_PATH);

    const image = (await screen.findByAltText(
      'תצוגת המסמך receipt.jpg',
    )) as HTMLImageElement;
    expect(image.style.width).toBe('100%');

    await user.click(screen.getByRole('button', { name: 'הגדלה' }));
    expect(image.style.width).toBe('150%');

    await user.click(screen.getByRole('button', { name: 'הקטנה' }));
    expect(image.style.width).toBe('100%');
  });
});
