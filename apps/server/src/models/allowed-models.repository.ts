import { asc } from "drizzle-orm";
import type { Database } from "../db/client";
import { allowedModels } from "../db/schema";

/** Allowlisted model slugs, alphabetical. Small admin-curated table, so unpaginated. */
export async function listAllowedModels(db: Database): Promise<string[]> {
  const rows = await db.select({ slug: allowedModels.slug }).from(allowedModels).orderBy(asc(allowedModels.slug));
  return rows.map((r) => r.slug);
}

/** Replaces the whole allowlist atomically. */
export async function replaceAllowedModels(db: Database, slugs: string[], adminId: string): Promise<string[]> {
  const unique = [...new Set(slugs)];
  await db.transaction(async (tx) => {
    await tx.delete(allowedModels);
    if (unique.length > 0) await tx.insert(allowedModels).values(unique.map((slug) => ({ slug, createdBy: adminId })));
  });
  return unique.sort();
}
