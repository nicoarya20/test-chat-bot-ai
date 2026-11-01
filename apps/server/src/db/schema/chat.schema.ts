import { sql } from "drizzle-orm";
import {
  boolean, check, index, integer, pgTable, text, timestamp, uniqueIndex, uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth.schema";

/** OpenRouter model slug used until an admin picks another. */
export const DEFAULT_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free";

/** Single-row table (id = 1) holding admin-controlled chat settings. */
export const appSettings = pgTable("app_settings", {
  id: integer().primaryKey().default(1),
  model: text().notNull().default(DEFAULT_MODEL),
  systemPrompt: text().notNull().default(""),
  defaultSessionTokenLimit: integer().notNull().default(50000),
  defaultWeeklyTokenLimit: integer().notNull().default(500000),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, () => [check("app_settings_singleton", sql`id = 1`)]);

/** OpenRouter API keys, AES-256-GCM encrypted; at most one active. */
export const providerKeys = pgTable("provider_keys", {
  id: uuid().primaryKey().defaultRandom(),
  label: text().notNull(),
  ciphertext: text().notNull(),
  last4: text().notNull(),
  isActive: boolean().notNull().default(false),
  createdBy: text().references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("provider_keys_one_active_idx").on(t.isActive).where(sql`is_active = true`),
]);

export const conversations = pgTable("conversations", {
  id: uuid().primaryKey().defaultRandom(),
  userId: text().notNull().references(() => user.id, { onDelete: "cascade" }),
  title: text().notNull(),
  // OpenRouter slug chosen by the user; null = the admin default model.
  model: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("conversations_user_updated_idx").on(t.userId, t.updatedAt)]);

/** Free OpenRouter models an admin lets users pick (the default model is always allowed). */
export const allowedModels = pgTable("allowed_models", {
  slug: text().primaryKey(),
  createdBy: text().references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const MESSAGE_ROLES = ["user", "assistant"] as const;

export const messages = pgTable("messages", {
  id: uuid().primaryKey().defaultRandom(),
  conversationId: uuid().notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text({ enum: MESSAGE_ROLES }).notNull(),
  // Plain text; also what is replayed to the model as history.
  text: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("messages_conversation_created_idx").on(t.conversationId, t.createdAt)]);

export const usageLogs = pgTable("usage_logs", {
  id: uuid().primaryKey().defaultRandom(),
  userId: text().notNull().references(() => user.id, { onDelete: "cascade" }),
  conversationId: uuid().references(() => conversations.id, { onDelete: "set null" }),
  model: text().notNull(),
  inputTokens: integer().notNull(),
  outputTokens: integer().notNull(),
  cacheCreationTokens: integer().notNull().default(0),
  cacheReadTokens: integer().notNull().default(0),
  totalTokens: integer().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("usage_logs_user_created_idx").on(t.userId, t.createdAt),
  // Admin usage views filter by time across all users.
  index("usage_logs_created_idx").on(t.createdAt),
]);
