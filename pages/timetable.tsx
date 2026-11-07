import React, { useEffect, useState } from "react";
import ExcelJS from "exceljs";
import { useNavigate } from "react-router-dom";
import { getInstitutions } from "../endpoints/institutions/create_POST.schema";
import { getClasses } from "../helpers/educationClient";
import { getStaff } from "../helpers/staffClient";
import { getTimetable, addTimetable, getTeachingLoads, addTeachingLoad, generateTimetable, importTimetableRows, getStaffAvailability, saveStaffAvailability } from "../helpers/financeScheduleClient";
import { PlanQuotaNotice } from "../components/PlanQuotaNotice";
import { ExcelTemplateEditor } from "../components/ExcelTemplateEditor";
import styles from "./timetable.module.css";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useLanguage } from "../helpers/i18n";

const days = ["", "Душанбе", "Сешанбе", "Чоршанбе", "Панҷшанбе", "Ҷумъа", "Шанбе"];
type QuotaNotice = "warning" | "limit" | null;

export default function TimetablePage() {
  const nav = useNavigate();
  const { t } = useLanguage();
  const [schools, setSchools] = useState<any[]>([]);
  const [school, setSchool] = useState("");
  const [classes, setClasses] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [loads, setLoads] = useState<any[]>([]);
  const [availabilitySlots, setAvailabilitySlots] = useState<any[]>([]);
  const [availabilityStaffId, setAvailabilityStaffId] = useState("");
  const [availabilityWeekday, setAvailabilityWeekday] = useState("5");
  const [availabilityLesson, setAvailabilityLesson] = useState("0");
  const [availabilityBusy, setAvailabilityBusy] = useState(false);
  const [loadBusy, setLoadBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [loadForm, setLoadForm] = useState({ classId: "", staffId: "", subject: "", weeklyHours: "1" });
  const [year, setYear] = useState("2026-2027");
  const [gridClassId, setGridClassId] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [quotaNotice, setQuotaNotice] = useState<QuotaNotice>(null);
  const [f, setF] = useState({ classId: "", staffId: "", subject: "", weekday: "1", lessonNumber: "1", room: "" });

  useEffect(() => {
    void getInstitutions().then((items) => {
      const approved = items.filter((item: any) => item.status === "approved");
      setSchools(approved);
      if (approved[0]) setSchool(approved[0].id);
    }).catch((error) => setErr(error.message));
  }, []);

  useEffect(() => {
    if (!school) return;
    void Promise.all([getClasses(school), getStaff(school)]).then(([classRows, staffRows]) => {
      setClasses(classRows);
      setGridClassId((current) => current || classRows[0]?.id || "");
      setStaff(staffRows.filter((item: any) => item.isActive));
      setAvailabilityStaffId(staffRows.find((item: any) => item.isActive)?.id || "");
      setF((value) => ({ ...value, classId: classRows[0]?.id || "", staffId: staffRows.find((item: any) => item.isActive)?.id || "" }));
      setLoadForm((value) => ({ ...value, classId: classRows[0]?.id || "", staffId: staffRows.find((item: any) => item.isActive)?.id || "" }));
    }).catch((error) => setErr(error.message));
  }, [school]);

  useEffect(() => {
    if (school) void Promise.all([getTimetable(school, year), getTeachingLoads(school, year), getStaffAvailability(school, year)]).then(([entries, allocations, availability]) => { setRows(entries); setLoads(allocations); setAvailabilitySlots(availability); }).catch((error) => setErr(error.message));
  }, [school, year]);

  const selectedTeacher = staff.find((item) => item.id === f.staffId);
  const selectedGridClass = classes.find((item) => item.id === gridClassId);
  const classGridRows = rows.filter((row) => row.classId === gridClassId);
  const gridCell = (weekday: number, lessonNumber: number) => classGridRows.find((row) => row.weekday === weekday && row.lessonNumber === lessonNumber);
  const teacherScheduledHours = rows.filter((row) => row.staffId === f.staffId).length;
  const teacherRemainingHours = selectedTeacher?.workloadHours === null || selectedTeacher?.workloadHours === undefined
    ? null
    : Math.max(0, Number(selectedTeacher.workloadHours) - teacherScheduledHours);

  const set = (key: string, value: string) => setF((current) => ({ ...current, [key]: value }));
  const setLoad = (key: string, value: string) => setLoadForm((current) => ({ ...current, [key]: value }));
  const saveLoad = async (event: React.FormEvent) => { event.preventDefault(); setLoadBusy(true); setErr(""); try { await addTeachingLoad({ institutionId: school, ...loadForm, weeklyHours: Number(loadForm.weeklyHours), academicYear: year }); setLoads(await getTeachingLoads(school, year)); } catch (error) { setErr(error instanceof Error ? error.message : "Сарборӣ сабт нашуд."); } finally { setLoadBusy(false); } };
  const saveAvailability = async (event: React.FormEvent) => { event.preventDefault(); if (!availabilityStaffId) return; setAvailabilityBusy(true); setErr(""); try { const weekday = Number(availabilityWeekday); const lessonNumber = Number(availabilityLesson); const current = availabilitySlots.filter((slot) => slot.staffId === availabilityStaffId && !(slot.weekday === weekday && (lessonNumber === 0 || slot.lessonNumber === 0 || slot.lessonNumber === lessonNumber))); const next = [...current, { weekday, lessonNumber }]; await saveStaffAvailability({ institutionId: school, staffId: availabilityStaffId, academicYear: year, slots: next.map((slot) => ({ weekday: slot.weekday, lessonNumber: slot.lessonNumber })) }); setAvailabilitySlots(await getStaffAvailability(school, year)); } catch (error) { setErr(error instanceof Error ? error.message : "Қоидаи дастрасӣ сабт нашуд."); } finally { setAvailabilityBusy(false); } };
  const removeAvailability = async (slot: any) => { setAvailabilityBusy(true); setErr(""); try { const next = availabilitySlots.filter((item) => item.staffId === slot.staffId && item.id !== slot.id); await saveStaffAvailability({ institutionId: school, staffId: slot.staffId, academicYear: year, slots: next.map((item) => ({ weekday: item.weekday, lessonNumber: item.lessonNumber })) }); setAvailabilitySlots(await getStaffAvailability(school, year)); } catch (error) { setErr(error instanceof Error ? error.message : "Қоида ҳазф нашуд."); } finally { setAvailabilityBusy(false); } };
  const generate = async () => { setLoadBusy(true); setErr(""); try { const result = await generateTimetable({ institutionId: school, academicYear: year }); setRows(await getTimetable(school, year)); window.alert(`Ҷадвал сохта шуд. Дарсҳои нав: ${result.created}`); } catch (error) { setErr(error instanceof Error ? error.message : "Ҷадвал сохта нашуд."); } finally { setLoadBusy(false); } };

  const downloadImportTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Ҷадвали дарсӣ");
    sheet.columns = [
      { header: "Синф", key: "class", width: 14 },
      { header: "Рӯз (1-6)", key: "day", width: 14 },
      { header: "Соати дарс (1-6)", key: "lesson", width: 18 },
      { header: "Фан", key: "subject", width: 24 },
      { header: "Омӯзгор (ному насаб)", key: "teacher", width: 32 },
      { header: "Кабинет", key: "room", width: 14 },
    ];
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2459A6" } };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = { from: "A1", to: "F1" };
    const buffer = await workbook.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buffer as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "TJS-Edu-namunai-voridoti-jadval.xlsx";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const importExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportBusy(true); setImportStatus(""); setErr("");
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const sheet = workbook.worksheets[0];
      if (!sheet || sheet.rowCount < 2) throw new Error("Файл варақи маълумотдор надорад.");
      const headers = sheet.getRow(1).values as Array<ExcelJS.CellValue>;
      const headerIndex = new Map<string, number>();
      headers.forEach((value, index) => {
        const label = String(value ?? "").trim().toLocaleLowerCase();
        if (label) headerIndex.set(label, index);
      });
      const column = (...names: string[]) => {
        for (const name of names) {
          const found = headerIndex.get(name.toLocaleLowerCase());
          if (found !== undefined) return found;
        }
        return -1;
      };
      const classCol = column("синф", "class");
      const dayCol = column("рӯз (1-6)", "рӯз", "weekday", "day");
      const lessonCol = column("соати дарс (1-6)", "соати дарс", "lesson", "lesson number");
      const subjectCol = column("фан", "subject");
      const teacherCol = column("омӯзгор (ному насаб)", "омӯзгор", "teacher", "teacher name");
      const roomCol = column("кабинет", "room");
      if ([classCol, dayCol, lessonCol, subjectCol, teacherCol].some((index) => index < 0)) {
        throw new Error("Сарлавҳаҳои сутунҳо нодурустанд. Намунаи TJS Edu-ро истифода баред.");
      }
      const dayNames = ["душанбе", "сешанбе", "чоршанбе", "панҷшанбе", "ҷумъа", "шанбе"];
      const rowsToImport: Array<{ grade: number; section: string; weekday: number; lessonNumber: number; subject: string; teacherName: string; room?: string }> = [];
      for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
        const row = sheet.getRow(rowNumber);
        const read = (index: number) => index < 0 ? "" : String(row.getCell(index).text || "").trim();
        const classValue = read(classCol).replace(/\s+/g, "").toLocaleUpperCase();
        if (!classValue) continue;
        const classMatch = /^(\d{1,2})([А-ЯA-ZҒӢҚӮҲҶЭЮЯ])$/.exec(classValue);
        if (!classMatch) throw new Error("Номи синф дар сатри " + rowNumber + " нодуруст аст. Намуна: 5А.");
        const dayValue = read(dayCol).toLocaleLowerCase();
        const weekday = /^\d+$/.test(dayValue) ? Number(dayValue) : dayNames.indexOf(dayValue) + 1;
        const lessonNumber = Number(read(lessonCol));
        const subject = read(subjectCol);
        const teacherName = read(teacherCol);
        if (weekday < 1 || weekday > 6 || !Number.isInteger(lessonNumber) || lessonNumber < 1 || lessonNumber > 6 || subject.length < 2 || teacherName.length < 2) {
          throw new Error("Маълумоти сатри " + rowNumber + " пурра ё дуруст нест.");
        }
        rowsToImport.push({ grade: Number(classMatch[1]), section: classMatch[2], weekday, lessonNumber, subject, teacherName, room: read(roomCol) });
      }
      if (!rowsToImport.length) throw new Error("Дар файл ягон сатри пуршуда ёфт нашуд.");
      const result = await importTimetableRows({ institutionId: school, academicYear: year, rows: rowsToImport });
      setRows(await getTimetable(school, year));
      setImportStatus("Муваффақона " + result.imported + " дарс ворид шуд. Ҳамаи сатрҳо пешакӣ санҷида шуданд.");
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Воридоти Excel иҷро нашуд.");
    } finally {
      setImportBusy(false);
      event.target.value = "";
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const result = await addTimetable({ institutionId: school, ...f, weekday: Number(f.weekday), lessonNumber: Number(f.lessonNumber), academicYear: year });
      if (result.plan === "free" && result.operationCount >= 4) setQuotaNotice(result.operationCount >= 5 ? "limit" : "warning");
      setRows(await getTimetable(school, year));
    } catch (error) {
      if (error instanceof Error && error.message.includes("Ҳадди 5 амалиёти ройгони")) setQuotaNotice("limit");
      setErr(error instanceof Error ? error.message : "Дарс сабт нашуд.");
    } finally { setBusy(false); }
  };

  return <main className={styles.page}><div className={styles.wrap}>
    <header><div><small>TJS EDU · ТАШКИЛИ РАВАНДИ ТАЪЛИМ</small><h1>{t("finance.timetableTitle")}</h1><p>{t("finance.timetableSubtitle")}</p></div><div className={styles.actions}><LanguageSwitcher /><button className={styles.printButton} onClick={() => window.print()}>🖨 {t("common.printA4")}</button><button onClick={() => nav("/")}>← {t("common.mainDashboard")}</button></div></header>
    {err && <p className={styles.error}>{err}</p>}
    <section className={styles.panel}><div className={styles.filters}><label>Муассиса<select value={school} onChange={(event) => setSchool(event.target.value)}>{schools.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Соли таҳсил<input value={year} onChange={(event) => setYear(event.target.value)} /></label></div></section>
    {school && <div className={styles.templateArea}><ExcelTemplateEditor title="Ҷадвали дарсӣ · соли таҳсили 2026–2027" templateUrl="/_cdn/static/8013df35-8713-4a50-a42b-3a152917199a-timetable-template.xlsx" documentType="timetable" institutionId={school} academicYear={year} worksheetName="Лист3" headerRows={3} maxRows={81} maxColumns={27} orientation="portrait" printScale={0.55} /></div>}
    <section className={styles.panel}><h2>Ворид кардани ҷадвал аз Excel</h2><p className={styles.note}>Намунаро гиред, маълумоти ҷадвалро пур кунед ва файлро бор кунед. Система синф, омӯзгор, ихтилофи вақт ва сарбории тасдиқшударо месанҷад. Агар ҳатто як сатр хато бошад, ягон дарс сабт намешавад.</p><div className={styles.importActions}><button type="button" className={styles.secondaryButton} onClick={() => void downloadImportTemplate()} disabled={!school || importBusy}>⬇️ Гирифтани намунаи Excel</button><label className={styles.importFile}>Интихоби файли Excel<input type="file" accept=".xlsx" onChange={importExcel} disabled={!school || importBusy} /></label></div>{importBusy && <p className={styles.note}>Файл санҷида ва ворид шуда истодааст...</p>}{importStatus && <p className={styles.importSuccess}>{importStatus}</p>}</section>
    <section className={styles.panel}><h2>Сарбории фаннии омӯзгорон</h2><p className={styles.note}>Аввал муайян кунед, ки ҳар омӯзгор дар кадом синф кадом фанро чанд соат дар як ҳафта мегузаронад.</p><form onSubmit={saveLoad}>
      <label>Синф<select required value={loadForm.classId} onChange={(event) => setLoad("classId", event.target.value)}>{classes.map((item) => <option key={item.id} value={item.id}>{item.grade}{item.section}</option>)}</select></label>
      <label>Омӯзгор<select required value={loadForm.staffId} onChange={(event) => setLoad("staffId", event.target.value)}>{staff.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select></label>
      <label>Фан<input required value={loadForm.subject} onChange={(event) => setLoad("subject", event.target.value)} placeholder="Масалан: Информатика" /></label>
      <label>Соат дар як ҳафта<input required type="number" min="1" max="36" step="1" value={loadForm.weeklyHours} onChange={(event) => setLoad("weeklyHours", event.target.value)} /></label>
      <button disabled={loadBusy || !school || !loadForm.classId || !loadForm.staffId || loadForm.subject.trim().length < 2}>{loadBusy ? "Сабт..." : "Сабти сарборӣ"}</button>
    </form><div className={styles.table}><table><thead><tr><th>СИНФ</th><th>ФАН</th><th>ОМӮЗГОР</th><th>СОАТ/ҲАФТА</th></tr></thead><tbody>{loads.map((row) => <tr key={row.id}><td>{row.grade}{row.section}</td><td>{row.subject}</td><td>{row.teacherName}</td><td>{Number(row.weeklyHours)}</td></tr>)}</tbody></table>{!loads.length && <p>Сарбории фаннӣ ҳоло ворид нашудааст.</p>}</div><button type="button" disabled={loadBusy || !loads.length} onClick={generate}>⚙️ Тартиб додани ҷадвали худкор</button></section>
    <section className={styles.panel}><h2>Рӯзҳои истироҳат ва дастрасии омӯзгорон</h2><p className={styles.note}>Барои ҳар омӯзгор рӯзи пурраи истироҳат ё соати муайяни бандро интихоб кунед. Генератори худкор, воридоти Excel ва иловаи дастӣ ин маҳдудиятҳоро риоя мекунанд. «0» маънои тамоми рӯзро дорад.</p><form onSubmit={saveAvailability}>
      <label>Омӯзгор<select required value={availabilityStaffId} onChange={(event) => setAvailabilityStaffId(event.target.value)}>{staff.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select></label>
      <label>Рӯзи ҳафта<select value={availabilityWeekday} onChange={(event) => setAvailabilityWeekday(event.target.value)}>{days.slice(1).map((day, index) => <option key={day} value={index + 1}>{day}</option>)}</select></label>
      <label>Вақти банд<select value={availabilityLesson} onChange={(event) => setAvailabilityLesson(event.target.value)}><option value="0">Тамоми рӯз · истироҳат</option>{[1,2,3,4,5,6].map((n) => <option key={n} value={n}>{n}-ум соат</option>)}</select></label>
      <button disabled={availabilityBusy || !availabilityStaffId}>{availabilityBusy ? "Сабт..." : "Сабти маҳдудият"}</button>
    </form><div className={styles.table}><table><thead><tr><th>ОМӮЗГОР</th><th>РӮЗ</th><th>МАҲДУДИЯТ</th><th>АМАЛ</th></tr></thead><tbody>{availabilitySlots.map((slot) => <tr key={slot.id}><td>{slot.teacherName}</td><td>{days[slot.weekday]}</td><td>{slot.lessonNumber === 0 ? "Тамоми рӯз · истироҳат" : slot.lessonNumber + "-ум соат"}</td><td><button type="button" disabled={availabilityBusy} onClick={() => void removeAvailability(slot)}>Ҳазф</button></td></tr>)}</tbody></table>{!availabilitySlots.length && <p>Барои омӯзгорон ҳоло маҳдудияти иловагӣ муайян нашудааст.</p>}</div></section>
    <section className={styles.panel}><h2>Иловаи дарс</h2><form onSubmit={save}>
      <label>Синф<select required value={f.classId} onChange={(event) => set("classId", event.target.value)}>{classes.map((item) => <option key={item.id} value={item.id}>{item.grade}{item.section}</option>)}</select></label>
      <label>Омӯзгор<select required value={f.staffId} onChange={(event) => set("staffId", event.target.value)}>{staff.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select>{selectedTeacher && teacherRemainingHours !== null && <small className={styles.note}>Сарбории тасдиқшуда: {Number(selectedTeacher.workloadHours)} соат · Дар ҷадвал: {teacherScheduledHours} · Боқимонда: {teacherRemainingHours} соат.</small>}</label>
      <label>Фан<input required value={f.subject} onChange={(event) => set("subject", event.target.value)} placeholder="Масалан: Информатика" /></label>
      <label>Рӯзи ҳафта<select value={f.weekday} onChange={(event) => set("weekday", event.target.value)}>{days.slice(1).map((day, index) => <option key={day} value={index + 1}>{day}</option>)}</select></label>
      <label>Соати дарс<select value={f.lessonNumber} onChange={(event) => set("lessonNumber", event.target.value)}>{Array.from({ length: 6 }, (_, index) => index + 1).map((number) => <option key={number} value={number}>{number}-ум</option>)}</select></label>
      <label>Рақами кабинет<input value={f.room} onChange={(event) => set("room", event.target.value)} /></label>
      <button disabled={busy || !school || !f.classId || !f.staffId || teacherRemainingHours === 0}>{busy ? "Сабт..." : "Иловаи дарс"}</button>
    </form></section>
    <section className={`${styles.panel} ${styles.weekGridPrint}`}><h2>Ҷадвали ҳафтаина аз рӯйи синф</h2><p className={styles.note}>Намоиши чопшавандаи ҳафтаина. Синфро интихоб кунед, то ҳамаи 6 рӯзи дарсӣ ва 6 соати имконпазир дида шаванд.</p><label className={styles.gridClassPicker}>Интихоби синф<select value={gridClassId} onChange={(event) => setGridClassId(event.target.value)}><option value="">Синфро интихоб кунед</option>{classes.slice().sort((a,b) => a.grade-b.grade || a.section.localeCompare(b.section)).map((item) => <option key={item.id} value={item.id}>{item.grade}{item.section}</option>)}</select></label>{gridClassId && <><h3 className={styles.gridHeading}>Ҷадвали дарсии синфи {selectedGridClass?.grade}{selectedGridClass?.section} · {year}</h3><div className={styles.weekGridWrap}><table className={styles.weekGrid}><thead><tr><th>Рӯз</th>{[1,2,3,4,5,6].map((n) => <th key={n}>{n}-ум соат</th>)}</tr></thead><tbody>{days.slice(1).map((day, index) => <tr key={day}><th>{day}</th>{[1,2,3,4,5,6].map((lesson) => { const item = gridCell(index + 1, lesson); return <td key={lesson}>{item ? <div className={styles.lessonCard}><strong>{item.subject}</strong><span>{item.teacherName}</span>{item.room && <small>Каб. {item.room}</small>}</div> : <span className={styles.emptySlot}>—</span>}</td>; })}</tr>)}</tbody></table></div><p className={styles.gridCount}>Дарсҳои дар ҷадвал: {classGridRows.length} · Баст: {Number(selectedGridClass?.grade) >= 8 ? "якум" : "дуюм"}</p></>}</section>
    <section className={styles.panel}><h2>Ҷадвали дарсҳо ({rows.length})</h2><div className={styles.table}><table><thead><tr><th>БАСТ</th><th>РӮЗ</th><th>СОАТ</th><th>СИНФ</th><th>ФАН</th><th>ОМӮЗГОР</th><th>КАБИНЕТ</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.shiftNumber === 2 ? "2" : "1"}</td><td>{days[row.weekday]}</td><td>{row.lessonNumber}</td><td>{row.grade}{row.section}</td><td>{row.subject}</td><td>{row.teacherName}</td><td>{row.room || "—"}</td></tr>)}</tbody></table>{!rows.length && <p>Ҷадвал ҳоло холӣ аст. Аввал синф ва кормандро сабт кунед.</p>}</div></section>
    <footer>© 2026 TJS Edu · Барои як синф ва як омӯзгор дар як вақт дарси такрорӣ иҷозат дода намешавад.</footer>
  </div><PlanQuotaNotice status={quotaNotice} onClose={() => setQuotaNotice(null)} /></main>;
}