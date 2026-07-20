import { describe, expect, it } from 'vitest';
import { Form106Schema } from '../src/documents/form106';

const valid = {
  taxYear: 2025,
  employerName: 'אקמי בע"מ',
  employerDeductionsFileId: '912345678',
  employeeNationalId: '012345678',
  boxes: {
    '158': 24_000_000, // gross salary income, in agorot
    '042': 3_600_000, // income tax withheld
    '045': 1_200_000, // employee pension contributions
  },
  uncertainBoxes: ['045'],
};

describe('Form106Schema', () => {
  it('accepts a valid form', () => {
    const parsed = Form106Schema.parse(valid);
    expect(parsed.boxes['158']).toBe(24_000_000);
  });

  it('defaults uncertainBoxes to empty array', () => {
    const { uncertainBoxes: _omit, ...rest } = valid;
    expect(Form106Schema.parse(rest).uncertainBoxes).toEqual([]);
  });

  it('rejects a non-9-digit employer deductions file id', () => {
    expect(() =>
      Form106Schema.parse({ ...valid, employerDeductionsFileId: '12345' }),
    ).toThrow();
  });

  it('rejects box codes that are not 3 digits', () => {
    expect(() =>
      Form106Schema.parse({ ...valid, boxes: { '42': 100 } }),
    ).toThrow();
  });

  it('rejects non-integer box values (amounts must be agorot)', () => {
    expect(() =>
      Form106Schema.parse({ ...valid, boxes: { '158': 240.5 } }),
    ).toThrow();
  });

  it('rejects negative box values (amounts are non-negative, like form867/charity)', () => {
    expect(() =>
      Form106Schema.parse({ ...valid, boxes: { '158': -1 } }),
    ).toThrow();
  });

  it('round-trips through JSON', () => {
    const parsed = Form106Schema.parse(valid);
    expect(Form106Schema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
  });
});
