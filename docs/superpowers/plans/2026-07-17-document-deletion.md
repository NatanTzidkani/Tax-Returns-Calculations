# Per-document deletion — remove a mistaken upload without nuking the year

**Date:** 2026-07-17 · **Status:** complete (2026-07-19)
**Gap:** there is no `DELETE /documents/:id`. `Storage.delete` is only invoked
by the tax-year cascade (`DELETE /tax-years/:id`), so a mistakenly-uploaded
document can only be removed by deleting the entire tax year — with every
other document and calculation snapshot in it. No engine change, no tax-law
constants, no new document fields.

## Design

**One new route, `DELETE /documents/:id` (in `routes/documents.ts`), reusing
the tax-year cascade's own order.** The tax-year delete already does, for its
documents: collect storage keys → transaction: `extracted_fields` →
`confirmed_data` → `documents` (FK-safe leaf-first; no `onDelete` cascade in
the schema) → after commit, best-effort blob delete (an already-missing file
never fails the committed delete). That document-child slice is factored out
of `routes/tax-years.ts` into a shared helper (`src/documents/cascade.ts`:
`deleteDocumentRows(tx, documentIds)` + `deleteBlobsBestEffort(storage,
keys)`) and used by BOTH routes — one cascade order, written once.

**Scoping & guards, in order:**

1. Non-UUID / unknown / **another user's document → 404 Hebrew** (`המסמך לא
   נמצא`), via the same `loadDocument` join on `tax_years.user_id` every
   document-scoped route uses (the join is extended to also return the year,
   which the guard below needs).
2. **Year status `filed` → 409 Hebrew** — source documents of a filed return
   must stay. Rule of record: deletion is blocked in `filed` ONLY; every
   other status (`draft`, `in_review`, `ready_to_file`, `amended`) allows it
   — an amended return is being reworked, so its inputs may legitimately be
   corrected. (The year-level `DELETE /tax-years/:id` predates this rule and
   is out of scope here.)
3. Otherwise: cascade + blob cleanup as above, `204`.

**Calculation snapshots are append-only and are NOT touched.** A snapshot
that consumed the deleted document stays in the audit trail; the `stale`
flag is what must tell the user it no longer matches the confirmed data.

**Stale-flag finding (verified against `routes/calculations.ts`):** the
current check marks a calculation stale only when some `confirmed_data` row
of the year is **newer** than the snapshot (`gt(confirmedAt, createdAt)`).
Deletion REMOVES confirmed rows — no newer row appears, and the year looks
*less* recently confirmed — so today a deletion would leave the snapshot
looking fresh while its inputs changed. **Fix (part of this plan):** new
nullable `tax_years.data_revised_at` column (migration `0003`), set to
`now()` inside the delete transaction **iff confirmed rows were actually
removed** (deleting a never-confirmed document doesn't perturb any
calculation input, so it must not flip staleness). The stale computation
becomes `newerConfirmation OR data_revised_at > snapshot.createdAt`.
Re-confirmations keep working through the existing timestamp comparison;
the column only records "confirmed data was removed".

**Cross-user isolation sweep (pipeline.test.ts):** the existing sweep
enumerates tax-year-scoped routes against an intruder's year; document-scoped
routes have no intruder sweep at all today (`GET /documents/:id/file` is only
covered for unknown UUIDs — cross-user safety rests untested on the
`loadDocument` join). This plan adds a **document-scoped sweep**: an intruder
document inserted under the intruder year, then 404-Hebrew attempts on `GET
/documents/:id`, `GET /documents/:id/file`, `POST /documents/:id/extract`,
`POST /documents/:id/confirm`, and the new `DELETE /documents/:id`, plus an
intact-afterwards assertion. `DELETE /documents/:id` also joins the
"every protected route 401s" list.

**Web:** trash-can delete affordance per document row in the documents panel
(`TaxYearDetail.tsx`), gated by a Radix `AlertDialog` confirm modeled on
`DeleteTaxYearDialog` (new `DeleteDocumentDialog`, row-variant icon trigger at
the row's inline-end, controlled-open so a Hebrew `ApiError` — e.g. the 409
for a filed year — renders inside the dialog). On success it invalidates
`['tax-years', id, 'documents']` (the list), `['tax-years', id,
'confirmed-data']` (the data panel), and `['tax-years', id, 'calculation']`
(the worksheet's stale flag may have just flipped). i18next `deleteDocument.*`
keys; logical properties only; no money handling anywhere in this feature.

## TDD steps

- [x] **API red:** new `test/document-deletion.test.ts` (own test db, style of
      `confirmed-data.test.ts`): 401 unauthenticated; 404 Hebrew for
      non-UUID / unknown UUID; full cascade (extracted+confirmed rows gone,
      blob gone, sibling documents untouched, 204); already-missing blob
      tolerated; 409 Hebrew on a `filed` year with rows+blob intact; deletion
      allowed in every non-filed status; **stale flip** — snapshot fresh →
      delete a confirmed document → `GET /calculation` reports `stale: true`,
      while deleting a never-confirmed document leaves it `false`; the
      confirmed-data projection drops the deleted employer. Plus the
      pipeline.test.ts sweep additions (intruder-document 404s incl. DELETE,
      401 list). Implement: migration `0003` (`data_revised_at`), cascade
      helper factored out of `tax-years.ts`, the route, the stale-check fix.
      Commit `feat(api): DELETE /documents/:id — scoped cascade, filed-year guard, stale-aware`.
- [x] **Web red:** `TaxYearDetail.test.tsx` — each row shows the delete
      button (Hebrew aria-label with the filename); confirm calls
      `deleteDocument(id)` and refetches the documents list + confirmed-data
      panel; cancel calls nothing; a server Hebrew error (409) shows verbatim
      in the open dialog. Implement `deleteDocument` in `api/client.ts`,
      `DeleteDocumentDialog` (+ shared `TrashIcon` extracted from
      `DeleteTaxYearDialog`), panel wiring, i18n keys. Commit
      `feat(web): per-document delete with confirmation in the documents panel`.
- [x] Full root green (`pnpm typecheck`, api+web suites); CLAUDE.md rows +
      this plan marked done. Commit `docs: note per-document deletion in CLAUDE.md`.

## Out of scope

- Bulk delete / undo / a trash state — delete is confirm-gated and final.
- Changing `DELETE /tax-years/:id` semantics (it stays deletable in any
  status; aligning it with the filed-year rule is an owner call).
- Touching calculation snapshots (append-only, audit trail).
- Any engine change (`ENGINE_VERSION` stays `il-0.7.1`).
