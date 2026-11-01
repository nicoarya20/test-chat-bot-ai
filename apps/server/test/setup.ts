import { runMigrations } from "../src/db/migrate";

process.env.NODE_ENV = "test";
const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL must be set to run tests (never point it at the dev DB)");
if (url === process.env.DATABASE_URL) throw new Error("TEST_DATABASE_URL must differ from DATABASE_URL");
await runMigrations(url);
