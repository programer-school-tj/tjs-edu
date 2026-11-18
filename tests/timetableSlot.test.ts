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


import { timetableLessonInterval, timetableLessonsOverlap } from "../helpers/timetableTime";

test("first shift sixth lesson ends exactly when second shift starts", () => {
  assert.deepEqual(timetableLessonInterval(1, 6), { start: 735, end: 780 });
  assert.deepEqual(timetableLessonInterval(2, 1), { start: 780, end: 825 });
  assert.equal(timetableLessonsOverlap(1, 6, 2, 1), false);
});

test("lessons that overlap across shifts are detected", () => {
  assert.equal(timetableLessonsOverlap(1, 7, 2, 1), true);
  assert.equal(timetableLessonsOverlap(1, 6, 2, 1), false);
});

test("the third break is ten minutes and other breaks are five", () => {
  assert.deepEqual(timetableLessonInterval(1, 4), { start: 635, end: 680 });
  assert.deepEqual(timetableLessonInterval(1, 5), { start: 685, end: 730 });
});
