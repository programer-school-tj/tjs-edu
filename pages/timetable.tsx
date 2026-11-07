import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getInstitutions } from "../endpoints/institutions/create_POST.schema";
import { getClasses } from "../helpers/educationClient";
import { getStaff } from "../helpers/staffClient";
import { getTimetable, addTimetable, getTeachingLoads, addTeachingLoad, generateTimetable } from "../helpers/financeScheduleClient";
import { PlanQuotaNotice } from "../components/PlanQuotaNotice";
import { ExcelTemplateEditor } from "../components/ExcelTemplateEditor";
import styles from "./timetable.module.css";

const days = ["", "Душанбе", "Сешанбе", "Чоршанбе", "Панҷшанбе", "Ҷумъа", "Шанбе"];
type QuotaNotice = "warning" | "limit" | null;

export default function TimetablePage() {
  const nav = useNavigate();
  const [schools, setSchools] = useState<any[]>([]);
  const [school, setSchool] = useState("");
  const [classes, setClasses] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [loads, setLoads] = useState<any[]>([]);
  const [loadBusy, setLoadBusy] = useState(false);
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
      setStaff(staffRows.filter((item: any) => item.isActive));
      setF((value) => ({ ...value, classId: classRows[0]?.id || "", staffId: staffRows.find((item: any) => item.isActive)?.id || "" }));
      setLoadForm((value) => ({ ...value, classId: classRows[0]?.id || "", staffId: staffRows.find((item: any) => item.isActive)?.id || "" }));
    }).catch((error) => setErr(error.message));
  }, [school]);

  useEffect(() => {
    if (school) void Promise.all([getTimetable(school, year), getTeachingLoads(school, year)]).then(([entries, allocations]) => { setRows(entries); setLoads(allocations); }).catch((error) => setErr(error.message));
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
  const generate = async () => { setLoadBusy(true); setErr(""); try { const result = await generateTimetable({ institutionId: school, academicYear: year }); setRows(await getTimetable(school, year)); window.alert(`Ҷадвал сохта шуд. Дарсҳои нав: ${result.created}`); } catch (error) { setErr(error instanceof Error ? error.message : "Ҷадвал сохта нашуд."); } finally { setLoadBusy(false); } };
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
    <header><div><small>TJS EDU · ТАШКИЛИ РАВАНДИ ТАЪЛИМ</small><h1>Ҷадвали дарсӣ</h1><p>Тақсимоти дарсҳо байни синфҳо ва омӯзгорон</p></div><div className={styles.actions}><button className={styles.printButton} onClick={() => window.print()}>🖨 Чопи A4</button><button onClick={() => nav("/")}>← Панели асосӣ</button></div></header>
    {err && <p className={styles.error}>{err}</p>}
    <section className={styles.panel}><div className={styles.filters}><label>Муассиса<select value={school} onChange={(event) => setSchool(event.target.value)}>{schools.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Соли таҳсил<input value={year} onChange={(event) => setYear(event.target.value)} /></label></div></section>
    {school && <div className={styles.templateArea}><ExcelTemplateEditor title="Ҷадвали дарсӣ · соли таҳсили 2026–2027" templateUrl="/_cdn/static/8013df35-8713-4a50-a42b-3a152917199a-timetable-template.xlsx" documentType="timetable" institutionId={school} academicYear={year} worksheetName="Лист3" headerRows={3} maxRows={81} maxColumns={27} orientation="portrait" printScale={0.55} /></div>}
    <section className={styles.panel}><h2>Сарбории фаннии омӯзгорон</h2><p className={styles.note}>Аввал муайян кунед, ки ҳар омӯзгор дар кадом синф кадом фанро чанд соат дар як ҳафта мегузаронад.</p><form onSubmit={saveLoad}>
      <label>Синф<select required value={loadForm.classId} onChange={(event) => setLoad("classId", event.target.value)}>{classes.map((item) => <option key={item.id} value={item.id}>{item.grade}{item.section}</option>)}</select></label>
      <label>Омӯзгор<select required value={loadForm.staffId} onChange={(event) => setLoad("staffId", event.target.value)}>{staff.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select></label>
      <label>Фан<input required value={loadForm.subject} onChange={(event) => setLoad("subject", event.target.value)} placeholder="Масалан: Информатика" /></label>
      <label>Соат дар як ҳафта<input required type="number" min="1" max="36" step="1" value={loadForm.weeklyHours} onChange={(event) => setLoad("weeklyHours", event.target.value)} /></label>
      <button disabled={loadBusy || !school || !loadForm.classId || !loadForm.staffId || loadForm.subject.trim().length < 2}>{loadBusy ? "Сабт..." : "Сабти сарборӣ"}</button>
    </form><div className={styles.table}><table><thead><tr><th>СИНФ</th><th>ФАН</th><th>ОМӮЗГОР</th><th>СОАТ/ҲАФТА</th></tr></thead><tbody>{loads.map((row) => <tr key={row.id}><td>{row.grade}{row.section}</td><td>{row.subject}</td><td>{row.teacherName}</td><td>{Number(row.weeklyHours)}</td></tr>)}</tbody></table>{!loads.length && <p>Сарбории фаннӣ ҳоло ворид нашудааст.</p>}</div><button type="button" disabled={loadBusy || !loads.length} onClick={generate}>⚙️ Тартиб додани ҷадвали худкор</button></section>
    <section className={styles.panel}><h2>Иловаи дарс</h2><form onSubmit={save}>
      <label>Синф<select required value={f.classId} onChange={(event) => set("classId", event.target.value)}>{classes.map((item) => <option key={item.id} value={item.id}>{item.grade}{item.section}</option>)}</select></label>
      <label>Омӯзгор<select required value={f.staffId} onChange={(event) => set("staffId", event.target.value)}>{staff.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select>{selectedTeacher && teacherRemainingHours !== null && <small className={styles.note}>Сарбории тасдиқшуда: {Number(selectedTeacher.workloadHours)} соат · Дар ҷадвал: {teacherScheduledHours} · Боқимонда: {teacherRemainingHours} соат.</small>}</label>
      <label>Фан<input required value={f.subject} onChange={(event) => set("subject", event.target.value)} placeholder="Масалан: Информатика" /></label>
      <label>Рӯзи ҳафта<select value={f.weekday} onChange={(event) => set("weekday", event.target.value)}>{days.slice(1).map((day, index) => <option key={day} value={index + 1}>{day}</option>)}</select></label>
      <label>Соати дарс<select value={f.lessonNumber} onChange={(event) => set("lessonNumber", event.target.value)}>{Array.from({ length: 6 }, (_, index) => index + 1).map((number) => <option key={number} value={number}>{number}-ум</option>)}</select></label>
      <label>Рақами кабинет<input value={f.room} onChange={(event) => set("room", event.target.value)} /></label>
      <button disabled={busy || !school || !f.classId || !f.staffId || teacherRemainingHours === 0}>{busy ? "Сабт..." : "Иловаи дарс"}</button>
    </form></section>
    <section className={styles.panel}><h2>Ҷадвали ҳафтаина аз рӯйи синф</h2><p className={styles.note}>Намоиши чопшавандаи ҳафтаина. Синфро интихоб кунед, то ҳамаи 6 рӯзи дарсӣ ва 6 соати имконпазир дида шаванд.</p><label className={styles.gridClassPicker}>Интихоби синф<select value={gridClassId} onChange={(event) => setGridClassId(event.target.value)}><option value="">Синфро интихоб кунед</option>{classes.slice().sort((a,b) => a.grade-b.grade || a.section.localeCompare(b.section)).map((item) => <option key={item.id} value={item.id}>{item.grade}{item.section}</option>)}</select></label>{gridClassId && <><h3 className={styles.gridHeading}>Ҷадвали дарсии синфи {selectedGridClass?.grade}{selectedGridClass?.section} · {year}</h3><div className={styles.weekGridWrap}><table className={styles.weekGrid}><thead><tr><th>Рӯз</th>{[1,2,3,4,5,6].map((n) => <th key={n}>{n}-ум соат</th>)}</tr></thead><tbody>{days.slice(1).map((day, index) => <tr key={day}><th>{day}</th>{[1,2,3,4,5,6].map((lesson) => { const item = gridCell(index + 1, lesson); return <td key={lesson}>{item ? <div className={styles.lessonCard}><strong>{item.subject}</strong><span>{item.teacherName}</span>{item.room && <small>Каб. {item.room}</small>}</div> : <span className={styles.emptySlot}>—</span>}</td>; })}</tr>)}</tbody></table></div><p className={styles.gridCount}>Дарсҳои дар ҷадвал: {classGridRows.length} · Баст: {Number(selectedGridClass?.grade) >= 8 ? "якум" : "дуюм"}</p></>}</section>
    <section className={styles.panel}><h2>Ҷадвали дарсҳо ({rows.length})</h2><div className={styles.table}><table><thead><tr><th>БАСТ</th><th>РӮЗ</th><th>СОАТ</th><th>СИНФ</th><th>ФАН</th><th>ОМӮЗГОР</th><th>КАБИНЕТ</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.shiftNumber === 2 ? "2" : "1"}</td><td>{days[row.weekday]}</td><td>{row.lessonNumber}</td><td>{row.grade}{row.section}</td><td>{row.subject}</td><td>{row.teacherName}</td><td>{row.room || "—"}</td></tr>)}</tbody></table>{!rows.length && <p>Ҷадвал ҳоло холӣ аст. Аввал синф ва кормандро сабт кунед.</p>}</div></section>
    <footer>© 2026 TJS Edu · Барои як синф ва як омӯзгор дар як вақт дарси такрорӣ иҷозат дода намешавад.</footer>
  </div><PlanQuotaNotice status={quotaNotice} onClose={() => setQuotaNotice(null)} /></main>;
}