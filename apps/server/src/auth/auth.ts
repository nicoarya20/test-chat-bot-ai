import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Env } from "../config/env";
import type { Database } from "../db/client";
import { account, session, user, verification } from "../db/schema";
import { initialAccess } from "./access.policy";

type AuthEnv = Pick<Env,
  "BETTER_AUTH_URL" | "BETTER_AUTH_SECRET" | "WEB_ORIGIN" | "GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET" | "ADMIN_EMAILS">;

/** Better Auth instance: Google sign-in only, sessions stored in Postgres. */
export function createAuth(db: Database, env: AuthEnv) {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.WEB_ORIGIN],
    database: drizzleAdapter(db, { provider: "pg", schema: { user, session, account, verification } }),
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        prompt: "select_account",
      },
    },
    user: {
      additionalFields: {
        role: { type: "string", input: false, defaultValue: "user" },
        status: { type: "string", input: false, defaultValue: "pending" },
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (newUser) => ({ data: { ...newUser, ...initialAccess(newUser.email, env.ADMIN_EMAILS) } }),
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
