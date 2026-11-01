-- Users may pick a model per conversation from an admin-curated list of free
-- OpenRouter models; NULL keeps existing conversations on the admin default.
CREATE TABLE IF NOT EXISTS "allowed_models" (
	"slug" text PRIMARY KEY NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "model" text;--> statement-breakpoint
-- Keep the allowlist entry if the admin who added it is deleted.
DO $$ BEGIN
	ALTER TABLE "allowed_models" ADD CONSTRAINT "allowed_models_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
