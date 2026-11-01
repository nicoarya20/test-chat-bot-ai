import { z } from "zod";

/** Effort levels accepted by the current Claude models. */
export const EFFORT_LEVELS = ["low", "medium", "high", "xhigh", "max"] as const;

const csv = z
  .string()
  .default("")
  .transform((value) =>
    value
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  WEB_ORIGIN: z.string().url(),
  BETTER_AUTH_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  ADMIN_EMAILS: csv,
  // 32-byte key, base64-encoded. Encrypts provider API keys at rest.
  KEY_ENCRYPTION_KEY: z.string().refine((v) => Buffer.from(v, "base64").length === 32, {
    message: "KEY_ENCRYPTION_KEY must be 32 bytes encoded as base64",
  }),
  // Weekly reset boundary is Monday 00:00 in this UTC offset (default WIB, UTC+7).
  QUOTA_TZ_OFFSET_MINUTES: z.coerce.number().int().min(-720).max(840).default(420),
  SESSION_WINDOW_HOURS: z.coerce.number().positive().default(5),
  CHAT_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(64000),
  // Floor for max_tokens so a reply can still finish when quota is nearly spent.
  CHAT_MIN_OUTPUT_TOKENS: z.coerce.number().int().positive().default(4096),
  CHAT_EFFORT: z.enum(EFFORT_LEVELS).default("medium"),
});

export type Env = z.infer<typeof envSchema>;

/** Parses and validates process env; throws listing every invalid variable. */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  return parsed.data;
}
