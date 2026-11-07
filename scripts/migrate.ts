import { readFile } from "node:fs/promises";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is missing. Copy .env.example to .env and set a dedicated TJS Edu database URL.");
}

const migration = await readFile(
  new URL("../db/migrations/001_initial_schema.sql", import.meta.url),
  "utf8",
);
const sql = postgres(databaseUrl, { max: 1, prepare: false });

try {
  await sql.unsafe(migration);
  console.log("TJS Edu database migration completed successfully.");
} catch (error) {
  console.error("TJS Edu database migration failed:", error);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
