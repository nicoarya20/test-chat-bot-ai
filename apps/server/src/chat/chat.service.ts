import type { Database } from "../db/client";
import { decryptSecret } from "../keys/key.cipher";
import { getActiveKeyCiphertext } from "../keys/keys.repository";
import { log } from "../logging/logger";
import {
  ensureSessionWindow, getQuotaStatus, recordUsage, type QuotaConfig, type QuotaStatus,
} from "../quota/quota.service";
import { replyTokenBudget } from "../quota/quota.window";
import { getSettings } from "../settings/settings.repository";
import { ChatError, type ChatErrorCode } from "./chat.errors";
import { appendExchange, getConversation, getHistory } from "./conversations.repository";
import {
  UpstreamError, type ChatModelGateway, type ModelCallResult, type ReasoningEffort,
} from "./openrouter.gateway";

export interface ChatServiceConfig {
  encryptionKey: string;
  quota: QuotaConfig;
  minOutputTokens: number;
  maxOutputTokens: number;
  reasoningEffort?: ReasoningEffort;
}

export interface SendInput {
  userId: string;
  conversationId: string;
  text: string;
  onText: (delta: string) => void;
}

export interface SendResult {
  assistantMessageId: string;
  text: string;
  finishReason: string | null;
  quota: QuotaStatus;
}

// OpenRouter HTTP error codes -> stable chat error codes.
const UPSTREAM_STATUS_CODES: Record<number, ChatErrorCode> = {
  401: "upstream_auth",
  403: "upstream_auth",
  402: "upstream_credits",
  404: "model_unavailable",
  429: "upstream_rate_limited",
};

function toUpstreamError(error: unknown, context: string): ChatError {
  if (error instanceof UpstreamError) {
    return new ChatError(UPSTREAM_STATUS_CODES[error.status] ?? "upstream_error", `${context}: ${error.message}`);
  }
  const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return new ChatError("upstream_error", `${context}: ${reason}`);
}

/** Builds the chat service; one in-flight reply per user (single-process lock). */
export function createChatService(db: Database, gateway: ChatModelGateway, config: ChatServiceConfig) {
  // Serializes sends per user so parallel requests cannot overspend the quota.
  // Assumes a single server process; multi-instance needs a DB/Redis lock.
  const inFlight = new Set<string>();

  async function sendMessage(input: SendInput): Promise<SendResult> {
    const conversation = await getConversation(db, input.userId, input.conversationId);
    if (!conversation) throw new ChatError("not_found", `Conversation ${input.conversationId} not found`);
    if (inFlight.has(input.userId)) throw new ChatError("busy", "A reply is already being generated");
    inFlight.add(input.userId);
    try {
      const quota = await getQuotaStatus(db, input.userId, config.quota);
      if (!quota.allowed && quota.blockedBy) {
        throw new ChatError("quota_exceeded", `Token quota exhausted (${quota.blockedBy})`, {
          blockedBy: quota.blockedBy, resetAt: quota.resetAt?.toISOString() ?? null,
        });
      }
      const ciphertext = await getActiveKeyCiphertext(db);
      if (!ciphertext) throw new ChatError("no_api_key", "No active OpenRouter API key configured");
      const apiKey = decryptSecret(ciphertext, config.encryptionKey);
      const settings = await getSettings(db);

      await ensureSessionWindow(db, input.userId, config.quota);
      const history = await getHistory(db, conversation.id);
      const remaining = Math.min(quota.sessionRemaining, quota.weeklyRemaining);

      let result: ModelCallResult;
      try {
        result = await gateway.stream({
          apiKey, model: settings.model, system: settings.systemPrompt,
          messages: [...history, { role: "user", content: input.text }],
          maxTokens: replyTokenBudget(remaining, config.minOutputTokens, config.maxOutputTokens),
          reasoningEffort: config.reasoningEffort,
        }, input.onText);
      } catch (error) {
        const chatError = toUpstreamError(error, `Model call failed for conversation ${conversation.id}`);
        log.error("model call failed", { userId: input.userId, conversationId: conversation.id, code: chatError.code });
        throw chatError;
      }

      // Billed even when filtered, so usage is always recorded.
      await recordUsage(db, { userId: input.userId, conversationId: conversation.id, model: settings.model, ...result.usage });
      if (result.finishReason === "content_filter") {
        throw new ChatError("refused", "The model declined this request");
      }
      const { assistantMessageId } = await appendExchange(db, {
        conversationId: conversation.id, userText: input.text, assistantText: result.text,
      });
      const after = await getQuotaStatus(db, input.userId, config.quota);
      return { assistantMessageId, text: result.text, finishReason: result.finishReason, quota: after };
    } finally {
      inFlight.delete(input.userId);
    }
  }

  return { sendMessage };
}

export type ChatService = ReturnType<typeof createChatService>;
