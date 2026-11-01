-- The bare Nemotron 3 Ultra slug is the paid endpoint; ":free" is the $0 variant
-- this deployment is meant to start on.
ALTER TABLE "app_settings" ALTER COLUMN "model" SET DEFAULT 'nvidia/nemotron-3-ultra-550b-a55b:free';--> statement-breakpoint
-- Only rows still on the previous default move; an admin's explicit choice stays.
UPDATE "app_settings" SET "model" = 'nvidia/nemotron-3-ultra-550b-a55b:free' WHERE "model" = 'nvidia/nemotron-3-ultra-550b-a55b';
