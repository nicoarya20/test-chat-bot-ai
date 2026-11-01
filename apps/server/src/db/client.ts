import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = ReturnType<typeof createDb>["db"];

/** Creates a Drizzle client bound to the given Postgres connection string. */
export function createDb(databaseUrl: string) {
  const sql = postgres(databaseUrl, { max: 10 });
  const db = drizzle(sql, { schema, casing: "snake_case" });
  return { db, sql };
}
