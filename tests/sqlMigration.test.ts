import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { stripMigrationTransaction } from "../helpers/sqlMigration";

test("strips transaction markers after leading SQL comments", () => {
  const source = "-- migration note\n-- second note\nBEGIN;\nCREATE TABLE example (id INT);\nCOMMIT;\n";
  assert.equal(stripMigrationTransaction(source), "CREATE TABLE example (id INT);");
});

test("strips transaction markers when BEGIN is the first statement", () => {
  const source = "BEGIN;\nALTER TABLE example ADD COLUMN name TEXT;\nCOMMIT;";
  assert.equal(stripMigrationTransaction(source), "ALTER TABLE example ADD COLUMN name TEXT;");
});

test("rejects migrations without an outer transaction wrapper", () => {
  assert.throws(() => stripMigrationTransaction("CREATE TABLE example (id INT);"), /must start with BEGIN/);
  assert.throws(() => stripMigrationTransaction("BEGIN; CREATE TABLE example (id INT);"), /must end with COMMIT/);
});

test("all checked-in SQL migrations have removable outer transaction markers", async () => {
  const directory = new URL("../db/migrations/", import.meta.url);
  const files = (await readdir(directory))
    .filter((name) => /^\d+_[a-z0-9_-]+\.sql$/i.test(name))
    .sort();

  assert.ok(files.length > 0, "expected at least one SQL migration");
  for (const name of files) {
    const source = await readFile(new URL(name, directory), "utf8");
    const body = stripMigrationTransaction(source);
    assert.ok(body.length > 0, `${name} should contain SQL statements`);
    assert.doesNotMatch(body, /^\s*BEGIN\s*;/i, `${name} should not retain BEGIN`);
    assert.doesNotMatch(body, /\bCOMMIT\s*;\s*$/i, `${name} should not retain COMMIT`);
  }
});
