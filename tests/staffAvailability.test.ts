import test from "node:test";
import assert from "node:assert/strict";
import { isStaffUnavailable } from "../helpers/staffAvailability";

const rules = [
  { staffId: "teacher-1", weekday: 1, shiftNumber: 0, lessonNumber: 1 },
  { staffId: "teacher-2", weekday: 2, shiftNumber: 1, lessonNumber: 0 },
  { staffId: "teacher-3", weekday: 3, shiftNumber: 2, lessonNumber: 4 },
];

test("all-shifts rule blocks the matching lesson in both shifts", () => {
  assert.equal(isStaffUnavailable(rules, "teacher-1", 1, 1, 1), true);
  assert.equal(isStaffUnavailable(rules, "teacher-1", 1, 2, 1), true);
  assert.equal(isStaffUnavailable(rules, "teacher-1", 1, 1, 2), false);
});
test("shift-specific whole-day rule blocks every lesson only in that shift", () => {
  assert.equal(isStaffUnavailable(rules, "teacher-2", 2, 1, 1), true);
  assert.equal(isStaffUnavailable(rules, "teacher-2", 2, 1, 6), true);
  assert.equal(isStaffUnavailable(rules, "teacher-2", 2, 2, 1), false);
});
test("single-lesson rule applies only to its shift, day and teacher", () => {
  assert.equal(isStaffUnavailable(rules, "teacher-3", 3, 2, 4), true);
  assert.equal(isStaffUnavailable(rules, "teacher-3", 3, 1, 4), false);
  assert.equal(isStaffUnavailable(rules, "teacher-3", 4, 2, 4), false);
  assert.equal(isStaffUnavailable(rules, "teacher-1", 3, 2, 4), false);
});
