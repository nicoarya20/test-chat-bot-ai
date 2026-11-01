import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb } from "./client";

/** Applies pending SQL migrations from ./drizzle to the given database. */
export async function runMigrations(databaseUrl: string): Promise<void> {
  const { db, sql } = createDb(databaseUrl);
  try {
    await migrate(db, { migrationsFolder: new URL("../../drizzle", import.meta.url).pathname });
  } finally {
    await sql.end();
  }
}

if (import.meta.main) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required to run migrations");
  await runMigrations(url);
  console.info("migrations applied");
}
