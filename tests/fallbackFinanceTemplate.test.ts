import test from "node:test";
import assert from "node:assert/strict";
import { createFallbackFinanceTemplate } from "../helpers/fallbackFinanceTemplate";

test("creates a local tariffing workbook with mapped employee columns", () => {
  const workbook = createFallbackFinanceTemplate("tariffing", "2026-2027");
  const sheet = workbook.getWorksheet("Тарификатсия");
  assert.ok(sheet);
  assert.equal(sheet?.getCell("A1").value, "ТАРИФИКАТСИЯИ ОМӮЗГОРОН");
  assert.equal(sheet?.getCell("B4").value, "Ному насаб");
  assert.equal(sheet?.getCell("J4").value, "Музди моҳона");
  assert.equal(sheet?.getRow(142).getCell(10).border?.bottom?.style, "thin");
});

test("creates a local payroll workbook with the period title cell", () => {
  const workbook = createFallbackFinanceTemplate("payroll", "2026-2027", "2026-11");
  const sheet = workbook.getWorksheet("Табели маош");
  assert.ok(sheet);
  assert.equal(sheet?.getCell("B1").value, "ТАБЕЛИ МАОШ · 2026-11");
  assert.equal(sheet?.getCell("Q4").value, "Санҷиши дафтар");
  assert.equal(sheet?.getCell("V4").value, "Маоши умумӣ");
  assert.equal(sheet?.getCell("W4").value, "Рӯзҳои корӣ");
});

test("creates a local timetable workbook", () => {
  const workbook = createFallbackFinanceTemplate("timetable", "2026-2027");
  const sheet = workbook.getWorksheet("Ҷадвали дарсӣ");
  assert.ok(sheet);
  assert.equal(sheet?.getCell("A1").value, "ҶАДВАЛИ ДАРСӢ");
  assert.equal(sheet?.getCell("E4").value, "Омӯзгор");
});
