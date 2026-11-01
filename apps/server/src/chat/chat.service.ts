import Anthropic from "@anthropic-ai/sdk";
import type { BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages";
import type { Database } from "../db/client";
import { decryptSecret } from "../keys/key.cipher";
import { getActiveKeyCiphertext } from "../keys/keys.repository";
import { log } from "../logging/logger";
import {
  ensureSessionWindow, getQuotaStatus, recordUsage, type QuotaConfig, type QuotaStatus,
} from "../quota/quota.service";
import { replyTokenBudget } from "../quota/quota.window";
import { ChatError } from "./chat.errors";
import type { ChatModelGateway, ModelCallInput, ModelCallResult } from "./anthropic.gateway";
import { appendExchange, getConversation, getHistory } from "./conversations.repository";

export interface ChatServiceConfig {
  encryptionKey: string;
  quota: QuotaConfig;
  minOutputTokens: number;
  maxOutputTokens: number;
  effort: ModelCallInput["effort"];
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
  stopReason: ModelCallResult["stopReason"];
  quota: QuotaStatus;
}

function toUpstreamError(error: unknown, context: string): ChatError {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new ChatError("upstream_auth", `${context}: Anthropic rejected the API key (${error.status})`);
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new ChatError("upstream_rate_limited", `${context}: Anthropic rate limit reached`);
  }
  if (error instanceof Anthropic.APIError) {
    return new ChatError("upstream_error", `${context}: Anthropic API error ${error.status ?? "n/a"}: ${error.message}`);
  }
  const reason = error instanceof Error ? error.message : String(error);
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
      if (!ciphertext) throw new ChatError("no_api_key", "No active Anthropic API key configured");
      const apiKey = decryptSecret(ciphertext, config.encryptionKey);

      await ensureSessionWindow(db, input.userId, config.quota);
      const history = await getHistory(db, conversation.id);
      const userContent = [{ type: "text" as const, text: input.text }];
      const messages: BetaMessageParam[] = [
        // content is the exact block array the API returned/accepted earlier (jsonb).
        ...history.map((m) => ({ role: m.role, content: m.content }) as BetaMessageParam),
        { role: "user", content: userContent },
      ];
      const remaining = Math.min(quota.sessionRemaining, quota.weeklyRemaining);

      let result: ModelCallResult;
      try {
        result = await gateway.stream({
          apiKey, model: conversation.model, system: conversation.systemPrompt, messages,
          maxTokens: replyTokenBudget(remaining, config.minOutputTokens, config.maxOutputTokens),
          effort: config.effort,
        }, input.onText);
      } catch (error) {
        const chatError = toUpstreamError(error, `Model call failed for conversation ${conversation.id}`);
        log.error("model call failed", { userId: input.userId, conversationId: conversation.id, code: chatError.code });
        throw chatError;
      }

      // Billed even when refused, so usage is always recorded.
      await recordUsage(db, { userId: input.userId, conversationId: conversation.id, model: conversation.model, ...result.usage });
      if (result.stopReason === "refusal") {
        throw new ChatError("refused", "The model declined this request");
      }
      const { assistantMessageId } = await appendExchange(db, {
        conversationId: conversation.id,
        user: { content: userContent, text: input.text },
        assistant: { content: result.content, text: result.text },
      });
      const after = await getQuotaStatus(db, input.userId, config.quota);
      return { assistantMessageId, text: result.text, stopReason: result.stopReason, quota: after };
    } finally {
      inFlight.delete(input.userId);
    }
  }

  return { sendMessage };
}

export type ChatService = ReturnType<typeof createChatService>;
