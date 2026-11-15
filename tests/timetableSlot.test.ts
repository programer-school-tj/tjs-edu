import test from "node:test";
import assert from "node:assert/strict";
import { timetableSlotKey } from "../helpers/timetableSlot";

test("same teacher can occupy the same lesson number in different shifts", () => {
  const firstShift = timetableSlotKey("teacher-1", 1, 1, 1);
  const secondShift = timetableSlotKey("teacher-1", 2, 1, 1);

  assert.notEqual(firstShift, secondShift);
});

test("same teacher, shift, weekday and lesson resolve to the same slot key", () => {
  assert.equal(
    timetableSlotKey("teacher-1", 1, 2, 3),
    timetableSlotKey("teacher-1", 1, 2, 3),
  );
});

test("different teachers do not share slot keys", () => {
  assert.notEqual(
    timetableSlotKey("teacher-1", 1, 2, 3),
    timetableSlotKey("teacher-2", 1, 2, 3),
  );
});
