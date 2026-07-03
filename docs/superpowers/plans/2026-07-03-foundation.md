# Foundation Implementation Plan (Plan 1 of 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the working skeleton of the tax-returns app: pnpm monorepo, shared money/document schemas, Postgres with migrated tables, a Fastify API answering `/health`, a Hebrew-RTL React shell, the Docker Compose runtime, and the Ubuntu dev container with Claude Code.

**Architecture:** pnpm TypeScript monorepo (`packages/shared`, `packages/api`, `packages/web`; `packages/tax-engine` comes in Plan 2). Zod schemas in `shared` are the single source of truth. Postgres via Docker Compose, schema managed by Drizzle. Development happens inside an Ubuntu 24.04 dev container that includes Claude Code.

**Tech Stack:** Node 22, pnpm 10, TypeScript 5 (strict), Zod 4, Fastify 5, Drizzle ORM + drizzle-kit, pg, React 18 + Vite 6, react-i18next, Vitest 3, Postgres 17, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-07-03-tax-returns-app-design.md` (sections 2, 4, 6, 7). This plan covers spec build-order items 1-2 plus the api/web skeletons those items need. NOT in this plan: tax-engine rules (Plan 2), extraction pipeline (Plan 3), real UI screens/Tailwind (Plan 4), filing view + backup script (Plan 5).

## Global Constraints

- All monetary amounts are **integer agorot** — never binary floats (spec §2).
- Every table carries `user_id` directly or reaches it via its parent chain (spec §2).
- Web UI: `lang="he" dir="rtl"` at the root; **every** user-visible string goes through i18next; CSS logical properties only (`ms-`/`me-`, never `ml-`/`mr-`) (spec §6).
- TypeScript `strict: true` everywhere; packages are ESM (`"type": "module"`).
- Test runner is Vitest in every package; root `pnpm test` must pass after every task.
- Secrets only via `.env` (git-ignored); `.env.example` is committed (spec §7b).
- Commands below are for PowerShell on the Windows host (works identically in bash unless noted).

---

### Task 1: Monorepo scaffolding

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `.env.example`, `README.md`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: workspace root all later tasks install into; `tsconfig.base.json` that every package extends; root scripts `pnpm test` / `pnpm typecheck` that recurse into packages (`pnpm -r`).

- [ ] **Step 1: Create root config files**

`package.json`:

```json
{
  "name": "taxreturns",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "packageManager": "pnpm@10.12.1",
  "scripts": {
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck"
  }
}
```

`pnpm-workspace.yaml`:

```yaml
packages:
  - packages/*
```

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  }
}
```

`.gitignore`:

```
node_modules/
dist/
coverage/
.env
data/
*.tsbuildinfo
```

`.env.example`:

```
DATABASE_URL=postgresql://tax:tax@localhost:5432/taxreturns
ANTHROPIC_API_KEY=
STORAGE_PATH=./data/documents
```

`README.md`:

```markdown
# TaxReturns

Israeli personal tax-return assistant. See
`docs/superpowers/specs/2026-07-03-tax-returns-app-design.md`.

## Quick start

1. `cp .env.example .env` and fill in `ANTHROPIC_API_KEY`.
2. `docker compose -f infra/docker-compose.yml up -d db`
3. `pnpm install`
4. `pnpm --filter @taxreturns/api db:migrate`
5. `pnpm --filter @taxreturns/api dev` and `pnpm --filter @taxreturns/web dev`

Development is intended to happen inside the dev container (`.devcontainer/`),
which ships Node 22, pnpm, and Claude Code.
```

- [ ] **Step 2: Verify pnpm accepts the workspace**

Run: `pnpm install`
Expected: exits 0, creates `pnpm-lock.yaml` (no packages yet — that's fine).

- [ ] **Step 3: Commit**

```powershell
git add -A; git commit -m "chore: scaffold pnpm monorepo"
```

---

### Task 2: `shared` package — money module (integer agorot)

**Files:**
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/src/money.ts`, `packages/shared/src/index.ts`
- Test: `packages/shared/test/money.test.ts`

**Interfaces:**
- Consumes: `tsconfig.base.json` from Task 1.
- Produces: `type Agorot` (branded `number`); `agorot(value: number): Agorot` (throws `TypeError` on non-safe-integer); `addAgorot(...values: Agorot[]): Agorot`; `shekelsToAgorot(shekels: number): Agorot`; `formatILS(value: Agorot): string`. All exported from `@taxreturns/shared`.

- [ ] **Step 1: Create the package skeleton**

`packages/shared/package.json`:

```json
{
  "name": "@taxreturns/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

`packages/shared/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "test"]
}
```

Run: `pnpm install`

- [ ] **Step 2: Write the failing test**

`packages/shared/test/money.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { addAgorot, agorot, formatILS, shekelsToAgorot } from '../src/money';

describe('agorot', () => {
  it('accepts safe integers', () => {
    expect(agorot(12345)).toBe(12345);
    expect(agorot(0)).toBe(0);
    expect(agorot(-5000)).toBe(-5000); // losses are negative amounts
  });

  it('rejects non-integers', () => {
    expect(() => agorot(1.5)).toThrow(TypeError);
  });

  it('rejects NaN and Infinity', () => {
    expect(() => agorot(Number.NaN)).toThrow(TypeError);
    expect(() => agorot(Number.POSITIVE_INFINITY)).toThrow(TypeError);
  });

  it('rejects unsafe integers', () => {
    expect(() => agorot(Number.MAX_SAFE_INTEGER + 1)).toThrow(TypeError);
  });
});

describe('shekelsToAgorot', () => {
  it('converts whole shekels', () => {
    expect(shekelsToAgorot(150)).toBe(15000);
  });

  it('converts fractional shekels without float drift', () => {
    expect(shekelsToAgorot(0.1 + 0.2)).toBe(30); // 0.30000000000000004 -> 30
  });
});

describe('addAgorot', () => {
  it('sums amounts', () => {
    expect(addAgorot(agorot(100), agorot(250), agorot(-50))).toBe(300);
  });

  it('returns 0 for no arguments', () => {
    expect(addAgorot()).toBe(0);
  });
});

describe('formatILS', () => {
  it('formats agorot as shekels in he-IL currency format', () => {
    const formatted = formatILS(agorot(1234500));
    expect(formatted).toContain('12,345');
    expect(formatted).toContain('₪');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @taxreturns/shared test`
Expected: FAIL — cannot resolve `../src/money`.

- [ ] **Step 4: Write the implementation**

`packages/shared/src/money.ts`:

```ts
/** Integer agorot (1/100 ILS). Branded so plain numbers can't sneak in. */
export type Agorot = number & { readonly __brand: 'Agorot' };

export function agorot(value: number): Agorot {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`Agorot must be a safe integer, got: ${value}`);
  }
  return value as Agorot;
}

/** Convert a shekel amount (possibly fractional) to integer agorot. */
export function shekelsToAgorot(shekels: number): Agorot {
  return agorot(Math.round(shekels * 100));
}

export function addAgorot(...values: Agorot[]): Agorot {
  return agorot(values.reduce<number>((sum, v) => sum + v, 0));
}

const ilsFormatter = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
});

export function formatILS(value: Agorot): string {
  return ilsFormatter.format(value / 100);
}
```

`packages/shared/src/index.ts`:

```ts
export * from './money';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @taxreturns/shared test`
Expected: PASS (4 describe blocks, all green).

- [ ] **Step 6: Commit**

```powershell
git add packages/shared pnpm-lock.yaml; git commit -m "feat(shared): money module with branded integer agorot"
```

---

### Task 3: `shared` package — Form 106 schema

**Files:**
- Create: `packages/shared/src/documents/form106.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/test/form106.test.ts`

**Interfaces:**
- Consumes: nothing new (standalone Zod schema).
- Produces: `Form106Schema` (Zod object) and `type Form106 = z.infer<typeof Form106Schema>`, exported from `@taxreturns/shared`. Shape: `{ taxYear: number; employerName: string; employerDeductionsFileId: string; employeeNationalId: string; boxes: Record<string, number>; uncertainBoxes: string[] }`. Box keys are 3-digit Form 106 codes (e.g. `"042"`); box values are **agorot integers**. Plan 3's extraction pipeline hands this schema to the Claude API as the structured-output definition; Plan 2's engine consumes `Form106` values.

- [ ] **Step 1: Write the failing test**

`packages/shared/test/form106.test.ts`:

```ts
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

  it('round-trips through JSON', () => {
    const parsed = Form106Schema.parse(valid);
    expect(Form106Schema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @taxreturns/shared test`
Expected: FAIL — cannot resolve `../src/documents/form106`.

- [ ] **Step 3: Write the implementation**

`packages/shared/src/documents/form106.ts`:

```ts
import { z } from 'zod';

const boxCode = z.string().regex(/^\d{3}$/, 'Form 106 box codes are 3 digits');
const agorotAmount = z.number().int('amounts are integer agorot');

/**
 * Form 106 (annual employer salary summary).
 * Box keys are the printed numeric codes (042 = income tax withheld,
 * 158 = gross income, 045 = employee pension contributions, ...).
 * All amounts are integer agorot.
 */
export const Form106Schema = z.object({
  taxYear: z.number().int().min(2020).max(2100),
  employerName: z.string().min(1),
  /** תיק ניכויים — employer deductions file number, 9 digits */
  employerDeductionsFileId: z.string().regex(/^\d{9}$/),
  /** תעודת זהות — employee national ID, 9 digits (leading zeros kept) */
  employeeNationalId: z.string().regex(/^\d{9}$/),
  boxes: z.record(boxCode, agorotAmount),
  /** Box codes the extractor was unsure about; highlighted in review UI */
  uncertainBoxes: z.array(boxCode).default([]),
});

export type Form106 = z.infer<typeof Form106Schema>;
```

Update `packages/shared/src/index.ts` to:

```ts
export * from './money';
export * from './documents/form106';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @taxreturns/shared test`
Expected: PASS (money + form106 suites).

- [ ] **Step 5: Commit**

```powershell
git add packages/shared; git commit -m "feat(shared): Form 106 Zod schema"
```

---

### Task 4: `api` package — Fastify skeleton with `/health`

**Files:**
- Create: `packages/api/package.json`, `packages/api/tsconfig.json`, `packages/api/src/app.ts`, `packages/api/src/server.ts`
- Test: `packages/api/test/health.test.ts`

**Interfaces:**
- Consumes: `@taxreturns/shared` (workspace dep, used from Plan 3 onward).
- Produces: `buildApp(): FastifyInstance` from `src/app.ts` — every future route plugs into this and every API test uses `buildApp().inject(...)`. `src/server.ts` reads `PORT` (default `3000`) and `HOST` (default `127.0.0.1`) from env and starts the app; `pnpm --filter @taxreturns/api dev` runs it with hot reload.

- [ ] **Step 1: Create the package skeleton**

`packages/api/package.json`:

```json
{
  "name": "@taxreturns/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate"
  },
  "dependencies": {
    "@taxreturns/shared": "workspace:*",
    "dotenv": "^16.4.0",
    "drizzle-orm": "^0.44.0",
    "fastify": "^5.0.0",
    "pg": "^8.13.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/pg": "^8.11.0",
    "drizzle-kit": "^0.31.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

`packages/api/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["node"]
  },
  "include": ["src", "test", "drizzle.config.ts"]
}
```

Run: `pnpm install`

- [ ] **Step 2: Write the failing test**

`packages/api/test/health.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';

describe('GET /health', () => {
  it('returns status ok', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
    await app.close();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @taxreturns/api test`
Expected: FAIL — cannot resolve `../src/app`.

- [ ] **Step 4: Write the implementation**

`packages/api/src/app.ts`:

```ts
import Fastify, { type FastifyInstance } from 'fastify';

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });

  app.get('/health', async () => ({ status: 'ok' }));

  return app;
}
```

`packages/api/src/server.ts`:

```ts
import 'dotenv/config';
import { buildApp } from './app';

const app = buildApp();
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '127.0.0.1';

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @taxreturns/api test`
Expected: PASS.

- [ ] **Step 6: Verify the dev server boots**

Run: `pnpm --filter @taxreturns/api dev` (background), then `curl http://127.0.0.1:3000/health`
Expected: `{"status":"ok"}`. Stop the dev server.

- [ ] **Step 7: Commit**

```powershell
git add packages/api pnpm-lock.yaml; git commit -m "feat(api): fastify skeleton with /health"
```

---

### Task 5: Postgres (Compose) + Drizzle schema + first migration

**Files:**
- Create: `infra/docker-compose.yml`, `packages/api/drizzle.config.ts`, `packages/api/src/db/schema.ts`, `packages/api/src/db/client.ts`
- Generated: `packages/api/drizzle/` (migration SQL — commit it)

**Interfaces:**
- Consumes: api package from Task 4; `.env` values from Task 1's `.env.example`.
- Produces: running `db` Compose service (`postgresql://tax:tax@localhost:5432/taxreturns`); Drizzle tables `users`, `taxYears`, `documents`, `extractedFields`, `confirmedData`, `calculations`, `lossCarryforward` exported from `src/db/schema.ts`; `getDb(): NodePgDatabase` from `src/db/client.ts`; scripts `db:generate` / `db:migrate`.

- [ ] **Step 1: Create the Compose file with the db service**

`infra/docker-compose.yml`:

```yaml
services:
  db:
    image: postgres:17
    environment:
      POSTGRES_USER: tax
      POSTGRES_PASSWORD: tax
      POSTGRES_DB: taxreturns
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U tax -d taxreturns"]
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  db-data:
```

Run: `docker compose -f infra/docker-compose.yml up -d db`
Expected: `db` container healthy (`docker compose -f infra/docker-compose.yml ps` shows `healthy`).

- [ ] **Step 2: Write the Drizzle schema**

`packages/api/src/db/schema.ts`:

```ts
import {
  bigint,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

export const taxYearStatus = pgEnum('tax_year_status', [
  'draft',
  'in_review',
  'ready_to_file',
  'filed',
  'amended',
]);

export const documentKind = pgEnum('document_kind', [
  'form106',
  'form867',
  'charity_receipt',
  'other',
]);

export const extractionStatus = pgEnum('extraction_status', [
  'pending',
  'extracted',
  'confirmed',
  'failed',
]);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const taxYears = pgTable(
  'tax_years',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id),
    year: integer('year').notNull(),
    status: taxYearStatus('status').notNull().default('draft'),
    filedAt: timestamp('filed_at', { withTimezone: true }),
    deadline: timestamp('deadline', { withTimezone: true }),
    notes: text('notes'),
  },
  (t) => [unique().on(t.userId, t.year)],
);

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  taxYearId: uuid('tax_year_id').notNull().references(() => taxYears.id),
  kind: documentKind('kind').notNull(),
  storageKey: text('storage_key').notNull(),
  originalFilename: text('original_filename').notNull(),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  extractionStatus: extractionStatus('extraction_status').notNull().default('pending'),
  extractionError: text('extraction_error'),
});

export const extractedFields = pgTable('extracted_fields', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').notNull().references(() => documents.id),
  payload: jsonb('payload').notNull(),
  model: text('model').notNull(),
  confidence: real('confidence'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const confirmedData = pgTable('confirmed_data', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').notNull().references(() => documents.id),
  payload: jsonb('payload').notNull(),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }).notNull().defaultNow(),
});

export const calculations = pgTable('calculations', {
  id: uuid('id').primaryKey().defaultRandom(),
  taxYearId: uuid('tax_year_id').notNull().references(() => taxYears.id),
  engineVersion: text('engine_version').notNull(),
  input: jsonb('input').notNull(),
  result: jsonb('result').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const lossCarryforward = pgTable('loss_carryforward', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  fromYear: integer('from_year').notNull(),
  /** integer agorot; bigint because losses can exceed int4 range */
  amountAgorot: bigint('amount_agorot', { mode: 'number' }).notNull(),
  kind: text('kind').notNull(),
  consumedByYear: integer('consumed_by_year'),
});
```

`packages/api/src/db/client.ts`:

```ts
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

let db: NodePgDatabase<typeof schema> | undefined;

export function getDb(): NodePgDatabase<typeof schema> {
  if (!db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    db = drizzle(new pg.Pool({ connectionString: url }), { schema });
  }
  return db;
}
```

`packages/api/drizzle.config.ts`:

```ts
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

Also create `packages/api/.env` (git-ignored) — copy the `DATABASE_URL` line
from `.env.example` so drizzle-kit finds it when run from the package dir.

- [ ] **Step 3: Generate and apply the migration**

Run:
```powershell
pnpm --filter @taxreturns/api db:generate
pnpm --filter @taxreturns/api db:migrate
```
Expected: `db:generate` writes SQL under `packages/api/drizzle/`; `db:migrate` exits 0.

- [ ] **Step 4: Verify the tables exist**

Run: `docker compose -f infra/docker-compose.yml exec db psql -U tax -d taxreturns -c "\dt"`
Expected: lists `users`, `tax_years`, `documents`, `extracted_fields`, `confirmed_data`, `calculations`, `loss_carryforward` (plus drizzle's migrations table).

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @taxreturns/api typecheck`
Expected: exits 0.

- [ ] **Step 6: Commit**

```powershell
git add infra packages/api pnpm-lock.yaml; git commit -m "feat(api): postgres compose service, drizzle schema, first migration"
```

---

### Task 6: `web` package — Hebrew RTL React shell with i18n

**Files:**
- Create: `packages/web/package.json`, `packages/web/tsconfig.json`, `packages/web/vite.config.ts`, `packages/web/index.html`, `packages/web/src/main.tsx`, `packages/web/src/App.tsx`, `packages/web/src/i18n.ts`
- Test: `packages/web/src/App.test.tsx`

**Interfaces:**
- Consumes: `@taxreturns/shared` (workspace dep, used by real screens in Plan 4).
- Produces: `pnpm --filter @taxreturns/web dev` serving the shell at `:5173`; `src/i18n.ts` initializing i18next with `he` resources — all future strings are added to its `resources.he.translation` tree; `App` component the router mounts into in Plan 4.

- [ ] **Step 1: Create the package skeleton**

`packages/web/package.json`:

```json
{
  "name": "@taxreturns/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@taxreturns/shared": "workspace:*",
    "i18next": "^24.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-i18next": "^15.0.0"
  },
  "devDependencies": {
    "@testing-library/react": "^16.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^25.0.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

`packages/web/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src"]
}
```

`packages/web/vite.config.ts`:

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
  },
});
```

`packages/web/index.html`:

```html
<!doctype html>
<html lang="he" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>דוח שנתי</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Run: `pnpm install`

- [ ] **Step 2: Write the failing test**

`packages/web/src/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import './i18n';
import App from './App';

describe('App', () => {
  it('renders the dashboard heading in Hebrew', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'שנות מס' })).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @taxreturns/web test`
Expected: FAIL — cannot resolve `./i18n` / `./App`.

- [ ] **Step 4: Write the implementation**

`packages/web/src/i18n.ts`:

```ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

export const resources = {
  he: {
    translation: {
      dashboard: {
        title: 'שנות מס',
      },
    },
  },
} as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: 'he',
  fallbackLng: 'he',
  interpolation: { escapeValue: false },
});

export default i18n;
```

`packages/web/src/App.tsx`:

```tsx
import { useTranslation } from 'react-i18next';

export default function App() {
  const { t } = useTranslation();
  return (
    <main>
      <h1>{t('dashboard.title')}</h1>
    </main>
  );
}
```

`packages/web/src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @taxreturns/web test`
Expected: PASS.

- [ ] **Step 6: Verify the dev server renders RTL**

Run: `pnpm --filter @taxreturns/web dev` (background), open `http://127.0.0.1:5173`.
Expected: page shows «שנות מס» right-aligned (RTL). Stop the server.

- [ ] **Step 7: Commit**

```powershell
git add packages/web pnpm-lock.yaml; git commit -m "feat(web): hebrew RTL react shell with i18n"
```

---

### Task 7: Compose services for api and web (dev mode)

**Files:**
- Modify: `infra/docker-compose.yml` (add `api`, `web` services)

**Interfaces:**
- Consumes: `db` service (Task 5), api dev script (Task 4), web dev script (Task 6).
- Produces: `docker compose -f infra/docker-compose.yml up -d` brings up the full stack: db on `:5432`, api on `:3000`, web on `:5173`, all bound to localhost only.

- [ ] **Step 1: Add api and web services**

Add to `infra/docker-compose.yml` under `services:` (keep the existing `db` block):

```yaml
  api:
    image: node:22-bookworm
    working_dir: /app
    command: sh -c "corepack enable && pnpm install && pnpm --filter @taxreturns/api dev"
    environment:
      DATABASE_URL: postgresql://tax:tax@db:5432/taxreturns
      PORT: "3000"
      HOST: 0.0.0.0
    ports:
      - "127.0.0.1:3000:3000"
    volumes:
      - ..:/app
      - api-node-modules:/app/node_modules
    depends_on:
      db:
        condition: service_healthy

  web:
    image: node:22-bookworm
    working_dir: /app
    command: sh -c "corepack enable && pnpm install && pnpm --filter @taxreturns/web dev -- --host 0.0.0.0"
    ports:
      - "127.0.0.1:5173:5173"
    volumes:
      - ..:/app
      - web-node-modules:/app/node_modules
```

And add to the `volumes:` block:

```yaml
  api-node-modules:
  web-node-modules:
```

The named `*-node-modules` volumes shadow the repo's root `node_modules` inside
each container so Linux-built dependencies never collide with ones installed
from the Windows host. Each service runs its own `pnpm install` on start
(first boot is slow; later boots hit the store cache in the volume).

- [ ] **Step 2: Bring up the full stack and verify**

Run:
```powershell
docker compose -f infra/docker-compose.yml up -d
# wait for first pnpm install to finish:
docker compose -f infra/docker-compose.yml logs -f api   # until "Server listening"
curl http://127.0.0.1:3000/health
curl -s http://127.0.0.1:5173 | Select-String 'dir="rtl"'
```
Expected: health returns `{"status":"ok"}`; web HTML contains `dir="rtl"`.

- [ ] **Step 3: Commit**

```powershell
git add infra/docker-compose.yml; git commit -m "feat(infra): compose services for api and web dev mode"
```

---

### Task 8: Ubuntu dev container with Claude Code

**Files:**
- Create: `infra/dev/Dockerfile`, `infra/dev/postCreate.sh`, `.devcontainer/devcontainer.json`

**Interfaces:**
- Consumes: the workspace (bind-mounted into the container).
- Produces: a dev container usable via VS Code "Reopen in Container" or `docker exec`; inside it: Node 22, pnpm, git, gh, ripgrep, jq, psql, Docker CLI (host socket), and Claude Code with plugins persisted in the `taxreturns-claude-config` volume.

- [ ] **Step 1: Write the Dockerfile**

`infra/dev/Dockerfile`:

```dockerfile
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential ca-certificates curl git gnupg jq \
    openssh-client postgresql-client ripgrep sudo unzip \
 && rm -rf /var/lib/apt/lists/*

# Node 22 (NodeSource)
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
 && apt-get install -y nodejs \
 && rm -rf /var/lib/apt/lists/*

# GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
 && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
      > /etc/apt/sources.list.d/github-cli.list \
 && apt-get update && apt-get install -y gh \
 && rm -rf /var/lib/apt/lists/*

# Docker CLI + compose plugin (daemon comes from the host socket mount)
RUN install -m 0755 -d /etc/apt/keyrings \
 && curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc \
 && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu noble stable" \
      > /etc/apt/sources.list.d/docker.list \
 && apt-get update && apt-get install -y docker-ce-cli docker-compose-plugin \
 && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm @anthropic-ai/claude-code

# ubuntu:24.04 ships user "ubuntu" (uid 1000); give it passwordless sudo
RUN echo "ubuntu ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/ubuntu

USER ubuntu
WORKDIR /workspaces/taxreturns
```

- [ ] **Step 2: Write postCreate.sh and devcontainer.json**

`infra/dev/postCreate.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# the named volume mounts root-owned on first run
sudo chown -R ubuntu:ubuntu ~/.claude

pnpm install

claude plugin install superpowers@claude-plugins-official || true

echo "Dev container ready. Run 'claude' to start."
```

`.devcontainer/devcontainer.json`:

```json
{
  "name": "taxreturns-dev",
  "build": {
    "dockerfile": "../infra/dev/Dockerfile",
    "context": ".."
  },
  "remoteUser": "ubuntu",
  "workspaceMount": "source=${localWorkspaceFolder},target=/workspaces/taxreturns,type=bind",
  "workspaceFolder": "/workspaces/taxreturns",
  "mounts": [
    "source=taxreturns-claude-config,target=/home/ubuntu/.claude,type=volume",
    "source=/var/run/docker.sock,target=/var/run/docker.sock,type=bind"
  ],
  "containerEnv": {
    "ANTHROPIC_API_KEY": "${localEnv:ANTHROPIC_API_KEY}"
  },
  "postCreateCommand": "bash infra/dev/postCreate.sh",
  "customizations": {
    "vscode": {
      "extensions": ["anthropic.claude-code"]
    }
  }
}
```

- [ ] **Step 3: Verify the image builds and Claude Code is present**

Run:
```powershell
docker build -t taxreturns-dev -f infra/dev/Dockerfile infra/dev
docker run --rm taxreturns-dev claude --version
docker run --rm taxreturns-dev bash -lc "node --version; pnpm --version; gh --version; psql --version; docker --version"
```
Expected: build succeeds; `claude --version` prints a version; the tool versions all print (Node v22.x).

- [ ] **Step 4: Commit**

```powershell
git add infra/dev .devcontainer; git commit -m "feat(infra): ubuntu dev container with claude code"
```

---

### Task 9: Full-suite verification

**Files:** none (verification only).

**Interfaces:**
- Consumes: everything above.
- Produces: a green baseline for Plan 2.

- [ ] **Step 1: Run everything from the root**

Run:
```powershell
pnpm test
pnpm typecheck
docker compose -f infra/docker-compose.yml up -d
curl http://127.0.0.1:3000/health
```
Expected: all package test suites pass; typecheck clean; health returns `{"status":"ok"}`.

- [ ] **Step 2: Confirm a clean tree and tag the baseline**

```powershell
git status --short   # expect clean
git tag foundation-complete
```
