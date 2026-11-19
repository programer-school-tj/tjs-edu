import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("attendance rows must reference a student enrolled in the same class and institution", async () => {
  const source = await readFile(
    new URL("../db/migrations/015_attendance_student_class_integrity.sql", import.meta.url),
    "utf8",
  );
  const sql = source.replace(/\s+/g, " ").toLocaleLowerCase();

  assert.match(
    sql,
    /create unique index if not exists institution_students_tenant_class_id_uq on institution_students\(institution_id, class_id, id\)/,
  );
  assert.match(
    sql,
    /foreign key \(institution_id, class_id, student_id\) references institution_students\(institution_id, class_id, id\)/,
  );
  assert.match(sql, /attendance_student_class_same_class_fk/);
  assert.match(sql, /on delete cascade/);
});
