import test from "node:test";
import assert from "node:assert/strict";
import { isValidIsoDate } from "../helpers/attendanceDate";

test("accepts valid ISO calendar dates", () => {
  assert.equal(isValidIsoDate("2026-11-18"), true);
  assert.equal(isValidIsoDate("2024-02-29"), true);
});

test("rejects malformed and impossible calendar dates", () => {
  assert.equal(isValidIsoDate("2026-2-08"), false);
  assert.equal(isValidIsoDate("2026-02-30"), false);
  assert.equal(isValidIsoDate("2025-02-29"), false);
  assert.equal(isValidIsoDate("not-a-date"), false);
});
