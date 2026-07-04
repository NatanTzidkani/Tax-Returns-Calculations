import { describe, expect, it } from 'vitest';
import { CharityReceiptSchema } from '../src/documents/charity-receipt';
import { documentSchemas } from '../src/documents';

const valid = {
  taxYear: 2025,
  institutionName: 'עמותת צדקה',
  institutionRegistrationId: '580123456',
  receiptNumber: 'A-1042',
  amountAgorot: 50_000,
  donationDate: '2025-03-15',
  hasSection46Approval: true,
  uncertainFields: [],
};

describe('CharityReceiptSchema', () => {
  it('accepts a valid receipt', () => {
    expect(CharityReceiptSchema.parse(valid).amountAgorot).toBe(50_000);
  });

  it('defaults uncertainFields and allows omitting optional fields', () => {
    const {
      uncertainFields: _u,
      institutionRegistrationId: _r,
      receiptNumber: _n,
      donationDate: _d,
      ...rest
    } = valid;
    expect(CharityReceiptSchema.parse(rest).uncertainFields).toEqual([]);
  });

  it('rejects zero or negative amounts', () => {
    expect(() => CharityReceiptSchema.parse({ ...valid, amountAgorot: 0 })).toThrow();
    expect(() => CharityReceiptSchema.parse({ ...valid, amountAgorot: -5 })).toThrow();
  });

  it('rejects a malformed registration id or date', () => {
    expect(() =>
      CharityReceiptSchema.parse({ ...valid, institutionRegistrationId: '12' }),
    ).toThrow();
    expect(() =>
      CharityReceiptSchema.parse({ ...valid, donationDate: '15/03/2025' }),
    ).toThrow();
  });
});

describe('documentSchemas', () => {
  it('maps every extractable document kind to its schema', () => {
    expect(Object.keys(documentSchemas).sort()).toEqual([
      'charity_receipt',
      'form106',
      'form867',
    ]);
    expect(documentSchemas.charity_receipt).toBe(CharityReceiptSchema);
  });
});
