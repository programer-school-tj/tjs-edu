import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getInstitutions } from "../endpoints/institutions/create_POST.schema";
import { getStaff } from "../helpers/staffClient";
import { getPayroll, addPayroll, getTariffs } from "../helpers/financeScheduleClient";
import { PlanQuotaNotice } from "../components/PlanQuotaNotice";
import { ExcelTemplateEditor } from "../components/ExcelTemplateEditor";
import styles from "./payroll.module.css";

type QuotaNotice = "warning" | "limit" | null;

export default function PayrollPage() {
  const nav = useNavigate();
  const [schools, setSchools] = useState<any[]>([]);
  const [school, setSchool] = useState("");
  const [staff, setStaff] = useState<any[]>([]);
  const [tariffs, setTariffs] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [month, setMonth] = useState("2026-11");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [quotaNotice, setQuotaNotice] = useState<QuotaNotice>(null);
  const [f, setF] = useState({ staffId: "", tariffId: "", baseAmount: "", allowances: "0", deductions: "0", notes: "" });

  useEffect(() => {
    void getInstitutions().then((items) => {
      const approved = items.filter((item: any) => item.status === "approved");
      setSchools(approved);
      if (approved[0]) setSchool(approved[0].id);
    }).catch((error) => setErr(error.message));
  }, []);
  useEffect(() => {
    if (!school) return;
    void Promise.all([getStaff(school), getTariffs(school)]).then(([staffRows, tariffRows]) => {
      const activeStaff = staffRows.filter((item: any) => item.isActive);
      setStaff(activeStaff);
      setTariffs(tariffRows);
      if (activeStaff[0]) setF((value) => ({ ...value, staffId: activeStaff[0].id }));
    }).catch((error) => setErr(error.message));
  }, [school]);
  useEffect(() => { if (school) void getPayroll(school, month).then(setRows).catch((error) => setErr(error.message)); }, [school, month]);

  const set = (key: string, value: string) => setF((current) => ({ ...current, [key]: value }));
  const selectedStaff = staff.find((item) => item.id === f.staffId);
  const matchingTariffs = selectedStaff
    ? tariffs.filter((item) => item.staffId ? item.staffId === selectedStaff.id : String(item.positionTitle || "").trim().toLocaleLowerCase() === String(selectedStaff.positionTitle || "").trim().toLocaleLowerCase())
    : tariffs;
  const availableTariffs = selectedStaff ? matchingTariffs : tariffs;
  const gross = Number(f.baseAmount || 0) + Number(f.allowances || 0);
  const net = gross - Number(f.deductions || 0);
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setErr("");
    try {
      const result = await addPayroll({ institutionId: school, staffId: f.staffId, payrollMonth: month, tariffId: f.tariffId || undefined, baseAmount: Number(f.baseAmount), allowances: Number(f.allowances), deductions: Number(f.deductions), notes: f.notes });
      if (result.plan === "free" && result.operationCount >= 4) setQuotaNotice(result.operationCount >= 5 ? "limit" : "warning");
      setRows(await getPayroll(school, month));
    } catch (error) {
      if (error instanceof Error && error.message.includes("Ҳадди 5 амалиёти ройгони")) setQuotaNotice("limit");
      setErr(error instanceof Error ? error.message : "Табел сабт нашуд.");
    } finally { setBusy(false); }
  };

  return <main className={styles.page}><div className={styles.wrap}>
    <header><div><small>TJS EDU · МОЛИЯ</small><h1>Табели маош</h1><p>Ҳисоб ва сабти музди меҳнати кормандон</p></div><div className={styles.actions}><button className={styles.printButton} onClick={() => window.print()}>🖨 Чопи A4</button><button onClick={() => nav("/")}>← Панели асосӣ</button></div></header>
    {err && <p className={styles.error}>{err}</p>}
    <section className={styles.panel}><div className={styles.filters}><label>Муассиса<select value={school} onChange={(event) => setSchool(event.target.value)}>{schools.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Моҳи ҳисоботӣ<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label></div></section>
    {school && <div className={styles.templateArea}><ExcelTemplateEditor title="Табели маош · бланкаи аслии муассиса" templateUrl="/_cdn/static/aef649ff-c65f-4d60-b3d4-b819d651e1dc-saformad-payroll-template.xlsx" documentType="payroll" institutionId={school} academicYear="2026-2027" periodKey={month} worksheetName="Лист1" headerRows={4} maxRows={152} maxColumns={30} orientation="landscape" printScale={0.7} /></div>}
    <section className={styles.panel}><h2>Сабти маоши корманд</h2><p className={styles.note}>Ҳангоми интихоби тариф маблағи асосӣ аз сабти сервер гирифта мешавад. Иловапулиҳо ва нигоҳдоштҳоро танҳо аз рӯйи санадҳои тасдиқшуда ворид кунед. Андоз ҳоло худкор ҳисоб карда намешавад.</p><form onSubmit={save}>
      <label>Корманд<select required value={f.staffId} onChange={(event) => { const staffId = event.target.value; setF((value) => ({ ...value, staffId, tariffId: "", baseAmount: "" })); }}><option value="">Интихоб кунед</option>{staff.map((item) => <option key={item.id} value={item.id}>{item.fullName} · {item.positionTitle}</option>)}</select></label>
      <label>Тариф (ихтиёрӣ)<select value={f.tariffId} onChange={(event) => { const id = event.target.value; const tariff = availableTariffs.find((item) => item.id === id); setF((value) => ({ ...value, tariffId: id, baseAmount: tariff ? String(tariff.monthlyBase) : value.baseAmount })); }}><option value="">Бе пайваст</option>{availableTariffs.map((item) => <option key={item.id} value={item.id}>{item.staffId ? "Тарифи шахсӣ" : item.positionTitle} · {item.qualificationCategory || ""} · {item.monthlyBase} сомонӣ</option>)}</select>{selectedStaff && matchingTariffs.length === 0 && <small className={styles.note}>Барои вазифаи «{selectedStaff.positionTitle}» тарифи мувофиқ ёфт нашуд. Аввал дар бахши тарификатсия тарифи ҳамин вазифаро ворид кунед.</small>}</label>
      <label>Музди асосӣ<input required type="number" min="0" step="0.01" value={f.baseAmount} onChange={(event) => set("baseAmount", event.target.value)} /></label>
      <label>Иловапулиҳо<input type="number" min="0" step="0.01" value={f.allowances} onChange={(event) => set("allowances", event.target.value)} /></label>
      <label>Нигоҳдоштиҳо<input type="number" min="0" step="0.01" value={f.deductions} onChange={(event) => set("deductions", event.target.value)} /></label>
      <label>Шарҳ<input value={f.notes} onChange={(event) => set("notes", event.target.value)} /></label>
      <div className={styles.totals}><span>Ҳисобшуда: <b>{gross.toFixed(2)} сомонӣ</b></span><span>Ба даст: <b>{net.toFixed(2)} сомонӣ</b></span></div>
      <button disabled={busy || !school || !f.staffId || Number(f.deductions) > gross}>{busy ? "Сабт..." : "Сабти табели маош"}</button>
    </form></section>
    <section className={styles.panel}><h2>Рӯйхати маош · {month} ({rows.length})</h2><div className={styles.table}><table><thead><tr><th>КОРМАНД</th><th>ВАЗИФА</th><th>АСОСӢ</th><th>ИЛОВАПУЛӢ</th><th>ҲИСОБШУДА</th><th>НИГОҲДОШТ</th><th>БА ДАСТ</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.fullName}</td><td>{row.positionTitle}</td><td>{Number(row.baseAmount).toFixed(2)}</td><td>{Number(row.allowances).toFixed(2)}</td><td>{Number(row.grossAmount).toFixed(2)}</td><td>{Number(row.deductions).toFixed(2)}</td><td><b>{Number(row.netAmount).toFixed(2)}</b></td></tr>)}</tbody></table>{!rows.length && <p>Барои ин моҳ маълумоти маош ворид нашудааст.</p>}</div></section>
    <footer>© 2026 TJS Edu · Ҳисобот бояд бо ҳуҷҷатҳои муҳосибӣ санҷида шавад.</footer>
  </div><PlanQuotaNotice status={quotaNotice} onClose={() => setQuotaNotice(null)} /></main>;
}