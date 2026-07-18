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
    /** Set when confirmed data is REMOVED (per-document deletion, plan
     *  2026-07-17-document-deletion.md). Deleted confirmation rows are
     *  invisible to the newer-confirmation stale check — the year only
     *  looks LESS recently confirmed — so the calculation read route also
     *  compares this against the snapshot's createdAt. */
    dataRevisedAt: timestamp('data_revised_at', { withTimezone: true }),
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

export const taxpayerProfiles = pgTable('taxpayer_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Unique: exactly one profile per user (phase 1 = the owner). The key is
  // what makes PUT an idempotent upsert (onConflictDoUpdate on user_id,
  // mirroring the loss_carryforward concurrency pattern).
  userId: uuid('user_id').notNull().references(() => users.id).unique(),
  /** TaxpayerProfileSchema-validated jsonb (validated on WRITE; readers
   *  safeParse and treat a mismatch as "no profile" — fail-safe). The
   *  profile is a pre-fill convenience store ONLY: the calculate route
   *  never reads it (docs/superpowers/plans/2026-07-14-taxpayer-profile.md). */
  payload: jsonb('payload').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const lossCarryforward = pgTable(
  'loss_carryforward',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id),
    fromYear: integer('from_year').notNull(),
    /** integer agorot; bigint because losses can exceed int4 range */
    amountAgorot: bigint('amount_agorot', { mode: 'number' }).notNull(),
    kind: text('kind').notNull(),
    consumedByYear: integer('consumed_by_year'),
  },
  // At most one open carry-forward row per (user, source year, kind). The
  // calculate route replaces this year's row on every recalculation; the
  // constraint is what makes that safe under a concurrent double-submit —
  // two racing recalcs converge to one row (onConflictDoUpdate) instead of
  // duplicating a loss that would then be double-counted into later years.
  (t) => [unique().on(t.userId, t.fromYear, t.kind)],
);
