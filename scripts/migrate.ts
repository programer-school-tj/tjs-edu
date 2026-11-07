import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required. Copy .env.example to .env and set a dedicated TJS Edu PostgreSQL URL.");
}

const migrationPath = resolve(dirname(fileURLToPath(import.meta.url)), "../db/migrations/001_initial_schema.sql");
const migrationSql = await readFile(migrationPath, "utf8");
const sql = postgres(databaseUrl, { prepare: false, max: 1 });

try {
  await sql.unsafe(migrationSql);
  console.log("TJS Edu database migration completed successfully.");
} catch (error) {
  console.error("TJS Edu database migration failed:", error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
