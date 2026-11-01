import type { QuotaScope } from "../quota/quota.window";

export const CHAT_ERROR_CODES = [
  "not_found", "busy", "quota_exceeded", "no_api_key",
  "refused", "upstream_auth", "upstream_credits", "upstream_rate_limited",
  "model_unavailable", "upstream_error",
] as const;
export type ChatErrorCode = (typeof CHAT_ERROR_CODES)[number];

export interface QuotaErrorDetails { blockedBy: QuotaScope; resetAt: string | null }

/** Domain error for chat sends; `code` is stable and mapped to UI text on the client. */
export class ChatError extends Error {
  constructor(
    readonly code: ChatErrorCode,
    message: string,
    readonly details?: QuotaErrorDetails,
  ) {
    super(message);
    this.name = "ChatError";
  }
}

/** HTTP status used when a ChatError is returned before streaming starts. */
export const CHAT_ERROR_STATUS: Record<ChatErrorCode, 404 | 409 | 429 | 502 | 503 | 422> = {
  not_found: 404,
  busy: 409,
  quota_exceeded: 429,
  no_api_key: 503,
  refused: 422,
  upstream_auth: 502,
  upstream_credits: 503,
  model_unavailable: 502,
  upstream_rate_limited: 503,
  upstream_error: 502,
};
