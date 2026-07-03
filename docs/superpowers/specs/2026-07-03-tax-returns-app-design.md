# Tax Returns App — Design Spec

**Date:** 2026-07-03
**Status:** Approved design, pre-implementation
**Owner:** Matan (matan1t@gmail.com)

## 1. Purpose & Scope

A web application for preparing and tracking Israeli personal income-tax returns
(דוח שנתי). The user uploads source documents — Form 106 (salary), Form 867
(broker capital gains/losses), charity receipts (סעיף 46), and other supporting
documents — and the app:

1. Extracts the data via AI (with mandatory human review),
2. Calculates the expected refund/liability with a fully auditable worksheet,
3. Produces a Form 1301 field map for transcription into the Tax Authority's
   filing system,
4. Tracks filing status, deadlines, and amendments across tax years,
   including capital-loss carry-forward between years.

**Phase 1 user:** the owner only, running locally. **Future (explicitly designed
for, not built now):** multi-user public offering; additional jurisdictions
beyond Israel.

**Out of scope for phase 1:** authentication, direct e-filing integration with
the Tax Authority, job queues, cloud deployment, English UI (i18n plumbing is
in, translation is not).

## 2. Architecture Overview

pnpm TypeScript monorepo. One language end-to-end; shared types flow from the
tax engine through the API to the UI.

```
taxreturns/
├── packages/
│   ├── tax-engine/        # Pure TS. No I/O, no web, no DB.
│   ├── shared/            # Zod schemas + types (single source of truth)
│   ├── api/               # Fastify server
│   └── web/               # React (Vite), Hebrew RTL
├── infra/
│   ├── docker-compose.yml # app runtime: db, api, web
│   └── dev/               # Ubuntu dev container (with Claude Code)
└── docs/
```

**Data flow:**
Upload PDF → API stores file → Claude API extracts fields → review screen
(user confirms/corrects) → confirmed data persisted → tax-engine
`calculate(year, inputs)` → result: refund/liability + Form 1301 field map.

**Key decisions:**

- **Postgres** for structured data. Local via Compose; portable to any managed
  Postgres later.
- **Files on local disk behind a `Storage` interface** (`put/get/delete`).
  S3-compatible adapter later is ~50 lines. No MinIO in phase 1.
- **No auth in phase 1**, but every table carries `user_id` from day one so
  multi-user is a migration, not a redesign.
- **All monetary amounts are integer agorot** internally; `decimal.js` at
  boundaries where fractional intermediate values arise. Never binary floats.
- **The Anthropic API key is the only secret.** Extraction calls are the only
  data that leaves the machine.

## 3. Tax Engine (`packages/tax-engine`)

A pure function: `calculate(input: TaxYearInput) → TaxReturnResult`.
Deterministic, no I/O, exhaustively testable.

```
tax-engine/
├── core/
│   ├── types.ts           # TaxYearInput, TaxReturnResult, RuleSet interface
│   └── money.ts           # agorot arithmetic, rounding rules
└── jurisdictions/il/
    ├── index.ts           # selects year module
    ├── 2024.ts, 2025.ts…  # year data ONLY: brackets, credit-point value,
    │                      #   ceilings — each constant annotated with its
    │                      #   official source URL
    └── modules/           # rule logic, parameterized by year data
        ├── income-tax.ts        # brackets → marginal tax
        ├── credit-points.ts     # נקודות זיכוי (residency, gender, children…)
        ├── charity.ts           # סעיף 46: 35% credit, floor/ceiling per year
        ├── capital-gains.ts     # 25% real gain; loss offsetting; carry-forward
        ├── pension.ts           # ס' 45א, 47 deductions & credits
        └── national-insurance.ts # ביטוח לאומי reconciliation (informational)
```

**Principles:**

- **Year data and rule logic are separated.** New tax year ≈ new data file;
  legal change ≈ one logic module; new country = new folder implementing the
  `RuleSet` interface.
- **Capital gains handles real cases:** aggregating multiple 867s across
  brokers, offsetting realized losses against gains (and against
  dividend/interest income where the law allows), carry-forward of unused
  losses to future years.
- **Every intermediate value is exposed** in `TaxReturnResult` — the UI renders
  the full worksheet. No black-box bottom line.
- **Output includes `form1301Fields`**: map of official field code → value.
- **Verification duty:** Claude drafts the Israeli rules; the owner MUST verify
  each year-data file against official Tax Authority publications before
  relying on results. The per-constant source-URL annotation exists to make
  this check fast.

## 4. Data Model (Postgres, Drizzle ORM)

Zod schemas in `packages/shared` are the single source of truth; DB schema,
API validation, and UI forms derive from them.

| Table | Purpose | Key columns |
|---|---|---|
| `users` | one row in phase 1 | id, email, created_at |
| `tax_years` | one return per year | user_id, year, status (`draft → in_review → ready_to_file → filed → amended`), filed_at, deadline, notes |
| `documents` | uploaded files | tax_year_id, kind (`form106 \| form867 \| charity_receipt \| other`), storage_key, original_filename, extraction_status (`pending → extracted → confirmed \| failed`) |
| `extracted_fields` | raw AI output, kept forever for audit | document_id, payload JSONB, model, confidence |
| `confirmed_data` | what the user approved; the ONLY input to the engine | document_id, payload JSONB, confirmed_at |
| `calculations` | immutable snapshots | tax_year_id, engine_version, input JSONB, result JSONB |
| `loss_carryforward` | capital-loss state crossing year boundaries | user_id, from_year, amount, kind, consumed_by_year |

**Rationale:**

- Extraction vs. confirmation are separate rows — corrections never overwrite
  the model's raw output; the audit trail is permanent.
- Calculations are append-only with engine version stamped, so "why did my
  refund change?" is always answerable by diffing snapshots.
- JSONB payloads typed by Zod at the boundary — document kinds vary too much
  for fixed columns.

## 5. Document Pipeline

1. **Upload** — `POST /documents` (multipart) → stored via `Storage`,
   `extraction_status: pending`.
2. **Extract** — API calls Claude API (vision) with a per-document-kind prompt
   and the Zod schema supplied as a structured-output/tool definition.
   Form 106 prompts map the printed box codes (042, 045, …), not visual
   layout. Success → `extracted_fields` row. Failure → `failed` + stored
   reason; retry or manual entry.
3. **Review** — UI shows document image side-by-side with extracted fields.
   Model flags low-confidence fields; these render highlighted. User
   confirms/corrects → `confirmed_data` row.
4. **Calculate** — any confirmed change marks the tax year stale; the user
   explicitly triggers recalculation → new `calculations` snapshot.

**Decisions:** synchronous extraction (no queue — single user, seconds per
document; pipeline stages are separated so adding a queue later is bounded).
Failure is a first-class state with a manual-entry fallback using the same
schema — a bad scan never blocks the return. Privacy: extraction is the single
external data flow; manual entry keeps the app fully offline if desired.

## 6. Frontend (`packages/web`)

React 18 + Vite + TypeScript, TanStack Router + Query, Tailwind CSS,
react-i18next (Hebrew default), Radix UI headless primitives.

**Screens:**

1. **Dashboard** — tax years overview: status chips, deadlines, refund
   estimate per year.
2. **Tax year detail** — documents panel (uploads + extraction status), data
   panel (confirmed values grouped: שכר, תרומות, שוק ההון, פנסיה),
   calculation panel (full expandable worksheet).
3. **Document review** — zoomable document image ⇄ extracted-fields form,
   uncertain fields highlighted.
4. **Filing view** — Form 1301 field map formatted for transcription;
   "mark as filed" transition.

**Rules:** RTL-first (`dir="rtl"` at root, CSS logical properties only —
`ms-`/`me-`, never `ml-`/`mr-`); every string through i18next from the first
commit; official Tax Authority terminology and box codes as labels;
`Intl.NumberFormat('he-IL')` for numbers/currency. The worksheet traces every
number to its source document, rule, and year-constant.

## 7. Docker Environments

### 7a. Dev container (`infra/dev/` + `.devcontainer/`)

Ubuntu 24.04 image containing: Node 22 + pnpm, git, gh, ripgrep, jq,
build-essential, Docker CLI (host socket mount), psql client, and
**Claude Code** (`@anthropic-ai/claude-code`).

- `~/.claude` is a named volume; `postCreate.sh` installs the plugin set
  (superpowers, …) so rebuilds come back fully equipped.
- API key / login passed via env or mount — never baked into the image.
- Usable via VS Code "Reopen in Container" or `docker exec -it taxdev bash`.
- The repo is a bind mount from the host disk.

### 7b. App runtime (`infra/docker-compose.yml`)

- `db`: postgres:17, named volume, bound to localhost.
- `api`: dev = tsx watch; prod target = node dist.
- `web`: dev = vite; prod target = nginx static.
- One git-ignored `.env` (`DATABASE_URL`, `ANTHROPIC_API_KEY`, `STORAGE_PATH`);
  `.env.example` committed.
- Documents in a named volume; a `backup` script produces dated archives
  (`pg_dump` + tar of the documents volume).
- Cloud path: same images on any container host + managed Postgres +
  S3-compatible storage via the `Storage` adapter.

## 8. Testing Strategy

- **tax-engine (strict TDD, ~95% branch-coverage CI gate):**
  unit tests per rule module against official tables; golden-file tests of
  full scenarios with known-correct outcomes (starting from the owner's past
  returns); property tests for invariants (refund ≤ tax withheld; marginal
  rate monotonic in income).
- **shared:** Zod schema round-trip tests.
- **api:** integration tests against real Postgres (Testcontainers); Claude
  API mocked with recorded extraction fixtures.
- **web:** component tests for the review screen and worksheet only; no e2e
  suite in phase 1.
- Runner: Vitest across all packages; `pnpm test` at the root; GitHub Actions
  once a remote exists.

## 9. Error Handling

1. **Engine fails loudly.** Unknown year, missing input, out-of-range value →
   typed error naming exactly what's wrong. The engine never silently
   defaults a number.
2. **Pipeline degrades gracefully.** Extraction failures are visible states
   with manual-entry fallback; API validation returns Hebrew field-level
   messages mapped onto UI forms.
3. **User input is never lost.** Review edits autosave as drafts;
   confirmations are transactional; calculations are append-only.

## 10. Build Order (high level — detailed plan follows separately)

1. Monorepo scaffolding + dev container + app compose skeleton
2. `shared` schemas + DB migrations
3. `tax-engine` core + IL income-tax/credit-points modules (TDD)
4. API: documents upload/storage + extraction pipeline
5. Web: review screen + worksheet
6. Remaining engine modules (charity, capital gains + carry-forward, pension)
7. Filing view + year status tracking + backup script
