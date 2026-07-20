import { inArray } from 'drizzle-orm';
import type { Db } from '../app';
import { confirmedData, documents, extractedFields } from '../db/schema';
import type { Storage } from '../storage/index';

/** The transaction handle inside `db.transaction(async (tx) => …)`. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/**
 * FK-safe child cascade for a set of documents: extracted_fields →
 * confirmed_data → documents (leaf children first; the schema has no
 * onDelete cascade, so every level is explicit). Shared by
 * DELETE /tax-years/:id and DELETE /documents/:id so the order is written
 * exactly once (plan 2026-07-17-document-deletion.md).
 *
 * Returns how many confirmed_data rows were removed — the per-document
 * route uses it to decide whether the year's `data_revised_at` must be
 * bumped (a deletion is invisible to the newer-confirmation stale check:
 * removed rows only make the year look LESS recently confirmed).
 */
export async function deleteDocumentRows(
  tx: Tx,
  documentIds: string[],
): Promise<{ confirmedRemoved: number }> {
  if (documentIds.length === 0) return { confirmedRemoved: 0 };
  await tx
    .delete(extractedFields)
    .where(inArray(extractedFields.documentId, documentIds));
  const removedConfirmed = await tx
    .delete(confirmedData)
    .where(inArray(confirmedData.documentId, documentIds))
    .returning({ id: confirmedData.id });
  await tx.delete(documents).where(inArray(documents.id, documentIds));
  return { confirmedRemoved: removedConfirmed.length };
}

/**
 * Best-effort blob cleanup AFTER the transaction commits (filesystem writes
 * can't join it) — a file that already vanished must not fail the
 * (already-committed) delete.
 */
export async function deleteBlobsBestEffort(
  storage: Storage,
  storageKeys: string[],
): Promise<void> {
  await Promise.all(
    storageKeys.map(async (key) => {
      try {
        await storage.delete(key);
      } catch {
        // Tolerate an already-missing file (ENOENT etc.).
      }
    }),
  );
}
