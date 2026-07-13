import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { documentSchemas, type ExtractableDocumentKind } from '@taxreturns/shared';
import { and, desc, eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { ResolvedDeps } from '../app';
import { requireUserId } from '../auth/session';
import { confirmedData, documents, extractedFields, taxYears } from '../db/schema';
import { ExtractionFailedError, extractDocument } from '../extraction/extractor';

const DOCUMENT_KINDS = ['form106', 'form867', 'charity_receipt', 'other'] as const;
type DocumentKind = (typeof DOCUMENT_KINDS)[number];

const uuid = z.uuid();

const MSG = {
  taxYearNotFound: 'שנת המס לא נמצאה',
  documentNotFound: 'המסמך לא נמצא',
  notMultipart: 'יש לשלוח את הקובץ כטופס multipart/form-data',
  missingFile: 'חסר קובץ להעלאה',
  invalidKind: `סוג מסמך לא תקין — הערכים המותרים: ${DOCUMENT_KINDS.join(', ')}`,
  extractOther: 'לא ניתן להפעיל חילוץ על מסמך מסוג "אחר" — אין לו סכימת נתונים',
  confirmOther: 'לא ניתן לאשר נתונים למסמך מסוג "אחר" — אין לו סכימת נתונים',
  missingPayload: 'חסר שדה payload בגוף הבקשה',
} as const;

/** Media type by file extension — extraction supports PDF and common images. */
const MEDIA_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

function mediaTypeFor(filename: string): string {
  return MEDIA_TYPES[path.extname(filename).toLowerCase()] ?? 'application/octet-stream';
}

function isExtractable(kind: DocumentKind): kind is ExtractableDocumentKind {
  return kind !== 'other';
}

/**
 * RFC 6266/5987 Content-Disposition. Header values must be Latin-1 — a raw
 * Hebrew filename makes Node throw ERR_INVALID_CHAR (a 500). So: an
 * ASCII-sanitized `filename=` fallback plus the real name percent-encoded
 * in `filename*=UTF-8''…` (which is what browsers actually display).
 */
function inlineContentDisposition(filename: string): string {
  const fallback = filename.replace(/"/g, "'").replace(/[^\x20-\x7e]/g, '_');
  const encoded = encodeURIComponent(filename).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `inline; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export async function documentRoutes(
  app: FastifyInstance,
  opts: { deps: ResolvedDeps },
): Promise<void> {
  const { deps } = opts;

  /** Loads a document only if its tax year belongs to the requester. */
  async function loadDocument(rawId: string, req: FastifyRequest) {
    const parsed = uuid.safeParse(rawId);
    if (!parsed.success) return undefined;
    const [row] = await deps.db
      .select()
      .from(documents)
      .innerJoin(taxYears, eq(documents.taxYearId, taxYears.id))
      .where(and(eq(documents.id, parsed.data), eq(taxYears.userId, requireUserId(req))));
    return row?.documents;
  }

  /** Loads a tax year only if it belongs to the requester — otherwise 404. */
  async function loadOwnedTaxYear(rawId: string, req: FastifyRequest) {
    const parsed = uuid.safeParse(rawId);
    if (!parsed.success) return undefined;
    const [row] = await deps.db
      .select()
      .from(taxYears)
      .where(and(eq(taxYears.id, parsed.data), eq(taxYears.userId, requireUserId(req))));
    return row;
  }

  app.get('/tax-years/:taxYearId/documents', async (req, reply) => {
    const { taxYearId: rawId } = req.params as { taxYearId: string };
    const taxYear = await loadOwnedTaxYear(rawId, req);
    if (!taxYear) return reply.code(404).send({ message: MSG.taxYearNotFound });

    return deps.db
      .select()
      .from(documents)
      .where(eq(documents.taxYearId, taxYear.id))
      .orderBy(documents.uploadedAt);
  });

  app.post('/tax-years/:taxYearId/documents', async (req, reply) => {
    const { taxYearId: rawId } = req.params as { taxYearId: string };
    const taxYear = await loadOwnedTaxYear(rawId, req);
    if (!taxYear) return reply.code(404).send({ message: MSG.taxYearNotFound });

    if (!req.isMultipart()) {
      return reply.code(400).send({ message: MSG.notMultipart });
    }
    const file = await req.file();
    if (!file) return reply.code(400).send({ message: MSG.missingFile });

    // Consumes the stream; throws 413 (handled globally) past the 15MB limit.
    const data = await file.toBuffer();

    // `kind` must precede the file part so it is parsed by now.
    const kindField = file.fields['kind'];
    const kindValue =
      kindField && !Array.isArray(kindField) && kindField.type === 'field'
        ? kindField.value
        : undefined;
    const kind = DOCUMENT_KINDS.find((k) => k === kindValue);
    if (!kind) return reply.code(400).send({ message: MSG.invalidKind });

    const storageKey = `${taxYear.id}/${randomUUID()}-${file.filename}`;
    await deps.storage.put(storageKey, data);

    const [row] = await deps.db
      .insert(documents)
      .values({
        taxYearId: taxYear.id,
        kind,
        storageKey,
        originalFilename: file.filename,
      })
      .returning();
    return reply.code(201).send(row);
  });

  app.post('/documents/:id/extract', async (req, reply) => {
    const doc = await loadDocument((req.params as { id: string }).id, req);
    if (!doc) return reply.code(404).send({ message: MSG.documentNotFound });
    if (!isExtractable(doc.kind)) {
      return reply.code(400).send({ message: MSG.extractOther });
    }

    const data = await deps.storage.get(doc.storageKey);
    try {
      const result = await extractDocument(deps.anthropic, {
        kind: doc.kind,
        data,
        mediaType: mediaTypeFor(doc.originalFilename),
      });
      // Append-only audit trail: retries add rows, never overwrite.
      await deps.db.insert(extractedFields).values({
        documentId: doc.id,
        payload: result.payload,
        model: result.model,
      });
      const [updated] = await deps.db
        .update(documents)
        .set({ extractionStatus: 'extracted', extractionError: null })
        .where(eq(documents.id, doc.id))
        .returning();
      return reply.send({ ...updated, extractedPayload: result.payload });
    } catch (err) {
      if (err instanceof ExtractionFailedError) {
        await deps.db
          .update(documents)
          .set({ extractionStatus: 'failed', extractionError: err.message })
          .where(eq(documents.id, doc.id));
        return reply.code(502).send({ message: err.message });
      }
      throw err;
    }
  });

  app.post('/documents/:id/confirm', async (req, reply) => {
    const doc = await loadDocument((req.params as { id: string }).id, req);
    if (!doc) return reply.code(404).send({ message: MSG.documentNotFound });
    if (!isExtractable(doc.kind)) {
      return reply.code(400).send({ message: MSG.confirmOther });
    }

    const body = req.body as { payload?: unknown } | null;
    if (!body || body.payload === undefined) {
      return reply.code(400).send({ message: MSG.missingPayload });
    }

    const parsed = documentSchemas[doc.kind].safeParse(body.payload);
    if (!parsed.success) {
      const fields = [
        ...new Set(parsed.error.issues.map((i) => i.path.join('.') || '(שורש)')),
      ].join(', ');
      return reply
        .code(400)
        .send({ message: `הנתונים אינם תקינים בשדות: ${fields}` });
    }

    // Confirmation is legal from ANY prior status — confirming a `pending`
    // or `failed` document IS the manual-entry fallback (plan Task 4).
    await deps.db.insert(confirmedData).values({
      documentId: doc.id,
      payload: parsed.data,
    });
    const [updated] = await deps.db
      .update(documents)
      .set({ extractionStatus: 'confirmed' })
      .where(eq(documents.id, doc.id))
      .returning();
    return reply.send({ ...updated, confirmedPayload: parsed.data });
  });

  app.get('/documents/:id/file', async (req, reply) => {
    const doc = await loadDocument((req.params as { id: string }).id, req);
    if (!doc) return reply.code(404).send({ message: MSG.documentNotFound });

    const data = await deps.storage.get(doc.storageKey);
    return reply
      .type(mediaTypeFor(doc.originalFilename))
      .header('content-disposition', inlineContentDisposition(doc.originalFilename))
      // The type comes from the stored filename's extension, not the bytes —
      // tell browsers not to sniff their own idea of the content type.
      .header('x-content-type-options', 'nosniff')
      .send(data);
  });

  app.get('/documents/:id', async (req, reply) => {
    const doc = await loadDocument((req.params as { id: string }).id, req);
    if (!doc) return reply.code(404).send({ message: MSG.documentNotFound });

    const [extracted] = await deps.db
      .select()
      .from(extractedFields)
      .where(eq(extractedFields.documentId, doc.id))
      .orderBy(desc(extractedFields.createdAt))
      .limit(1);
    const [confirmed] = await deps.db
      .select()
      .from(confirmedData)
      .where(eq(confirmedData.documentId, doc.id))
      .orderBy(desc(confirmedData.confirmedAt))
      .limit(1);

    return reply.send({
      ...doc,
      extractedPayload: extracted?.payload ?? null,
      confirmedPayload: confirmed?.payload ?? null,
    });
  });
}
