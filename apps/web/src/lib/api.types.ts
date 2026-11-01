// Shapes returned by the server API (dates arrive as ISO strings).

export type UserRole = "user" | "admin";
export type UserStatus = "pending" | "approved" | "rejected";
export type QuotaScope = "session" | "weekly";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: UserRole;
  status: UserStatus;
}

export interface QuotaStatus {
  allowed: boolean;
  blockedBy: QuotaScope | null;
  resetAt: string | null;
  sessionLimit: number;
  weeklyLimit: number;
  sessionUsed: number;
  weeklyUsed: number;
  sessionRemaining: number;
  weeklyRemaining: number;
  sessionResetAt: string | null;
  weeklyResetAt: string;
}

export interface MeResponse {
  user: CurrentUser;
  quota: QuotaStatus | null;
}

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
}

export interface AdminUser extends Omit<CurrentUser, "image"> {
  image: string | null;
  sessionTokenLimit: number | null;
  weeklyTokenLimit: number | null;
  sessionUsed: number;
  weeklyUsed: number;
  createdAt: string;
}

export interface AppSettings {
  model: string;
  systemPrompt: string;
  defaultSessionTokenLimit: number;
  defaultWeeklyTokenLimit: number;
  updatedAt: string;
}

export interface ProviderKey {
  id: string;
  label: string;
  last4: string;
  isActive: boolean;
  createdAt: string;
}

export interface ChatErrorPayload {
  code: string;
  details: { blockedBy: QuotaScope; resetAt: string | null } | null;
}

export interface PeriodTotal { totalTokens: number; requests: number }
export interface UsageTotals { today: PeriodTotal; week: PeriodTotal; month: PeriodTotal }
export interface DailyUsagePoint { date: string; inputTokens: number; outputTokens: number; totalTokens: number; requests: number }
export interface ModelUsage { model: string; inputTokens: number; outputTokens: number; totalTokens: number; requests: number }
export interface UserUsage { userId: string; name: string; email: string; totalTokens: number; requests: number }

export interface MyUsageResponse {
  days: number;
  quota: QuotaStatus;
  totals: UsageTotals;
  daily: DailyUsagePoint[];
  byModel: ModelUsage[];
}

export interface AdminUsageResponse {
  days: number;
  totals: UsageTotals;
  daily: DailyUsagePoint[];
  byModel: ModelUsage[];
  topUsers: UserUsage[];
}

export interface FreeModel { id: string; name: string; contextLength: number; inputModalities: string[] }
export interface UserModelsResponse { models: FreeModel[]; defaultModel: string }
export interface AdminModelsResponse { free: FreeModel[]; allowed: string[]; defaultModel: string }
