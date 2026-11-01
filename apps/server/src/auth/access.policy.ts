import type { UserRole, UserStatus } from "../db/schema";

/** Role/status for a newly created account: ADMIN_EMAILS are approved admins, others wait. */
export function initialAccess(email: string, adminEmails: readonly string[]): { role: UserRole; status: UserStatus } {
  const isAdmin = adminEmails.includes(email.trim().toLowerCase());
  return isAdmin ? { role: "admin", status: "approved" } : { role: "user", status: "pending" };
}
