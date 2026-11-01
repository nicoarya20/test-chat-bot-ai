import { createAuthClient } from "better-auth/react";

/** Better Auth client; same-origin, so no baseURL is needed. */
export const authClient = createAuthClient();

/** Starts Google sign-in and returns to the app root afterwards. */
export function signInWithGoogle() {
  return authClient.signIn.social({ provider: "google", callbackURL: "/" });
}

/** Signs out and reloads to clear in-memory state. */
export async function signOut() {
  await authClient.signOut();
  window.location.assign("/login");
}
