import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("timetable conflict indexes distinguish separate shifts", async () => {
  const source = await readFile(
    new URL("../db/migrations/012_timetable_shift_aware_conflicts.sql", import.meta.url),
    "utf8",
  );
  const sql = source.replace(/\s+/g, " ").toLocaleLowerCase();

  assert.match(sql, /drop index if exists timetable_staff_slot_uq/);
  assert.match(sql, /drop index if exists timetable_room_slot_uq/);
  assert.match(
    sql,
    /create unique index if not exists timetable_staff_shift_slot_uq on institution_timetable_entries\( institution_id, staff_id, weekday, shift_number, lesson_number, academic_year \)/,
  );
  assert.match(
    sql,
    /create unique index if not exists timetable_room_shift_slot_uq on institution_timetable_entries\( institution_id, lower\(btrim\(room\)\), weekday, shift_number, lesson_number, academic_year \)/,
  );
  assert.match(sql, /where room is not null and btrim\(room\) <> ''/);
});
