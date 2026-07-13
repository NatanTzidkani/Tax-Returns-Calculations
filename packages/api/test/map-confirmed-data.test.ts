import type { CalculateRequest } from '@taxreturns/shared';
import { describe, expect, it } from 'vitest';
import {
  mapConfirmedData,
  type ConfirmedDocumentInput,
} from '../src/calculation/map-confirmed-data';

const taxpayer: CalculateRequest['taxpayer'] = {
  gender: 'male',
  isIsraeliResident: true,
  additionalCreditPoints: 0,
};

const form106 = (boxes: Record<string, number>): ConfirmedDocumentInput => ({
  kind: 'form106',
  payload: {
    taxYear: 2025,
    employerName: 'אקמי בע"מ',
    employerDeductionsFileId: '912345678',
    employeeNationalId: '012345678',
    boxes,
    uncertainBoxes: [],
  },
});

function map(documents: ConfirmedDocumentInput[], lossCarryforwardInAgorot = 0) {
  return mapConfirmedData({ year: 2025, taxpayer, documents, lossCarryforwardInAgorot });
}

describe('mapConfirmedData', () => {
  it('maps form106 boxes 158/042/045 into a SalaryInput', () => {
    const { input } = map([
      form106({ '158': 24_000_000, '042': 3_600_000, '045': 1_200_000 }),
    ]);
    expect(input.salaries).toEqual([
      {
        employerName: 'אקמי בע"מ',
        grossSalaryAgorot: 24_000_000,
        taxWithheldAgorot: 3_600_000,
        pensionEmployeeContributionAgorot: 1_200_000,
      },
    ]);
    expect(input.year).toBe(2025);
    expect(input.taxpayer).toEqual(taxpayer);
  });

  it('treats missing form106 boxes as 0', () => {
    const { input } = map([form106({ '158': 24_000_000 })]);
    expect(input.salaries[0]).toMatchObject({
      grossSalaryAgorot: 24_000_000,
      taxWithheldAgorot: 0,
      pensionEmployeeContributionAgorot: 0,
    });
  });

  it('ignores undocumented form106 boxes (only 158/042/045 are mapped)', () => {
    const { input } = map([form106({ '158': 1_000, '999': 77_000 })]);
    expect(input.salaries[0]!.grossSalaryAgorot).toBe(1_000);
    expect(Object.values(input.salaries[0]!)).not.toContain(77_000);
  });

  it('maps form867 fields onto BrokerEntryInput names (realGainsAgorot→realGainAgorot etc.)', () => {
    const { input } = map([
      {
        kind: 'form867',
        payload: {
          taxYear: 2025,
          brokerName: 'בנק הפועלים',
          realGainsAgorot: 5_000_000,
          realLossesAgorot: 1_000_000,
          interestDividendAgorot: 250_000,
          taxWithheldAgorot: 900_000,
          uncertainFields: [],
        },
      },
    ]);
    expect(input.capital.entries).toEqual([
      {
        brokerName: 'בנק הפועלים',
        realGainAgorot: 5_000_000,
        realLossAgorot: 1_000_000,
        interestDividendAgorot: 250_000,
        taxWithheldAgorot: 900_000,
      },
    ]);
  });

  it('includes §46-approved donations and excludes (but counts) unapproved ones', () => {
    const receipt = (name: string, amountAgorot: number, approved: boolean) => ({
      kind: 'charity_receipt' as const,
      payload: {
        taxYear: 2025,
        institutionName: name,
        amountAgorot,
        hasSection46Approval: approved,
        uncertainFields: [],
      },
    });
    const { input, excludedDonations } = map([
      receipt('עמותה א', 50_000, true),
      receipt('עמותה ב', 30_000, false),
      receipt('עמותה ג', 20_000, false),
    ]);
    expect(input.donations).toEqual([
      { institutionName: 'עמותה א', amountAgorot: 50_000 },
    ]);
    expect(excludedDonations).toBe(2);
  });

  it("ignores documents of kind 'other'", () => {
    const { input, excludedDonations } = map([
      { kind: 'other', payload: { anything: true } },
    ]);
    expect(input.salaries).toEqual([]);
    expect(input.donations).toEqual([]);
    expect(input.capital.entries).toEqual([]);
    expect(excludedDonations).toBe(0);
  });

  it('threads the carry-forward-in amount into capital.lossCarryforwardInAgorot', () => {
    const { input } = map([], 4_200_000);
    expect(input.capital.lossCarryforwardInAgorot).toBe(4_200_000);
  });

  it('produces an empty (zero-return) input for zero documents', () => {
    const { input } = map([]);
    expect(input).toEqual({
      year: 2025,
      taxpayer,
      salaries: [],
      donations: [],
      capital: { entries: [], lossCarryforwardInAgorot: 0 },
    });
  });

  it('maps supplied non-linked-interest fields into the engine input', () => {
    const { input } = mapConfirmedData({
      year: 2025,
      taxpayer,
      documents: [],
      lossCarryforwardInAgorot: 0,
      nonLinkedInterestAgorot: 1_000_000,
      nonLinkedInterestWithheldAgorot: 150_000,
    });
    expect(input.nonLinkedInterest).toEqual({
      amountAgorot: 1_000_000,
      taxWithheldAgorot: 150_000,
    });
  });

  it('defaults a missing non-linked-interest sub-field to 0 when the other is present', () => {
    const { input } = mapConfirmedData({
      year: 2025,
      taxpayer,
      documents: [],
      lossCarryforwardInAgorot: 0,
      nonLinkedInterestAgorot: 1_000_000,
    });
    expect(input.nonLinkedInterest).toEqual({
      amountAgorot: 1_000_000,
      taxWithheldAgorot: 0,
    });
  });

  it('omits nonLinkedInterest entirely when neither field is supplied (safe no-op)', () => {
    const { input } = map([]);
    expect(input.nonLinkedInterest).toBeUndefined();
  });

  it('throws when a confirmed payload does not match its schema (corrupt data fails loudly)', () => {
    expect(() =>
      map([{ kind: 'form106', payload: { nope: true } }]),
    ).toThrow();
  });
});
