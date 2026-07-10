# Document Review Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The last unbuilt piece of Plan 4 (spec §6, screen 3): a document
review screen — source image/PDF next to the extracted-fields form,
uncertain fields highlighted, confirm writes `confirmed_data`. Without this
screen the extract/confirm API routes built in Plan 3 have no UI, so no
document has ever been reviewable end-to-end through the app.

**Architecture:** One new backend route (serve the raw stored file bytes —
nothing today lets the browser display what was uploaded) plus one new
frontend screen per document, reached from a new link on each row of the
tax-year detail's documents list. The review form is **kind-specific**
because the three document schemas don't share a shape: Form 106's `boxes`
is an open `Record<string, number>` (rendered as an editable code/amount
list), Form 867 and the charity receipt are fixed-field forms. All three
read `uncertainBoxes`/`uncertainFields` from the extracted payload to
highlight fields the model wasn't sure about — that array already exists in
every shared schema for exactly this purpose (spec §5).

**Testing:** Backend: integration test on the existing real-Postgres +
tmp-storage pattern in `pipeline.test.ts`. Frontend: component tests mocking
the API client, matching every existing screen's pattern.

## Global Constraints

- Money stays integer agorot end-to-end; render via `formatILS`.
- Box-code labels: only use the meanings already sourced in this codebase's
  own comments (`packages/shared/src/documents/form106.ts`: 158 = gross
  income, 042 = tax withheld, 045 = pension contribution) — fall back to the
  bare code (e.g. "תיבה 093") for anything else. Do not invent a label for a
  box code that isn't already documented in this repo.
- Hebrew RTL, i18next, logical properties only, dark-mode aware — matches
  every existing screen.
- `pnpm test` + `pnpm typecheck` green before every commit.

---

### Task 1: api — serve the raw document file

**Files:** `packages/api/src/routes/documents.ts`, `packages/api/test/pipeline.test.ts`.

`GET /documents/:id/file` — 404 Hebrew for an unknown/malformed id (reuse
`loadDocument`); else `deps.storage.get(doc.storageKey)`, reply with
`Content-Type` from the same `mediaTypeFor()` helper already used by
extraction, `Content-Disposition: inline; filename="<originalFilename>"`
(browser renders inline instead of downloading). No new dependency —
`reply.type(...).send(buffer)` is standard Fastify.

- [ ] Failing test: upload a document, `GET /documents/:id/file` returns
      200, the exact bytes uploaded, and the right `content-type`; 404 for
      an unknown id.
- [ ] Implement; green.
- [ ] Commit `feat(api): serve the raw uploaded document file`.

### Task 2: web — document review screen

**Files:** `packages/web/src/screens/DocumentReview.tsx` (new) + test,
`packages/web/src/router.tsx` (new route, `beforeLoad: requireAuth`),
`packages/web/src/screens/TaxYearDetail.tsx` (link each document row to the
review screen), `packages/web/src/api/client.ts` (already has
`extractDocument`/`confirmDocument`/`getDocument` from Plan 3 — add nothing
unless a gap turns up), `packages/web/src/i18n.ts` (new
`documentReview.*` keys).

**Route:** `/tax-years/$taxYearId/documents/$documentId`.

**Layout:** two panels side by side on wide viewports, stacked on narrow —
left/right must use logical placement (`sm:grid-cols-2` + natural DOM order
is RTL-safe by default; don't force a physical side). One panel is the
source file (`<img>` for image media types, `<embed>`/`<iframe
type="application/pdf">` for PDF, pointed at
`/api/documents/:id/file`)/**zoomable**\* — a simple approach that satisfies
"zoomable" without a new dependency: render the image at natural size inside
a scrollable container with a "zoom in/out" button pair adjusting a CSS
`width` percentage (100%/150%/200%), not a full pan-and-zoom library. The
other panel is the extracted-fields form.

**Form, per `doc.kind`:**
- `form106`: employer name, deductions-file-id, national-id text inputs;
  `boxes` as a repeatable code+amount row list (add/remove rows) seeded
  from the extracted payload's entries; each row highlighted (amber
  border/background) if its code is in `uncertainBoxes`; known codes (158,
  042, 045) show their Hebrew label next to the bare code, others show only
  the code.
- `form867`: broker name, optional account id, four agorot amount inputs
  (gains/losses/interest-dividend/withheld) — inputs take shekel strings,
  convert via `shekelsToAgorot`/`agorot` from `@taxreturns/shared` on
  submit, matching how money is already entered elsewhere (check
  `TaxYearDetail`/`Dashboard` for the existing convention before inventing
  a new one — if none exists yet for money *input* specifically, use plain
  shekel-string inputs converted at submit, never bind a raw float to
  state as agorot).
- `charity_receipt`: institution name, optional registration id, optional
  receipt number, amount, optional donation date, a checkbox for
  `hasSection46Approval`.
- All three: each field highlighted when its name is in `uncertainFields`
  (or, for form106, when its box code is in `uncertainBoxes`).
- Kind `other` has no schema — the review screen for an `other` document
  shows the file viewer only, with a short explanatory note and a link back
  (no form, no confirm — matches the API, which 400s confirm/extract for
  `other`).

**Data flow:**
- Load via `getDocument(documentId)` (already returns
  `{...doc, extractedPayload, confirmedPayload}`).
- `pending` status: show an "extract" button (`extractDocument`) OR a
  "enter manually" link that opens the same form empty (manual-entry
  fallback — confirm is legal from `pending` per the API).
- `extracted` status: form pre-filled from `extractedPayload`, uncertain
  fields highlighted, confirm button (`confirmDocument`) submits the
  (possibly-edited) form values validated against the shared Zod schema
  client-side before sending (reuse `documentSchemas[kind]` from
  `@taxreturns/shared` — do not hand-roll validation).
- `failed` status: show `extractionError` in an alert, offer retry-extract
  and manual-entry, same as `pending` otherwise.
- `confirmed` status: form pre-filled from `confirmedPayload`, read-only
  summary view (still allow re-confirming with edits — the API supports
  confirming from any status — but default to a "review" not "edit" framing
  since it's already confirmed).
- On successful confirm: invalidate the tax-year's documents list query,
  navigate back to `/tax-years/$taxYearId`.

**Tests:** component tests per state (pending/extracted/failed/confirmed)
per at least one document kind end-to-end, plus one test per kind
confirming the schema-shaped payload sent to `confirmDocument` matches what
was typed in (this is the load-bearing correctness check — a UI that
silently sends the wrong shape is a real bug, not a style nit), plus a test
that uncertain fields render with the highlighted treatment. Update
`TaxYearDetail.test.tsx` for the new per-row link.

- [ ] Failing tests first (TDD, as always in this repo).
- [ ] Implement; green.
- [ ] Commit `feat(web): document review screen`.

### Task 3: independent review

Run the **reviewer** agent (`.claude/agents/reviewer.md`) — this screen is
where user-entered corrections become `confirmed_data`, the tax engine's
only input (CLAUDE.md's own non-negotiable rule), so the client-side→server
validation path and the money-conversion correctness deserve real scrutiny,
not just a glance.

### Task 4: verification

Root `pnpm test` + `pnpm typecheck` green. Update CLAUDE.md: Plan 4 is now
fully done — remove the "Document review screen not yet built" caveat.
