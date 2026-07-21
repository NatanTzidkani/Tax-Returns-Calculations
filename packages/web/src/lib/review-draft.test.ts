import type { CharityReceipt, Form106, Form867 } from '@taxreturns/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  charityFormState,
  clearStoredDraft,
  DRAFT_TTL_MS,
  draftStorageKey,
  fingerprintPayload,
  form106FormState,
  form867FormState,
  loadStoredDraft,
  resolveDraft,
  saveStoredDraft,
  type StoredReviewDraft,
} from './review-draft';

const form106Payload: Form106 = {
  taxYear: 2024,
  employerName: 'אקמה בע"מ',
  employerDeductionsFileId: '123456789',
  employeeNationalId: '012345678',
  boxes: { '158': 24_000_000, '042': 3_600_000 },
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
  uncertainFields: [],
};

const charityPayload: CharityReceipt = {
  taxYear: 2024,
  institutionName: 'עמותת קו לחיים',
  amountAgorot: 50_000,
  hasSection46Approval: true,
  uncertainFields: [],
};

function makeDraft(overrides: Partial<StoredReviewDraft> = {}): StoredReviewDraft {
  return {
    version: 1,
    kind: 'form106',
    baseFingerprint: fingerprintPayload(form106Payload),
    form: form106FormState(form106Payload),
    savedAt: '2026-07-17T10:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe('fingerprintPayload', () => {
  it('is stable under object key reordering', () => {
    const reordered = {
      uncertainBoxes: ['042'],
      boxes: { '042': 3_600_000, '158': 24_000_000 },
      employeeNationalId: '012345678',
      employerDeductionsFileId: '123456789',
      employerName: 'אקמה בע"מ',
      taxYear: 2024,
    } as Form106;
    expect(fingerprintPayload(reordered)).toBe(fingerprintPayload(form106Payload));
  });

  it('differs across payloads and distinguishes null (manual entry)', () => {
    expect(fingerprintPayload(form106Payload)).not.toBe(
      fingerprintPayload({ ...form106Payload, employerName: 'אחר' }),
    );
    expect(fingerprintPayload(null)).not.toBe(fingerprintPayload(form106Payload));
  });
});

describe('formStateFromPayload derivations', () => {
  it('derives form106 state with shekel-string box rows', () => {
    expect(form106FormState(form106Payload)).toEqual({
      taxYear: '2024',
      employerName: 'אקמה בע"מ',
      deductionsFileId: '123456789',
      nationalId: '012345678',
      rows: [
        { code: '158', amountShekels: '240000' },
        { code: '042', amountShekels: '36000' },
      ],
    });
  });

  it('derives an empty form106 state (manual entry) with one blank row', () => {
    expect(form106FormState(null)).toEqual({
      taxYear: '',
      employerName: '',
      deductionsFileId: '',
      nationalId: '',
      rows: [{ code: '', amountShekels: '' }],
    });
  });

  it('derives form867 and charity states in display strings', () => {
    expect(form867FormState(form867Payload)).toEqual({
      taxYear: '2024',
      brokerName: 'בנק הפועלים',
      accountId: '12-345',
      amounts: {
        realGainsAgorot: '12345',
        realLossesAgorot: '0',
        interestDividendAgorot: '456',
        taxWithheldAgorot: '3086.25',
      },
    });
    expect(charityFormState(charityPayload)).toEqual({
      taxYear: '2024',
      institutionName: 'עמותת קו לחיים',
      registrationId: '',
      receiptNumber: '',
      amountShekels: '500',
      donationDate: '',
      hasApproval: true,
    });
  });
});

describe('stored draft round-trip and validation', () => {
  it('saves and loads a draft record', () => {
    const draft = makeDraft();
    saveStoredDraft('doc-1', draft);
    expect(loadStoredDraft('doc-1')).toEqual(draft);
    expect(loadStoredDraft('doc-2')).toBeNull();
  });

  it('clears a stored draft', () => {
    saveStoredDraft('doc-1', makeDraft());
    clearStoredDraft('doc-1');
    expect(localStorage.getItem(draftStorageKey('doc-1'))).toBeNull();
  });

  it('rejects and removes corrupt JSON', () => {
    localStorage.setItem(draftStorageKey('doc-1'), '{not json');
    expect(loadStoredDraft('doc-1')).toBeNull();
    expect(localStorage.getItem(draftStorageKey('doc-1'))).toBeNull();
  });

  it('rejects and removes an unknown record version', () => {
    localStorage.setItem(
      draftStorageKey('doc-1'),
      JSON.stringify({ ...makeDraft(), version: 2 }),
    );
    expect(loadStoredDraft('doc-1')).toBeNull();
    expect(localStorage.getItem(draftStorageKey('doc-1'))).toBeNull();
  });

  it('rejects and removes a form shape that does not match the kind', () => {
    localStorage.setItem(
      draftStorageKey('doc-1'),
      JSON.stringify(makeDraft({ form: { taxYear: 2024 } as never })),
    );
    expect(loadStoredDraft('doc-1')).toBeNull();
    expect(localStorage.getItem(draftStorageKey('doc-1'))).toBeNull();
  });
});

describe('stored draft expiry (TTL)', () => {
  it('loads a draft saved just now', () => {
    const draft = makeDraft({ savedAt: new Date().toISOString() });
    saveStoredDraft('doc-1', draft);
    expect(loadStoredDraft('doc-1')).toEqual(draft);
  });

  it('loads a draft saved just under the retention window', () => {
    const draft = makeDraft({
      savedAt: new Date(Date.now() - (DRAFT_TTL_MS - 60_000)).toISOString(),
    });
    saveStoredDraft('doc-1', draft);
    expect(loadStoredDraft('doc-1')).toEqual(draft);
  });

  it('expires and removes a draft older than the retention window', () => {
    const draft = makeDraft({
      savedAt: new Date(Date.now() - (DRAFT_TTL_MS + 60_000)).toISOString(),
    });
    saveStoredDraft('doc-1', draft);
    expect(loadStoredDraft('doc-1')).toBeNull();
    expect(localStorage.getItem(draftStorageKey('doc-1'))).toBeNull();
  });

  it('treats an unparseable/NaN savedAt as expired and removes it', () => {
    saveStoredDraft('doc-1', makeDraft({ savedAt: 'not-a-timestamp' }));
    expect(loadStoredDraft('doc-1')).toBeNull();
    expect(localStorage.getItem(draftStorageKey('doc-1'))).toBeNull();
  });
});

describe('resolveDraft', () => {
  const serverForm = form106FormState(form106Payload);

  it('returns the server form with no notice when no draft exists', () => {
    expect(resolveDraft('doc-1', 'form106', form106Payload, serverForm)).toEqual({
      initialForm: serverForm,
      notice: null,
      dropStored: false,
    });
  });

  it('restores a differing draft with the restored notice', () => {
    const draftForm = { ...serverForm, employerName: 'מעסיק טיוטה' };
    saveStoredDraft('doc-1', makeDraft({ form: draftForm }));
    expect(resolveDraft('doc-1', 'form106', form106Payload, serverForm)).toEqual({
      initialForm: draftForm,
      notice: 'restored',
      dropStored: false,
    });
  });

  it('marks a draft equal to the server values for removal without a notice', () => {
    saveStoredDraft('doc-1', makeDraft());
    expect(resolveDraft('doc-1', 'form106', form106Payload, serverForm)).toEqual({
      initialForm: serverForm,
      notice: null,
      dropStored: true,
    });
  });

  it('drops a draft saved against a different extraction payload, loudly', () => {
    const draftForm = { ...serverForm, employerName: 'מעסיק טיוטה' };
    saveStoredDraft(
      'doc-1',
      makeDraft({
        form: draftForm,
        baseFingerprint: fingerprintPayload({ ...form106Payload, employerName: 'אחר' }),
      }),
    );
    expect(resolveDraft('doc-1', 'form106', form106Payload, serverForm)).toEqual({
      initialForm: serverForm,
      notice: 'staleDropped',
      dropStored: true,
    });
  });

  it('treats a draft for a different kind as no draft and marks it for removal', () => {
    saveStoredDraft(
      'doc-1',
      makeDraft({
        kind: 'form867',
        form: form867FormState(form867Payload),
        baseFingerprint: fingerprintPayload(form867Payload),
      }),
    );
    expect(resolveDraft('doc-1', 'form106', form106Payload, serverForm)).toEqual({
      initialForm: serverForm,
      notice: null,
      dropStored: true,
    });
  });
});
