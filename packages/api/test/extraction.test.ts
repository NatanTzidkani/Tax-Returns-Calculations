import { describe, expect, it } from 'vitest';
import {
  EXTRACTION_MODEL,
  ExtractionFailedError,
  extractDocument,
  type ExtractionClient,
} from '../src/extraction/extractor';

const form106Wire = {
  taxYear: 2025,
  employerName: 'אקמי בע"מ',
  employerDeductionsFileId: '912345678',
  employeeNationalId: '012345678',
  boxes: [
    { code: '158', amountAgorot: 24_000_000 },
    { code: '042', amountAgorot: 3_600_000 },
    { code: '045', amountAgorot: 1_200_000 },
  ],
  uncertainBoxes: ['045'],
};

function fakeClient(response: Partial<Awaited<ReturnType<ExtractionClient['messages']['parse']>>> & { capture?: (params: unknown) => void }): ExtractionClient {
  const { capture, ...res } = response;
  return {
    messages: {
      parse: async (params: unknown) => {
        capture?.(params);
        return {
          model: EXTRACTION_MODEL,
          stop_reason: 'end_turn',
          parsed_output: null,
          ...res,
        };
      },
    },
  };
}

const pdf = { data: Buffer.from('%PDF-1.4 fake'), mediaType: 'application/pdf' };

describe('extractDocument', () => {
  it('extracts a form 106, folding wire boxes into the shared record shape', async () => {
    let sent: any;
    const client = fakeClient({ parsed_output: form106Wire, capture: (p) => (sent = p) });
    const result = await extractDocument(client, { kind: 'form106', ...pdf });

    expect((result.payload as any).boxes).toEqual({
      '158': 24_000_000,
      '042': 3_600_000,
      '045': 1_200_000,
    });
    expect((result.payload as any).uncertainBoxes).toEqual(['045']);
    expect(result.model).toBe(EXTRACTION_MODEL);
    expect(result.raw).toEqual(form106Wire);

    // request shape: model, structured output format, document block first
    expect(sent.model).toBe(EXTRACTION_MODEL);
    expect(sent.output_config.format).toBeTruthy();
    expect(sent.messages[0].content[0].type).toBe('document');
    expect(sent.messages[0].content[0].source.media_type).toBe('application/pdf');
    expect(sent.messages[0].content[1].type).toBe('text');
  });

  it('sums duplicate box codes', async () => {
    const wire = {
      ...form106Wire,
      boxes: [
        { code: '158', amountAgorot: 1_000 },
        { code: '158', amountAgorot: 500 },
      ],
      uncertainBoxes: [],
    };
    const client = fakeClient({ parsed_output: wire });
    const result = await extractDocument(client, { kind: 'form106', ...pdf });
    expect((result.payload as any).boxes['158']).toBe(1_500);
  });

  it('extracts an 867, stripping nulls for optional fields', async () => {
    const wire = {
      taxYear: 2025,
      brokerName: 'בנק',
      accountId: null,
      realGainsAgorot: 100,
      realLossesAgorot: 0,
      interestDividendAgorot: 0,
      taxWithheldAgorot: 25,
      uncertainFields: [],
    };
    const client = fakeClient({ parsed_output: wire });
    const result = await extractDocument(client, { kind: 'form867', ...pdf });
    expect(result.payload).not.toHaveProperty('accountId');
    expect((result.payload as any).realGainsAgorot).toBe(100);
  });

  it('sends images as image blocks', async () => {
    let sent: any;
    const wire = {
      taxYear: 2025,
      institutionName: 'עמותה',
      institutionRegistrationId: null,
      receiptNumber: null,
      amountAgorot: 20_700,
      donationDate: null,
      hasSection46Approval: true,
      uncertainFields: [],
    };
    const client = fakeClient({ parsed_output: wire, capture: (p) => (sent = p) });
    await extractDocument(client, {
      kind: 'charity_receipt',
      data: Buffer.from('png'),
      mediaType: 'image/png',
    });
    expect(sent.messages[0].content[0].type).toBe('image');
    expect(sent.messages[0].content[0].source.media_type).toBe('image/png');
  });

  it('fails loudly on unsupported media types without calling the API', async () => {
    const client = fakeClient({});
    await expect(
      extractDocument(client, {
        kind: 'form106',
        data: Buffer.from('x'),
        mediaType: 'application/zip',
      }),
    ).rejects.toThrow(ExtractionFailedError);
  });

  it('fails on refusal, truncation, missing output, and schema violations', async () => {
    const cases: Array<Parameters<typeof fakeClient>[0]> = [
      { stop_reason: 'refusal', parsed_output: form106Wire },
      { stop_reason: 'max_tokens', parsed_output: form106Wire },
      { parsed_output: null },
      // schema violation: employer id not 9 digits survives the wire schema
      // but must be caught by the shared schema validation
      { parsed_output: { ...form106Wire, employerDeductionsFileId: '12' } },
    ];
    for (const c of cases) {
      await expect(
        extractDocument(fakeClient(c), { kind: 'form106', ...pdf }),
      ).rejects.toThrow(ExtractionFailedError);
    }
  });

  it('wraps API transport errors', async () => {
    const client: ExtractionClient = {
      messages: {
        parse: async () => {
          throw new Error('rate limited');
        },
      },
    };
    await expect(
      extractDocument(client, { kind: 'form106', ...pdf }),
    ).rejects.toThrow(/rate limited/);
  });
});
