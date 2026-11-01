-- Provider switched from Anthropic to OpenRouter. Claude model IDs are not valid
-- OpenRouter slugs, and the per-conversation model/system freeze plus raw content
-- blocks only existed to replay Claude thinking blocks unchanged, so they go away.
ALTER TABLE "app_settings" ALTER COLUMN "model" SET DEFAULT 'nvidia/nemotron-3-ultra-550b-a55b';--> statement-breakpoint
-- Move a still-Anthropic setting to the new default so chat works after upgrade.
UPDATE "app_settings" SET "model" = 'nvidia/nemotron-3-ultra-550b-a55b' WHERE "model" LIKE 'claude-%';--> statement-breakpoint
ALTER TABLE "conversations" DROP COLUMN IF EXISTS "model";--> statement-breakpoint
ALTER TABLE "conversations" DROP COLUMN IF EXISTS "system_prompt";--> statement-breakpoint
-- History is now replayed from messages.text; the raw block copy is no longer read.
ALTER TABLE "messages" DROP COLUMN IF EXISTS "content";
