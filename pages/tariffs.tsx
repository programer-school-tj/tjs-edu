import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getInstitutions } from "../endpoints/institutions/create_POST.schema";
import { getTariffs, addTariff } from "../helpers/financeScheduleClient";
import { getStaff } from "../helpers/staffClient";
import { PlanQuotaNotice } from "../components/PlanQuotaNotice";
import { ExcelTemplateEditor } from "../components/ExcelTemplateEditor";
import { buildTariffTemplateCells } from "../helpers/financeTemplateMapping";
import styles from "./tariffs.module.css";

type QuotaNotice = "warning" | "limit" | null;

export default function TariffsPage() {
  const nav = useNavigate();
  const [schools, setSchools] = useState<any[]>([]);
  const [school, setSchool] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [quotaNotice, setQuotaNotice] = useState<QuotaNotice>(null);
  const [f, setF] = useState({ staffId: "", positionTitle: "Омӯзгор", educationLevel: "Маълумоти олӣ", qualificationCategory: "Бе категория", weeklyHours: "18", monthlyBase: "", effectiveFrom: "2026-09-01", effectiveTo: "", academicYear: "2026-2027", sourceTitle: "", sourceReference: "", notes: "" });

  useEffect(() => {
    void getInstitutions().then((items) => {
      const approved = items.filter((item: any) => item.status === "approved");
      setSchools(approved);
      if (approved[0]) setSchool(approved[0].id);
    }).catch((error) => setErr(error.message));
  }, []);
  useEffect(() => { if (school) void Promise.all([getTariffs(school), getStaff(school)]).then(([tariffRows, staffRows]) => { setRows(tariffRows); setStaff(staffRows.filter((item: any) => item.isActive)); }).catch((error) => setErr(error.message)); }, [school]);
  const templateCells = useMemo(() => buildTariffTemplateCells(staff, rows, "2026-2027", new Date("2026-11-07T00:00:00.000Z")), [staff, rows]);
  const set = (key: string, value: string) => setF((current) => ({ ...current, [key]: value }));
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setErr("");
    try {
      const result = await addTariff({ institutionId: school, ...f, staffId: f.staffId || undefined, weeklyHours: f.weeklyHours ? Number(f.weeklyHours) : undefined, monthlyBase: Number(f.monthlyBase), effectiveTo: f.effectiveTo || undefined });
      if (result.plan === "free" && result.operationCount >= 4) setQuotaNotice(result.operationCount >= 5 ? "limit" : "warning");
      setRows(await getTariffs(school));
    } catch (error) {
      if (error instanceof Error && error.message.includes("Ҳадди 5 амалиёти ройгони")) setQuotaNotice("limit");
      setErr(error instanceof Error ? error.message : "Тариф сабт нашуд.");
    } finally { setBusy(false); }
  };

  return <main className={styles.page}><div className={styles.wrap}>
    <header><div><small>TJS EDU · МОЛИЯ ВА КАДРҲО</small><h1>Тарификатсия</h1><p>Меъёрҳои маош ва маълумоти тахассусии кормандон</p></div><div className={styles.actions}><button className={styles.printButton} onClick={() => window.print()}>🖨 Чопи A4</button><button onClick={() => nav("/")}>← Панели асосӣ</button></div></header>
    {err && <p className={styles.error}>{err}</p>}
    <section className={styles.panel}><label>Муассиса<select value={school} onChange={(event) => setSchool(event.target.value)}>{schools.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></section>
    {school && <div className={styles.templateArea}><ExcelTemplateEditor title="Тарификатсия барои соли таҳсили 2026–2027" templateUrl="/_cdn/static/a382c6d0-9133-4a64-8245-dcdbce4a8828-tariffing-template.xlsx" documentType="tariffing" institutionId={school} academicYear="2026-2027" worksheetName="Лист1" headerRows={4} maxRows={143} maxColumns={26} editableThroughRow={142} prefillCells={templateCells} orientation="landscape" printScale={0.7} /></div>}
    <section className={styles.panel}><h2>Ворид кардани сатри тариф</h2><p className={styles.note}>Танҳо маълумоти санади расмиро ворид кунед. Манбаъ ва санаи амал ҳатман нишон дода шаванд.</p><form onSubmit={save}>
      <label>Корманди мушаххас (ихтиёрӣ)<select value={f.staffId} onChange={(event) => { const staffId = event.target.value; const selected = staff.find((item) => item.id === staffId); setF((value) => ({ ...value, staffId, positionTitle: selected?.positionTitle || value.positionTitle })); }}><option value="">Тариф барои вазифа (умумӣ)</option>{staff.map((item) => <option key={item.id} value={item.id}>{item.fullName} · {item.positionTitle}</option>)}</select></label>
      <label>Вазифа<input required value={f.positionTitle} onChange={(event) => set("positionTitle", event.target.value)} /></label>
      <label>Маълумот<select value={f.educationLevel} onChange={(event) => set("educationLevel", event.target.value)}><option>Маълумоти олӣ</option><option>Маълумоти миёнаи махсус</option><option>Маълумоти миёна</option></select></label>
      <label>Категория<input value={f.qualificationCategory} onChange={(event) => set("qualificationCategory", event.target.value)} /></label>
      <label>Соатҳои ҳафтаина<input type="number" min="0" max="60" step="0.5" value={f.weeklyHours} onChange={(event) => set("weeklyHours", event.target.value)} /></label>
      <label>Музди асосӣ (сомонӣ)<input required type="number" min="0" step="0.01" value={f.monthlyBase} onChange={(event) => set("monthlyBase", event.target.value)} /></label>
      <label>Соли таҳсил<input required value={f.academicYear} onChange={(event) => set("academicYear", event.target.value)} /></label>
      <label>Аз санаи<input required type="date" value={f.effectiveFrom} onChange={(event) => set("effectiveFrom", event.target.value)} /></label>
      <label>То санаи (ихтиёрӣ)<input type="date" value={f.effectiveTo} onChange={(event) => set("effectiveTo", event.target.value)} /></label>
      <label>Номи санади расмӣ<input value={f.sourceTitle} onChange={(event) => set("sourceTitle", event.target.value)} /></label>
      <label className={styles.wide}>Рақам ё пайванди манбаъ<input value={f.sourceReference} onChange={(event) => set("sourceReference", event.target.value)} /></label>
      <label className={styles.wide}>Шарҳ<textarea value={f.notes} onChange={(event) => set("notes", event.target.value)} /></label>
      <button disabled={busy || !school}>{busy ? "Сабт..." : "Сабти тариф"}</button>
    </form></section>
    <section className={styles.panel}><h2>Тарифҳои воридшуда ({rows.length})</h2><div className={styles.table}><table><thead><tr><th>КОРМАНД</th><th>ВАЗИФА</th><th>МАЪЛУМОТ / КАТЕГОРИЯ</th><th>СОАТ</th><th>МАҶМӮЪ (СОМОНӢ)</th><th>СОЛ</th><th>МАНБА</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{staff.find((item) => item.id === row.staffId)?.fullName || "Умумӣ"}</td><td>{row.positionTitle}</td><td>{row.educationLevel || "—"} · {row.qualificationCategory || "—"}</td><td>{row.weeklyHours || "—"}</td><td>{Number(row.monthlyBase).toFixed(2)}</td><td>{row.academicYear}</td><td>{row.sourceTitle || "Манбаъ нишон дода нашудааст"}</td></tr>)}</tbody></table>{!rows.length && <p>Ҳоло тариф ворид нашудааст.</p>}</div></section>
    <footer>© 2026 TJS Edu · Тарифҳои воридшуда худкор расмӣ ҳисобида намешаванд.</footer>
  </div><PlanQuotaNotice status={quotaNotice} onClose={() => setQuotaNotice(null)} /></main>;
}