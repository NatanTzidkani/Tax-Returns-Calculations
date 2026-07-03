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
