# Document Pipeline Implementation Plan (Plan 3 of 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upload → extract → review-confirm pipeline (spec §5): a `Storage`
interface with a local-disk adapter, multipart `POST` upload, synchronous
extraction via the Claude API (vision + structured output derived from the
shared Zod schemas), `pending → extracted → confirmed | failed` statuses, and
a manual-entry fallback (confirm without extraction). No queue, no auth.

**Architecture:** New shared schemas (`Form867Schema`, `CharityReceiptSchema`)
join `Form106Schema` as the single source of truth. The api gains three
layers: `storage/` (put/get/delete on local disk under `STORAGE_PATH`),
`extraction/` (per-document-kind prompt + **wire schema** + mapper), and
routes (`tax-years`, `documents`). Extraction calls
`client.messages.parse()` on **`claude-opus-4-8`** with
`zodOutputFormat(wireSchema)`; PDFs go as base64 `document` blocks, images as
base64 `image` blocks, placed before the text prompt. Structured outputs
forbid `additionalProperties ≠ false`, so the Form 106 wire schema carries
`boxes` as an array of `{code, amountAgorot}` pairs and the mapper folds it
into the shared record shape, validating with the real schema afterwards —
raw model output lands in `extracted_fields` for audit either way.

**Testing:** unit tests for storage (tmp dir) and extraction (injected fake
Anthropic client + recorded-shape fixtures — no live API in tests);
integration tests for routes against **real Postgres** on
`host.docker.internal` using a dedicated `taxreturns_test` database migrated
programmatically per run (spec §8 says Testcontainers; the sibling-daemon
setup here makes a dedicated database on the running instance the pragmatic
equivalent — the seam is `DATABASE_URL`).

**Spec:** design spec §4, §5, §8, §9; CLAUDE.md build-order "Plan 3".

## Global Constraints

- Money integer agorot; Zod schemas in shared are the single source of truth.
- Extraction failure is a first-class state: `failed` + stored reason, retry
  allowed, manual entry via the same confirm endpoint and schema.
- `confirmed_data` rows are the only engine input; extraction raw output is
  kept forever in `extracted_fields` (append-only, corrections never overwrite).
- API validation errors return Hebrew field-level messages (spec §9).
- `ANTHROPIC_API_KEY` is the only secret; extraction is the only external call.
- TDD per task; root `pnpm test` + `pnpm typecheck` green before each commit.

### Task 1: shared — Form 867 + charity receipt schemas

`Form867Schema`: taxYear, brokerName, optional accountId, and aggregated
annual agorot totals aligned with the engine's `BrokerEntryInput`
(`realGainsAgorot`, `realLossesAgorot`, `interestDividendAgorot`,
`taxWithheldAgorot`, all ≥0 ints) + `uncertainFields` (defaulted `[]`).
`CharityReceiptSchema`: taxYear, institutionName, optional 9-digit
`institutionRegistrationId` + `receiptNumber` + ISO `donationDate`,
`amountAgorot` (positive int), `hasSection46Approval` boolean,
`uncertainFields`. Round-trip + rejection tests, exported from the package
root alongside a `DocumentKind`→schema map (`documentSchemas`).
Commit `feat(shared): form 867 and charity receipt schemas`.

### Task 2: api — Storage interface + local-disk adapter

`Storage` = `put(key, data): Promise<void>`, `get(key): Promise<Buffer>`,
`delete(key): Promise<void>`; `LocalDiskStorage(rootDir)` writes under the
root, creates parents, and rejects path traversal (`..`, absolute keys).
Tests in a tmp dir. Commit `feat(api): storage interface with local disk adapter`.

### Task 3: api — extraction service (Claude vision + structured output)

`src/extraction/`: per-kind config `{wireSchema, toPayload(wire), prompt}` —
prompts name the printed box/field codes (042, 045, 158…), never visual
layout, and instruct amounts→agorot (×100). `extractDocument(client, {kind,
data, mediaType})` builds the content blocks (document for `application/pdf`,
image for png/jpeg/webp, else typed error), calls
`client.messages.parse({model: 'claude-opus-4-8', max_tokens: 16000,
output_config: {format: zodOutputFormat(wireSchema)}})`, maps
`parsed_output` through `toPayload`, and validates with the shared schema.
Returns `{payload, model, raw}`; throws `ExtractionFailedError(reason)` on
refusal/max_tokens/null parse — callers store the reason. Unit tests inject a
fake client (fixture wire payloads; rejection paths). Commit
`feat(api): claude vision extraction service with structured output`.

### Task 4: api — pipeline routes on real Postgres

Routes (all JSON errors `{message}` in Hebrew):
- `POST /tax-years {year}` → creates default user row on first use (phase-1
  single user), unique per year; `GET /tax-years`.
- `POST /tax-years/:id/documents` — multipart (`@fastify/multipart`, 15 MB),
  fields `kind` + file; stores via `Storage` (key
  `<taxYearId>/<uuid>-<filename>`), inserts `documents` row (`pending`).
- `POST /documents/:id/extract` — loads bytes, runs extraction service,
  inserts `extracted_fields`, status→`extracted`; on `ExtractionFailedError`
  status→`failed` + `extraction_error`, 502. Retry = call again.
- `GET /documents/:id` — row + latest extracted + confirmed payloads.
- `POST /documents/:id/confirm {payload}` — validates against the kind's
  shared schema, inserts `confirmed_data`, status→`confirmed`. Legal from
  `pending`/`failed` too — that IS the manual-entry fallback.
`buildApp({db?, storage?, anthropic?})` for injection; server wires real ones
from env. Integration tests: `taxreturns_test` DB created/migrated in test
setup, fake extraction client, full upload→extract→confirm and
upload→confirm(manual) flows + failure path. Commit
`feat(api): document pipeline routes (upload, extract, confirm)`.

### Task 5: verification + docs

Root `pnpm test`/`typecheck` green; update CLAUDE.md current-state table and
build order. Commit `docs: mark document pipeline complete in CLAUDE.md`.
