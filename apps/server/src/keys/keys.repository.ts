import { desc, eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { providerKeys } from "../db/schema";

/** Public view of a stored key: never includes the ciphertext. */
export interface ProviderKeySummary {
  id: string;
  label: string;
  last4: string;
  isActive: boolean;
  createdAt: Date;
}

const summaryColumns = {
  id: providerKeys.id,
  label: providerKeys.label,
  last4: providerKeys.last4,
  isActive: providerKeys.isActive,
  createdAt: providerKeys.createdAt,
};

// Admin-managed and expected to stay tiny; capped defensively instead of paginated.
const MAX_KEYS_LISTED = 100;

/** Lists stored keys, newest first, without secrets. */
export async function listKeys(db: Database): Promise<ProviderKeySummary[]> {
  return db.select(summaryColumns).from(providerKeys).orderBy(desc(providerKeys.createdAt)).limit(MAX_KEYS_LISTED);
}

interface NewKey { label: string; ciphertext: string; last4: string; createdBy: string }

/** Stores an encrypted key; the first key ever added becomes active automatically. */
export async function createKey(db: Database, input: NewKey): Promise<ProviderKeySummary> {
  return db.transaction(async (tx) => {
    const [existingActive] = await tx.select({ id: providerKeys.id }).from(providerKeys)
      .where(eq(providerKeys.isActive, true)).limit(1);
    const [row] = await tx.insert(providerKeys)
      .values({ ...input, isActive: !existingActive })
      .returning(summaryColumns);
    if (!row) throw new Error("Failed to insert provider key");
    return row;
  });
}

/** Makes one key active and deactivates the rest; returns false if the key does not exist. */
export async function activateKey(db: Database, id: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [target] = await tx.select({ id: providerKeys.id }).from(providerKeys).where(eq(providerKeys.id, id));
    if (!target) return false;
    await tx.update(providerKeys).set({ isActive: false }).where(eq(providerKeys.isActive, true));
    await tx.update(providerKeys).set({ isActive: true }).where(eq(providerKeys.id, id));
    return true;
  });
}

/** Deletes a key; returns false if it did not exist. */
export async function deleteKey(db: Database, id: string): Promise<boolean> {
  const rows = await db.delete(providerKeys).where(eq(providerKeys.id, id)).returning({ id: providerKeys.id });
  return rows.length > 0;
}

/** Ciphertext of the active key, or null when no key is active. */
export async function getActiveKeyCiphertext(db: Database): Promise<string | null> {
  const [row] = await db.select({ ciphertext: providerKeys.ciphertext }).from(providerKeys)
    .where(eq(providerKeys.isActive, true)).limit(1);
  return row?.ciphertext ?? null;
}
