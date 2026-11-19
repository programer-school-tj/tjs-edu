import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { stripMigrationTransaction } from "../helpers/sqlMigration";

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

test("PostgreSQL rejects attendance for a student outside the selected class or institution", {
  skip: !databaseUrl ? "Set TEST_DATABASE_URL or DATABASE_URL to run PostgreSQL integration tests" : false,
}, async () => {
  const sql = postgres(databaseUrl!, { max: 1, prepare: false });
  const schema = `tjs_attendance_test_${randomUUID().replace(/-/g, "")}`;

  try {
    await sql.unsafe(`CREATE SCHEMA "${schema}"`);
    await sql.unsafe(`SET search_path TO "${schema}"`);

    for (const name of [
      "001_initial_schema.sql",
      "002_tenant_integrity.sql",
      "015_attendance_student_class_integrity.sql",
    ]) {
      const source = await readFile(new URL(`../db/migrations/${name}`, import.meta.url), "utf8");
      await sql.begin(async (tx) => {
        await tx.unsafe(stripMigrationTransaction(source));
      });
    }

    const [user] = await sql`
      INSERT INTO users (email, display_name)
      VALUES (${`integration-${randomUUID()}@example.test`}, 'Integration test')
      RETURNING id
    `;
    const [schoolA] = await sql`
      INSERT INTO institutions (name, institution_type, region, director_name, created_by)
      VALUES ('School A', 'school', 'Khatlon', 'Director A', ${user.id})
      RETURNING id
    `;
    const [schoolB] = await sql`
      INSERT INTO institutions (name, institution_type, region, director_name, created_by)
      VALUES ('School B', 'school', 'Khatlon', 'Director B', ${user.id})
      RETURNING id
    `;

    const [classA1] = await sql`
      INSERT INTO institution_classes (institution_id, grade, section, academic_year, created_by)
      VALUES (${schoolA.id}, 5, 'A', '2026-2027', ${user.id})
      RETURNING id
    `;
    const [classA2] = await sql`
      INSERT INTO institution_classes (institution_id, grade, section, academic_year, created_by)
      VALUES (${schoolA.id}, 5, 'B', '2026-2027', ${user.id})
      RETURNING id
    `;
    const [classB] = await sql`
      INSERT INTO institution_classes (institution_id, grade, section, academic_year, created_by)
      VALUES (${schoolB.id}, 5, 'A', '2026-2027', ${user.id})
      RETURNING id
    `;
    const [studentA] = await sql`
      INSERT INTO institution_students (institution_id, class_id, full_name, created_by)
      VALUES (${schoolA.id}, ${classA1.id}, 'Student A', ${user.id})
      RETURNING id
    `;

    await sql`
      INSERT INTO institution_attendance
        (institution_id, class_id, student_id, attendance_date, status, created_by)
      VALUES (${schoolA.id}, ${classA1.id}, ${studentA.id}, '2026-11-19', 'present', ${user.id})
    `;

    const expectForeignKeyViolation = async (query: () => Promise<unknown>) => {
      await assert.rejects(query, (error: { code?: string }) => error.code === "23503");
    };

    await expectForeignKeyViolation(() => sql`
      INSERT INTO institution_attendance
        (institution_id, class_id, student_id, attendance_date, status, created_by)
      VALUES (${schoolA.id}, ${classA2.id}, ${studentA.id}, '2026-11-20', 'present', ${user.id})
    `);

    await expectForeignKeyViolation(() => sql`
      INSERT INTO institution_attendance
        (institution_id, class_id, student_id, attendance_date, status, created_by)
      VALUES (${schoolB.id}, ${classB.id}, ${studentA.id}, '2026-11-21', 'present', ${user.id})
    `);
  } finally {
    await sql.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => undefined);
    await sql.end({ timeout: 5 });
  }
});
