import ExcelJS from "exceljs";

export type FinanceDocumentType = "tariffing" | "payroll" | "timetable";

/**
 * Standalone fallback used when legacy Floot-hosted templates are unavailable.
 * It intentionally provides a usable local workbook, not a claim of matching
 * an official ministry form.
 */
export function createFallbackFinanceTemplate(
  documentType: FinanceDocumentType,
  academicYear: string,
  periodKey = "",
): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TJS Edu";
  workbook.subject = "Шакли муваққатии маҳаллии TJS Edu";
  workbook.created = new Date();

  const config = documentType === "tariffing"
    ? {
        name: "Тарификатсия",
        title: "ТАРИФИКАТСИЯИ ОМӮЗГОРОН",
        columns: ["№", "Ному насаб", "Вазифа", "Маълумот", "Категория", "Соатҳо", "Меъёр", "Фан", "Иловапулӣ", "Музди моҳона"],
        widths: [6, 32, 20, 18, 18, 11, 12, 20, 14, 17],
        lastColumn: 10,
      }
    : documentType === "payroll"
      ? {
          name: "Табели маош",
          title: "ТАБЕЛИ МАОШ",
          columns: ["№", "Ному насаб", "Вазифа", "Маълумот", "Категория", "Фан", "Музди асосӣ", "", "", "", "", "", "", "", "", "", "Санҷиши дафтар", "Роҳбарии синф", "Роҳбари иттиҳодияи методӣ", "", "", "Маоши умумӣ", "Рӯзҳои корӣ"],
          widths: [6, 30, 18, 15, 15, 18, 15, 10, 10, 10, 10, 10, 10, 10, 10, 10, 16, 16, 22, 10, 10, 17, 13],
          lastColumn: 23,
        }
      : {
          name: "Ҷадвали дарсӣ",
          title: "ҶАДВАЛИ ДАРСӢ",
          columns: ["Синф", "Рӯз", "Соати дарс", "Фан", "Омӯзгор", "Кабинет"],
          widths: [14, 16, 16, 24, 30, 14],
          lastColumn: 6,
        };

  const sheet = workbook.addWorksheet(config.name);
  config.widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
  const lastColumnLetter = sheet.getColumn(config.lastColumn).letter;
  if (documentType === "payroll") {
    sheet.getCell("B1").value = periodKey
      ? `ТАБЕЛИ МАОШ · ${periodKey}`
      : config.title;
    sheet.mergeCells(`B1:${lastColumnLetter}1`);
  } else {
    sheet.getCell("A1").value = config.title;
    sheet.mergeCells(`A1:${lastColumnLetter}1`);
  }

  const titleCell = documentType === "payroll" ? sheet.getCell("B1") : sheet.getCell("A1");
  titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FF17365D" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 28;
  sheet.getCell("A2").value = `Соли таҳсил: ${academicYear}`;
  sheet.getCell("A2").font = { name: "Arial", size: 10, italic: true };

  config.columns.forEach((label, index) => {
    const cell = sheet.getCell(4, index + 1);
    cell.value = label;
    cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2459A6" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });

  const border = {
    top: { style: "thin" as const, color: { argb: "FF8996A8" } },
    left: { style: "thin" as const, color: { argb: "FF8996A8" } },
    bottom: { style: "thin" as const, color: { argb: "FF8996A8" } },
    right: { style: "thin" as const, color: { argb: "FF8996A8" } },
  };
  for (let row = 4; row <= 142; row++) {
    sheet.getRow(row).height = row === 4 ? 32 : 20;
    for (let col = 1; col <= config.lastColumn; col++) {
      const cell = sheet.getCell(row, col);
      cell.border = border;
      if (row > 4) {
        cell.font = { name: "Arial", size: 9 };
        cell.alignment = { vertical: "middle", wrapText: true };
      }
    }
  }
  sheet.views = [{ state: "frozen", ySplit: 4 }];
  sheet.autoFilter = { from: "A4", to: `${lastColumnLetter}142` };
  (sheet as any).pageSetup = {
    paperSize: 9,
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.2, right: 0.2, top: 0.35, bottom: 0.35, header: 0.15, footer: 0.15 },
  };
  return workbook;
}
