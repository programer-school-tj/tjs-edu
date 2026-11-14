import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ExcelJS from "exceljs";
import { evaluateFinanceFormula } from "../helpers/financeFormula";
import { getFormDocument, saveFormDocument } from "../helpers/financeScheduleClient";
import styles from "./ExcelTemplateEditor.module.css";

type DocumentType = "tariffing" | "payroll" | "timetable";
type Props = {
  title: string;
  templateUrl: string;
  documentType: DocumentType;
  institutionId: string;
  academicYear: string;
  periodKey?: string;
  worksheetName: string;
  headerRows: number;
  maxRows: number;
  maxColumns: number;
  editableThroughRow?: number;
  prefillCells?: Record<string, string>;
  orientation?: "landscape" | "portrait";
  printScale?: number;
};
type MergeInfo = { startRow: number; endRow: number; startCol: number; endCol: number };

function colLetter(n: number) {
  let value = n;
  let result = "";
  while (value > 0) {
    const rem = (value - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function parseAddress(address: string) {
  const match = /^([A-Z]{1,3})([1-9][0-9]*)$/.exec(address);
  if (!match) return { row: 1, col: 1 };
  let col = 0;
  for (const char of match[1]) col = col * 26 + char.charCodeAt(0) - 64;
  return { row: Number(match[2]), col };
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if ("richText" in value && Array.isArray(value.richText)) return value.richText.map((part) => part.text).join("");
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("result" in value) return String(value.result ?? "");
  }
  return String(value);
}

function isFormulaCell(cell: ExcelJS.Cell) {
  const value = cell.value as any;
  return Boolean(cell.formula || value?.sharedFormula);
}

function recalculateFormulas(worksheet: ExcelJS.Worksheet) {
  const formulaCells: ExcelJS.Cell[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (isFormulaCell(cell)) formulaCells.push(cell);
    });
  });
  const evaluateCell = (address: string, visiting: Set<string>): unknown => {
    const cell = worksheet.getCell(address);
    const value = cell.value as any;
    const formula = String(value?.formula || cell.formula || "");
    if (!formula) return value && typeof value === "object" && "result" in value ? value.result : value;
    if (visiting.has(address)) throw new Error("Формулаҳо ба ҳам даврӣ пайвастанд. Истиноди давриро ислоҳ кунед.");
    const next = new Set(visiting);
    next.add(address);
    const result = evaluateFinanceFormula(formula, (reference) => evaluateCell(reference, next));
    cell.value = { formula, result } as ExcelJS.CellValue;
    return result;
  };
  for (const cell of formulaCells) evaluateCell(cell.address, new Set());
}

function setCellInput(worksheet: ExcelJS.Worksheet, address: string, input: string) {
  const cell = worksheet.getCell(address);
  if (input.trim().startsWith("=")) {
    const formula = input.trim().slice(1);
    const result = evaluateFinanceFormula(formula, (reference) => {
      const value = worksheet.getCell(reference).value as any;
      return value && typeof value === "object" && "result" in value ? value.result : value;
    });
    cell.value = { formula, result } as ExcelJS.CellValue;
  } else {
    cell.value = input;
  }
  recalculateFormulas(worksheet);
}

function excelColor(color: any): string | undefined {
  if (!color) return undefined;
  const argb = typeof color === "string" ? color : color.argb;
  if (typeof argb === "string" && argb.length >= 6) return `#${argb.slice(-6)}`;
  return undefined;
}

function borderCss(side: any): string | undefined {
  if (!side?.style) return undefined;
  const stylesMap: Record<string, string> = { hair: "1px", thin: "1px", dotted: "1px dotted", dashed: "1px dashed", medium: "2px", thick: "3px", double: "3px double" };
  const color = excelColor(side.color) || "#667085";
  const style = side.style === "dotted" || side.style === "dashed" || side.style === "double" ? stylesMap[side.style] : `${stylesMap[side.style] || "1px"} solid`;
  return `${style} ${color}`;
}

function styleFor(cell: ExcelJS.Cell, columnWidth: number) {
  const font = cell.font || {};
  const fill: any = cell.fill;
  const alignment = cell.alignment || {};
  const border = cell.border || {};
  const style: React.CSSProperties = {
    minWidth: `${Math.max(28, columnWidth * 7.1)}px`,
    width: `${Math.max(28, columnWidth * 7.1)}px`,
    fontFamily: font.name || "Arial, sans-serif",
    fontSize: `${Math.min(22, Math.max(8, Number(font.size) || 10))}px`,
    fontWeight: font.bold ? 700 : 400,
    fontStyle: font.italic ? "italic" : "normal",
    textDecoration: font.underline ? "underline" : undefined,
    color: excelColor(font.color) || "#172033",
    backgroundColor: excelColor(fill?.fgColor) || (fill?.type === "pattern" ? "#ffffff" : undefined),
    textAlign: (alignment.horizontal as React.CSSProperties["textAlign"]) || "left",
    verticalAlign: alignment.vertical === "middle" ? "middle" : alignment.vertical === "top" ? "top" : "bottom",
    whiteSpace: alignment.wrapText ? "pre-wrap" : "pre-wrap",
    borderTop: borderCss(border.top),
    borderRight: borderCss(border.right),
    borderBottom: borderCss(border.bottom),
    borderLeft: borderCss(border.left),
    padding: "3px 4px",
  };
  return style;
}

function getMergeMap(worksheet: ExcelJS.Worksheet) {
  const map = new Map<string, MergeInfo>();
  const hidden = new Set<string>();
  const merges = ((worksheet as any).model?.merges || []) as string[];
  for (const range of merges) {
    const [start, end] = range.split(":");
    if (!start || !end) continue;
    const a = parseAddress(start);
    const b = parseAddress(end);
    map.set(start, { startRow: a.row, endRow: b.row, startCol: a.col, endCol: b.col });
    for (let row = a.row; row <= b.row; row++) {
      for (let col = a.col; col <= b.col; col++) {
        if (row !== a.row || col !== a.col) hidden.add(`${colLetter(col)}${row}`);
      }
    }
  }
  return { map, hidden };
}

export function ExcelTemplateEditor(props: Props) {
  const workbookRef = useRef<ExcelJS.Workbook | null>(null);
  const worksheetRef = useRef<ExcelJS.Worksheet | null>(null);
  const savedCellsRef = useRef<Record<string, string>>({});
  const dirtyCellsRef = useRef<Record<string, string>>({});
  const documentKeyRef = useRef("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const periodKey = props.periodKey || "";

  const load = useCallback(async () => {
    if (!props.institutionId) return;
    const documentKey = [props.institutionId, props.documentType, props.academicYear, periodKey].join("|");
    const pendingEdits = documentKeyRef.current === documentKey ? { ...dirtyCellsRef.current } : {};
    setBusy(true); setError(""); setNotice(""); setReady(false);
    try {
      const response = await fetch(props.templateUrl);
      if (!response.ok) throw new Error("Бланкаи аслӣ кушода нашуд.");
      const buffer = await response.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const worksheet = workbook.getWorksheet(props.worksheetName) || workbook.worksheets[0];
      if (!worksheet) throw new Error("Варақи Excel ёфт нашуд.");
      if (props.documentType === "payroll" && /^20[0-9]{2}-(0[1-9]|1[0-2])$/.test(periodKey)) {
        const [year, month] = periodKey.split("-");
        const monthNames = ["ЯНВАР", "ФЕВРАЛ", "МАРТ", "АПРЕЛ", "МАЙ", "ИЮН", "ИЮЛ", "АВГУСТ", "СЕНТЯБР", "ОКТЯБР", "НОЯБР", "ДЕКАБР"];
        const titleCell = worksheet.getCell("B1");
        const originalTitle = cellText(titleCell.value);
        if (originalTitle) titleCell.value = originalTitle.replace(/(?:ЯНВАР|ФЕВРАЛ|МАРТ|АПРЕЛ|МАЙ|ИЮН|ИЮЛ|АВГУСТ|СЕНТЯБР|ОКТЯБР|НОЯБР|ДЕКАБР)\s+СОЛИ\s+20[0-9]{2}/i, `${monthNames[Number(month) - 1]} СОЛИ ${year}`);
      }
      Object.entries(props.prefillCells || {}).forEach(([address, value]) => {
        if (!/^[A-Z]{1,3}[1-9][0-9]*$/.test(address) || typeof value !== "string") return;
        const target = worksheet.getCell(address);
        if (!isFormulaCell(target)) target.value = value;
      });
      const saved = await getFormDocument(props.institutionId, props.documentType, props.academicYear, periodKey);
      const cells = (saved?.payload?.cells || {}) as Record<string, string>;
      savedCellsRef.current = { ...cells };
      Object.entries(cells).forEach(([address, value]) => {
        if (!/^[A-Z]{1,3}[1-9][0-9]*$/.test(address) || typeof value !== "string") return;
        const target = worksheet.getCell(address);
        if (!isFormulaCell(target)) setCellInput(worksheet, address, value);
      });
      Object.entries(pendingEdits).forEach(([address, value]) => {
        if (/^[A-Z]{1,3}[1-9][0-9]*$/.test(address)) setCellInput(worksheet, address, value);
      });
      recalculateFormulas(worksheet);
      dirtyCellsRef.current = pendingEdits;
      documentKeyRef.current = documentKey;
      workbookRef.current = workbook;
      worksheetRef.current = worksheet;
      setDirty(Object.keys(pendingEdits).length > 0); setReady(true); setRevision((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Бланка кушода нашуд.");
    } finally { setBusy(false); }
  }, [props.institutionId, props.templateUrl, props.documentType, props.academicYear, props.worksheetName, props.prefillCells, periodKey]);

  useEffect(() => { void load(); }, [load]);

  const worksheet = worksheetRef.current;
  const mergeInfo = useMemo(() => worksheet ? getMergeMap(worksheet) : { map: new Map<string, MergeInfo>(), hidden: new Set<string>() }, [worksheet, revision]);
  const rows = useMemo(() => {
    if (!worksheet) return [];
    return Array.from({ length: props.maxRows }, (_, index) => index + 1);
  }, [worksheet, props.maxRows, revision]);

  const updateCell = (address: string, value: string) => {
    const worksheet = worksheetRef.current;
    const cell = worksheet?.getCell(address);
    if (!cell || !worksheet) return;
    const previous = cell.value;
    try {
      setCellInput(worksheet, address, value);
      dirtyCellsRef.current[address] = value;
      setDirty(true);
      setError("");
      setRevision((current) => current + 1);
    } catch (e) {
      cell.value = previous;
      try { recalculateFormulas(worksheet); } catch { /* Keep the prior valid workbook state. */ }
      setError(e instanceof Error ? e.message : "Формула дуруст нест.");
      setRevision((current) => current + 1);
    }
  };

  const save = async () => {
    if (!worksheetRef.current || !props.institutionId) return;
    setBusy(true); setError(""); setNotice("");
    try {
      // Persist only user-edited cells. This keeps auto-filled staff data dynamic
      // for newly added employees while preserving intentional manual clearing.
      const cells = { ...savedCellsRef.current, ...dirtyCellsRef.current };
      await saveFormDocument({ institutionId: props.institutionId, documentType: props.documentType, academicYear: props.academicYear, periodKey, templateVersion: "2026-11-07-v2", cells });
      savedCellsRef.current = cells;
      dirtyCellsRef.current = {};
      setDirty(false); setNotice("Тағйиротҳо дар пойгоҳи додаҳо сабт шуданд.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Сабт иҷро нашуд.");
    } finally { setBusy(false); }
  };

  const exportWorkbook = async () => {
    if (!workbookRef.current) return;
    setBusy(true); setError("");
    try {
      // Ask Excel/compatible viewers to recalculate formulas after the edited inputs open.
      workbookRef.current.calcProperties.fullCalcOnLoad = true;
      (workbookRef.current.calcProperties as any).forceFullCalc = true;
      const buffer = await workbookRef.current.xlsx.writeBuffer();
      const blob = new Blob([buffer as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `TJS-Edu-${props.documentType}-${props.academicYear}${periodKey ? `-${periodKey}` : ""}.xlsx`;
      anchor.click();
      // Keep the temporary URL alive briefly so mobile browsers can finish starting the download.
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      setNotice("Файли Excel омода шуд.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Содирот иҷро нашуд.");
    } finally { setBusy(false); }
  };

  return <section className={styles.editor}>
    <style>{`@page { size: A4 ${props.orientation || "landscape"}; margin: 6mm; } @media print { html, body { background: #fff !important; } body, body * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } .${styles.sheetScroll} { zoom: ${props.printScale ?? 0.7}; overflow: visible !important; max-height: none !important; } .${styles.sheet} { border-collapse: collapse !important; } .${styles.sheet} tr, .${styles.sheet} td { break-inside: avoid; page-break-inside: avoid; } }`}</style>
    <div className={styles.toolbar}>
      <div><span className={styles.kicker}>БЛАНКАИ АСЛИИ EXCEL</span><h2>{props.title}</h2><p>Маълумоти кормандон пешакӣ пур мешавад. Ҳуҷайраҳоро таҳрир кунед; барои формула бо = оғоз намоед, мисол: =J5*1.25 ё =ROUND(J5*1.25,2).</p></div>
      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={() => void load()} disabled={busy}>↻ Аз нав кушодан</button>
        <button type="button" onClick={() => void save()} disabled={busy || !ready}>{busy ? "Лаҳза..." : "Сабт"}</button>
        <button type="button" className={styles.export} onClick={() => void exportWorkbook()} disabled={busy || !ready}>Excel ↓</button>
        <button type="button" className={styles.secondary} onClick={() => window.print()} disabled={!ready}>Чоп</button>
      </div>
    </div>
    {dirty && <div className={styles.dirty}>Тағйиротҳои нав сабт нашудаанд.</div>}
    {error && <div className={styles.error}>{error}</div>}
    {notice && <div className={styles.notice}>{notice}</div>}
    {busy && !ready ? <div className={styles.loading}>Бланкаи аслӣ кушода шуда истодааст...</div> : null}
    {ready && worksheet && <div className={styles.sheetScroll}>
      <table className={styles.sheet}>
        <colgroup>{Array.from({ length: props.maxColumns }, (_, index) => <col key={index} style={{ width: `${Math.max(28, (worksheet.getColumn(index + 1).width || 10) * 7.1)}px` }} />)}</colgroup>
        <tbody>
          {rows.map((rowNumber) => <tr key={rowNumber} style={{ height: `${Math.max(16, (worksheet.getRow(rowNumber).height || 18) * 1.33)}px` }}>
            {Array.from({ length: props.maxColumns }, (_, index) => {
              const colNumber = index + 1;
              const address = `${colLetter(colNumber)}${rowNumber}`;
              if (mergeInfo.hidden.has(address)) return null;
              const cell = worksheet.getCell(rowNumber, colNumber);
              const merge = mergeInfo.map.get(address);
              const savedFormula = String(dirtyCellsRef.current[address] ?? savedCellsRef.current[address] ?? "").trim().startsWith("=");
              const editable = rowNumber > props.headerRows && rowNumber <= (props.editableThroughRow ?? props.maxRows) && (!isFormulaCell(cell) || savedFormula);
              const text = cellText(cell.value);
              const columnWidth = worksheet.getColumn(colNumber).width || 10;
              return <td key={address} rowSpan={merge ? merge.endRow - merge.startRow + 1 : 1} colSpan={merge ? merge.endCol - merge.startCol + 1 : 1} style={styleFor(cell, columnWidth)}>
                <div className={editable ? styles.editable : styles.readonly} contentEditable={editable} suppressContentEditableWarning onBlur={(event) => updateCell(address, event.currentTarget.textContent || "")} spellCheck={false}>{text}</div>
              </td>;
            })}
          </tr>)}
        </tbody>
      </table>
    </div>}
    <div className={styles.footerNote}>Маълумот ба муассисаи интихобшуда тааллуқ дорад. Қоидаҳои андоз ва меъёрҳои маош худкор тахмин карда намешаванд.</div>
  </section>;
}