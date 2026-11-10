import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getInstitutions } from "../endpoints/institutions/create_POST.schema";
import { getTariffs, addTariff } from "../helpers/financeScheduleClient";
import { getStaff } from "../helpers/staffClient";
import { PlanQuotaNotice } from "../components/PlanQuotaNotice";
import { ExcelTemplateEditor } from "../components/ExcelTemplateEditor";
import { buildTariffTemplateCells } from "../helpers/financeTemplateMapping";
import styles from "./tariffs.module.css";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useLanguage } from "../helpers/i18n";

type QuotaNotice = "warning" | "limit" | null;

export default function TariffsPage() {
  const nav = useNavigate();
  const { t } = useLanguage();
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
  const templateCells = useMemo(() => buildTariffTemplateCells(staff, rows, f.academicYear, new Date(`${f.effectiveFrom}T00:00:00`)), [staff, rows, f.academicYear]);
  const set = (key: string, value: string) => setF((current) => ({ ...current, [key]: value }));
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setErr("");
    try {
      const result = await addTariff({ institutionId: school, ...f, staffId: f.staffId || undefined, weeklyHours: f.weeklyHours ? Number(f.weeklyHours) : undefined, monthlyBase: Number(f.monthlyBase), effectiveTo: f.effectiveTo || undefined });
      if (result.plan === "free" && result.operationCount >= 4) setQuotaNotice(result.operationCount >= 5 ? "limit" : "warning");
      setRows(await getTariffs(school));
    } catch (error) {
      if (error instanceof Error && error.message.includes("Ҳадди 5 амалиёти ройгони")) setQuotaNotice("limit");
      setErr(error instanceof Error ? error.message : t("finance.tariffSaveError"));
    } finally { setBusy(false); }
  };

  return <main className={styles.page}><div className={styles.wrap}>
    <header><div><small>TJS EDU · МОЛИЯ ВА КАДРҲО</small><h1>{t("finance.tariffsTitle")}</h1><p>{t("finance.tariffsSubtitle")}</p></div><div className={styles.actions}><LanguageSwitcher /><button className={styles.printButton} onClick={() => window.print()}>🖨 {t("common.printA4")}</button><button onClick={() => nav("/")}>← {t("common.mainDashboard")}</button></div></header>
    {err && <p className={styles.error}>{err}</p>}
    <section className={styles.panel}><label>{t("finance.institution")}<select value={school} onChange={(event) => setSchool(event.target.value)}>{schools.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></section>
    {school && <div className={styles.templateArea}><ExcelTemplateEditor title={`${t("finance.tariffsTitle")} · ${f.academicYear}`} templateUrl="/_cdn/static/a382c6d0-9133-4a64-8245-dcdbce4a8828-tariffing-template.xlsx" documentType="tariffing" institutionId={school} academicYear={f.academicYear} worksheetName="Лист1" headerRows={4} maxRows={143} maxColumns={26} editableThroughRow={142} prefillCells={templateCells} orientation="landscape" printScale={0.7} /></div>}
    <section className={styles.panel}><h2>{t("finance.tariffEntry")}</h2><p className={styles.note}>{t("finance.officialNote")}</p><form onSubmit={save}>
      <label>{t("finance.staffOptional")}<select value={f.staffId} onChange={(event) => { const staffId = event.target.value; const selected = staff.find((item) => item.id === staffId); setF((value) => ({ ...value, staffId, positionTitle: selected?.positionTitle || value.positionTitle })); }}><option value="">{t("finance.genericTariff")}</option>{staff.map((item) => <option key={item.id} value={item.id}>{item.fullName} · {item.positionTitle}</option>)}</select></label>
      <label>{t("finance.position")}<input required value={f.positionTitle} onChange={(event) => set("positionTitle", event.target.value)} /></label>
      <label>{t("finance.education")}<select value={f.educationLevel} onChange={(event) => set("educationLevel", event.target.value)}><option>{t("finance.higher")}</option><option>{t("finance.specialSecondary")}</option><option>{t("finance.secondary")}</option></select></label>
      <label>{t("finance.category")}<input value={f.qualificationCategory} onChange={(event) => set("qualificationCategory", event.target.value)} /></label>
      <label>{t("finance.weeklyHours")}<input type="number" min="0" max="60" step="0.5" value={f.weeklyHours} onChange={(event) => set("weeklyHours", event.target.value)} /></label>
      <label>{t("finance.baseSalary")}<input required type="number" min="0" step="0.01" value={f.monthlyBase} onChange={(event) => set("monthlyBase", event.target.value)} /></label>
      <label>{t("finance.academicYear")}<input required value={f.academicYear} onChange={(event) => set("academicYear", event.target.value)} /></label>
      <label>{t("finance.fromDate")}<input required type="date" value={f.effectiveFrom} onChange={(event) => set("effectiveFrom", event.target.value)} /></label>
      <label>{t("finance.toDate")}<input type="date" value={f.effectiveTo} onChange={(event) => set("effectiveTo", event.target.value)} /></label>
      <label>{t("finance.sourceTitle")}<input value={f.sourceTitle} onChange={(event) => set("sourceTitle", event.target.value)} /></label>
      <label className={styles.wide}>{t("finance.sourceReference")}<input value={f.sourceReference} onChange={(event) => set("sourceReference", event.target.value)} /></label>
      <label className={styles.wide}>{t("finance.notes")}<textarea value={f.notes} onChange={(event) => set("notes", event.target.value)} /></label>
      <button disabled={busy || !school}>{busy ? "Сабт..." : "Сабти тариф"}</button>
    </form></section>
    <section className={styles.panel}><h2>{t("finance.tariffsEntered")} ({rows.length})</h2><div className={styles.table}><table><thead><tr><th>{t("finance.employee")}</th><th>{t("finance.positionUpper")}</th><th>{t("finance.educationCategory")}</th><th>{t("finance.hours")}</th><th>{t("finance.totalSomoni")}</th><th>СОЛ</th><th>{t("finance.source")}</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{staff.find((item) => item.id === row.staffId)?.fullName || "Умумӣ"}</td><td>{row.positionTitle}</td><td>{row.educationLevel || "—"} · {row.qualificationCategory || "—"}</td><td>{row.weeklyHours || "—"}</td><td>{Number(row.monthlyBase).toFixed(2)}</td><td>{row.academicYear}</td><td>{row.sourceTitle || "Манбаъ нишон дода нашудааст"}</td></tr>)}</tbody></table>{!rows.length && <p>{t("finance.noTariffs")}</p>}</div></section>
    <footer>© 2026 TJS Edu · Тарифҳои воридшуда худкор расмӣ ҳисобида намешаванд.</footer>
  </div><PlanQuotaNotice status={quotaNotice} onClose={() => setQuotaNotice(null)} /></main>;
}