import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ExcelJS from "exceljs";

test("institution-provided Excel forms are bundled locally", async () => {
  const workbook = new ExcelJS.Workbook();
  const bytes = await readFile(new URL("../public/templates/tjs-edu-templates.xlsx", import.meta.url));
  await workbook.xlsx.load(bytes);
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ["Тарификатсия", "Табели маош", "Ҷадвали дарсӣ", "Ҷадвали омӯзгор"]);
  const timetable = workbook.getWorksheet("Ҷадвали дарсӣ");
  assert.ok(timetable);
  assert.equal(timetable.getCell("A1").value, "Ҷадвали дарсӣ дар соли таҳсили 2026-2027");
  assert.equal(timetable.getCell("K2").value, "Руйхати омузгорон");
  const values = timetable.getSheetValues().flat();
  assert.equal(values.some((value) => typeof value === "string" && /вақти\s+(оғоз|анҷом)|соати\s+оғоз|соати\s+анҷом/i.test(value)), false);
});
