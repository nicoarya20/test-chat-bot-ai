import { sql } from "drizzle-orm";
import {
  boolean, check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth.schema";

/** Single-row table (id = 1) holding admin-controlled chat settings. */
export const appSettings = pgTable("app_settings", {
  id: integer().primaryKey().default(1),
  model: text().notNull().default("claude-opus-5-5"),
  systemPrompt: text().notNull().default(""),
  defaultSessionTokenLimit: integer().notNull().default(50000),
  defaultWeeklyTokenLimit: integer().notNull().default(500000),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, () => [check("app_settings_singleton", sql`id = 1`)]);

/** Anthropic API keys, AES-256-GCM encrypted; at most one active. */
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
  // Frozen at creation: changing model/system mid-conversation would invalidate
  // replayed thinking blocks (Claude's history-editing check).
  model: text().notNull(),
  systemPrompt: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("conversations_user_updated_idx").on(t.userId, t.updatedAt)]);

export const MESSAGE_ROLES = ["user", "assistant"] as const;

export const messages = pgTable("messages", {
  id: uuid().primaryKey().defaultRandom(),
  conversationId: uuid().notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text({ enum: MESSAGE_ROLES }).notNull(),
  // Exact API content blocks (incl. thinking + signatures), replayed unchanged.
  content: jsonb().notNull(),
  // Plain text extracted for display.
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
}, (t) => [index("usage_logs_user_created_idx").on(t.userId, t.createdAt)]);
