import { readFile, readdir } from "node:fs/promises";
import postgres from "postgres";
import { stripMigrationTransaction } from "../helpers/sqlMigration";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is missing. Copy .env.example to .env and set a dedicated TJS Edu database URL.");
}

const migrationsDirectory = new URL("../db/migrations/", import.meta.url);
const migrationFiles = (await readdir(migrationsDirectory))
  .filter((name) => /^\d+_[a-z0-9_-]+\.sql$/i.test(name))
  .sort();

if (migrationFiles.length === 0) {
  throw new Error("No TJS Edu SQL migrations were found.");
}

const sql = postgres(databaseUrl, { max: 1, prepare: false });

try {
  await sql`CREATE TABLE IF NOT EXISTS tjs_edu_schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  for (const name of migrationFiles) {
    const existing = await sql`SELECT name FROM tjs_edu_schema_migrations WHERE name = ${name}`;
    if (existing.length > 0) {
      console.log(`Skipped already applied migration: ${name}`);
      continue;
    }

    const migration = await readFile(new URL(name, migrationsDirectory), "utf8");
    console.log(`Applying migration: ${name}`);
    // Strip optional SQL comments and outer transaction markers. The runner
    // owns the transaction so the migration and tracking row stay atomic.
    const migrationBody = stripMigrationTransaction(migration);

    // If any statement fails, PostgreSQL rolls the migration back and it can be retried.
    await sql.begin(async (tx) => {
      await tx.unsafe(migrationBody);
      await tx`INSERT INTO tjs_edu_schema_migrations (name) VALUES (${name})`;
    });
    console.log(`Applied: ${name}`);
  }

  console.log("TJS Edu database migrations completed successfully.");
} catch (error) {
  console.error("TJS Edu database migration failed:", error);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
