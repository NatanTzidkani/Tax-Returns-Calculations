CREATE TYPE "public"."document_kind" AS ENUM('form106', 'form867', 'charity_receipt', 'other');--> statement-breakpoint
CREATE TYPE "public"."extraction_status" AS ENUM('pending', 'extracted', 'confirmed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."tax_year_status" AS ENUM('draft', 'in_review', 'ready_to_file', 'filed', 'amended');--> statement-breakpoint
CREATE TABLE "calculations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tax_year_id" uuid NOT NULL,
	"engine_version" text NOT NULL,
	"input" jsonb NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "confirmed_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"confirmed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tax_year_id" uuid NOT NULL,
	"kind" "document_kind" NOT NULL,
	"storage_key" text NOT NULL,
	"original_filename" text NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"extraction_status" "extraction_status" DEFAULT 'pending' NOT NULL,
	"extraction_error" text
);
--> statement-breakpoint
CREATE TABLE "extracted_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"model" text NOT NULL,
	"confidence" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loss_carryforward" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"from_year" integer NOT NULL,
	"amount_agorot" bigint NOT NULL,
	"kind" text NOT NULL,
	"consumed_by_year" integer
);
--> statement-breakpoint
CREATE TABLE "tax_years" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"status" "tax_year_status" DEFAULT 'draft' NOT NULL,
	"filed_at" timestamp with time zone,
	"deadline" timestamp with time zone,
	"notes" text,
	CONSTRAINT "tax_years_user_id_year_unique" UNIQUE("user_id","year")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "calculations" ADD CONSTRAINT "calculations_tax_year_id_tax_years_id_fk" FOREIGN KEY ("tax_year_id") REFERENCES "public"."tax_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "confirmed_data" ADD CONSTRAINT "confirmed_data_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_tax_year_id_tax_years_id_fk" FOREIGN KEY ("tax_year_id") REFERENCES "public"."tax_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extracted_fields" ADD CONSTRAINT "extracted_fields_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loss_carryforward" ADD CONSTRAINT "loss_carryforward_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_years" ADD CONSTRAINT "tax_years_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;