import type { Database } from "../db/client";
import { decryptSecret } from "../keys/key.cipher";
import { getActiveKeyCiphertext } from "../keys/keys.repository";
import { log } from "../logging/logger";
import {
  ensureSessionWindow, getQuotaStatus, recordUsage, type QuotaConfig, type QuotaStatus,
} from "../quota/quota.service";
import { replyTokenBudget } from "../quota/quota.window";
import { CatalogUnavailableError, type ModelCatalog } from "../models/model.catalog";
import { getModelChoices } from "../models/model.choices";
import { resolveChatModel } from "../models/model.policy";
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
  /** Model that answered; `fellBack` = the conversation's choice was no longer usable. */
  model: string;
  fellBack: boolean;
}

// OpenRouter HTTP error codes -> stable chat error codes.
const UPSTREAM_STATUS_CODES: Record<number, ChatErrorCode> = {
  401: "upstream_auth",
  403: "upstream_auth",
  402: "upstream_credits",
  404: "model_unavailable",
  429: "upstream_rate_limited",
  // Provider overloaded/down (common on shared :free endpoints); usually transient.
  502: "upstream_unavailable",
  503: "upstream_unavailable",
};

function toUpstreamError(error: unknown, context: string): ChatError {
  if (error instanceof UpstreamError) {
    return new ChatError(UPSTREAM_STATUS_CODES[error.status] ?? "upstream_error", `${context}: ${error.message}`);
  }
  const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return new ChatError("upstream_error", `${context}: ${reason}`);
}

/** Free-only guard: the conversation's model if still allowed and free, else the (free) admin default. */
async function pickModel(db: Database, catalog: ModelCatalog, requested: string | null) {
  let choices;
  try {
    choices = await getModelChoices(db, catalog);
  } catch (error) {
    if (error instanceof CatalogUnavailableError) throw new ChatError("catalog_unavailable", error.message);
    throw error;
  }
  const resolution = resolveChatModel({ requested, ...choices });
  if (!resolution.ok) {
    throw new ChatError("model_not_free", `Default model ${choices.defaultModel} is not currently free on OpenRouter`);
  }
  return resolution;
}

/** Builds the chat service; one in-flight reply per user (single-process lock). */
export function createChatService(db: Database, gateway: ChatModelGateway, catalog: ModelCatalog, config: ChatServiceConfig) {
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
      const { model, fellBack } = await pickModel(db, catalog, conversation.model);

      await ensureSessionWindow(db, input.userId, config.quota);
      const history = await getHistory(db, conversation.id);
      const remaining = Math.min(quota.sessionRemaining, quota.weeklyRemaining);

      let result: ModelCallResult;
      try {
        result = await gateway.stream({
          apiKey, model, system: settings.systemPrompt,
          messages: [...history, { role: "user", content: input.text }],
          maxTokens: replyTokenBudget(remaining, config.minOutputTokens, config.maxOutputTokens),
          reasoningEffort: config.reasoningEffort,
        }, input.onText);
      } catch (error) {
        const chatError = toUpstreamError(error, `Model call failed for conversation ${conversation.id}`);
        log.error("model call failed", {
          userId: input.userId, conversationId: conversation.id, model, code: chatError.code,
          upstreamStatus: error instanceof UpstreamError ? error.status : null,
          // Provider error text only (no user content); needed to diagnose upstream failures.
          reason: error instanceof Error ? error.message.slice(0, 300) : String(error),
        });
        throw chatError;
      }

      // Billed even when filtered, so usage is always recorded.
      await recordUsage(db, { userId: input.userId, conversationId: conversation.id, model, ...result.usage });
      if (result.finishReason === "content_filter") {
        throw new ChatError("refused", "The model declined this request");
      }
      const { assistantMessageId } = await appendExchange(db, {
        conversationId: conversation.id, userText: input.text, assistantText: result.text,
      });
      const after = await getQuotaStatus(db, input.userId, config.quota);
      return { assistantMessageId, text: result.text, finishReason: result.finishReason, quota: after, model, fellBack };
    } finally {
      inFlight.delete(input.userId);
    }
  }

  return { sendMessage };
}

export type ChatService = ReturnType<typeof createChatService>;
