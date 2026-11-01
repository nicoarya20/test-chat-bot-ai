import type { UserRole, UserStatus } from "../db/schema";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: UserRole;
  status: UserStatus;
}

/** Hono environment shared by all routes. */
export interface AppEnv {
  Variables: { currentUser: CurrentUser };
}

/** Resolves the signed-in user's id from request headers (session cookie), or null. */
export type ResolveUserId = (headers: Headers) => Promise<string | null>;
