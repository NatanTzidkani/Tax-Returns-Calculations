import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { ExtractableDocumentKind } from '@taxreturns/shared';
import { extractionKinds, validatePayload } from './kinds';

export const EXTRACTION_MODEL = 'claude-opus-4-8';

export class ExtractionFailedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'ExtractionFailedError';
  }
}

/** The slice of the Anthropic client the extractor uses — injectable in tests. */
export interface ExtractionClient {
  messages: {
    parse(params: unknown): Promise<{
      model: string;
      stop_reason: string | null;
      parsed_output: unknown;
    }>;
  };
}

export interface ExtractionInput {
  kind: ExtractableDocumentKind;
  data: Buffer;
  mediaType: string;
}

export interface ExtractionResult {
  /** Validated against the shared schema for the kind */
  payload: unknown;
  /** Raw structured output as the model produced it (audit trail) */
  raw: unknown;
  model: string;
}

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

function fileBlock(data: Buffer, mediaType: string): unknown {
  const b64 = data.toString('base64');
  if (mediaType === 'application/pdf') {
    return {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: b64 },
    };
  }
  if (IMAGE_TYPES.has(mediaType)) {
    return {
      type: 'image',
      source: { type: 'base64', media_type: mediaType, data: b64 },
    };
  }
  throw new ExtractionFailedError(`סוג קובץ לא נתמך לחילוץ: ${mediaType}`);
}

/**
 * Synchronous single-request extraction (spec §5): the document goes to the
 * Claude API as a vision block, the kind's wire schema constrains the output,
 * and the result is validated against the shared Zod schema before returning.
 */
export async function extractDocument(
  client: ExtractionClient,
  input: ExtractionInput,
): Promise<ExtractionResult> {
  const config = extractionKinds[input.kind];
  const block = fileBlock(input.data, input.mediaType);

  let response;
  try {
    response = await client.messages.parse({
      model: EXTRACTION_MODEL,
      max_tokens: 16_000,
      output_config: { format: zodOutputFormat(config.wireSchema) },
      messages: [
        {
          role: 'user',
          content: [block, { type: 'text', text: config.prompt }],
        },
      ],
    });
  } catch (err) {
    throw new ExtractionFailedError(
      `קריאת ה-API נכשלה: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (response.stop_reason === 'refusal') {
    throw new ExtractionFailedError('המודל סירב לעבד את המסמך');
  }
  if (response.stop_reason === 'max_tokens') {
    throw new ExtractionFailedError('הפלט נחתך (max_tokens) — נסה שוב');
  }
  if (response.parsed_output == null) {
    throw new ExtractionFailedError('המודל לא החזיר פלט מובנה תקין');
  }

  let payload: unknown;
  try {
    payload = validatePayload(
      input.kind,
      config.toPayload(response.parsed_output),
    );
  } catch (err) {
    throw new ExtractionFailedError(
      `הפלט לא עבר אימות סכימה: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return { payload, raw: response.parsed_output, model: response.model };
}
