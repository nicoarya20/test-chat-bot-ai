import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { conversations, messages } from "../db/schema";

export type Conversation = typeof conversations.$inferSelect;
export type StoredMessage = typeof messages.$inferSelect;

export interface Page { limit: number; offset: number }

/** Lists a user's conversations, most recently active first. */
export async function listConversations(db: Database, userId: string, page: Page) {
  return db.select({ id: conversations.id, title: conversations.title, updatedAt: conversations.updatedAt })
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt))
    .limit(page.limit)
    .offset(page.offset);
}

interface NewConversation { userId: string; title: string }

/** Creates a conversation owned by the user. */
export async function createConversation(db: Database, input: NewConversation): Promise<Conversation> {
  const [row] = await db.insert(conversations).values(input).returning();
  if (!row) throw new Error("Failed to insert conversation");
  return row;
}

/** Fetches a conversation only if it belongs to the user. */
export async function getConversation(db: Database, userId: string, id: string): Promise<Conversation | null> {
  const [row] = await db.select().from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
  return row ?? null;
}

/** Renames a conversation owned by the user; returns false if not found. */
export async function renameConversation(db: Database, userId: string, id: string, title: string): Promise<boolean> {
  const rows = await db.update(conversations).set({ title })
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
    .returning({ id: conversations.id });
  return rows.length > 0;
}

/** Deletes a conversation owned by the user; returns false if not found. */
export async function deleteConversation(db: Database, userId: string, id: string): Promise<boolean> {
  const rows = await db.delete(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
    .returning({ id: conversations.id });
  return rows.length > 0;
}

/** Display page of messages (text only), oldest first. */
export async function listMessages(db: Database, conversationId: string, page: Page) {
  return db.select({ id: messages.id, role: messages.role, text: messages.text, createdAt: messages.createdAt })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt), asc(messages.id))
    .limit(page.limit)
    .offset(page.offset);
}

/**
 * Full history as role/text turns, in order. Unpaginated on purpose:
 * the model needs the whole conversation as context.
 */
export async function getHistory(db: Database, conversationId: string) {
  return db.select({ role: messages.role, content: messages.text })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt), asc(messages.id));
}

interface Exchange {
  conversationId: string;
  userText: string;
  assistantText: string;
}

/** Appends a user+assistant pair atomically so history never has a dangling turn. */
export async function appendExchange(db: Database, input: Exchange): Promise<{ assistantMessageId: string }> {
  return db.transaction(async (tx) => {
    const now = new Date();
    // Distinct timestamps keep ordering stable even within the same millisecond.
    await tx.insert(messages).values({
      conversationId: input.conversationId, role: "user", text: input.userText, createdAt: now,
    });
    const [assistant] = await tx.insert(messages).values({
      conversationId: input.conversationId, role: "assistant", text: input.assistantText,
      createdAt: new Date(now.getTime() + 1),
    }).returning({ id: messages.id });
    await tx.update(conversations).set({ updatedAt: sql`now()` }).where(eq(conversations.id, input.conversationId));
    if (!assistant) throw new Error("Failed to insert assistant message");
    return { assistantMessageId: assistant.id };
  });
}
