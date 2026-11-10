import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getInstitutions } from "../endpoints/institutions/create_POST.schema";
import { getStaff } from "../helpers/staffClient";
import { getPayroll, addPayroll, getTariffs } from "../helpers/financeScheduleClient";
import { PlanQuotaNotice } from "../components/PlanQuotaNotice";
import { ExcelTemplateEditor } from "../components/ExcelTemplateEditor";
import { buildPayrollTemplateCells } from "../helpers/financeTemplateMapping";
import styles from "./payroll.module.css";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useLanguage } from "../helpers/i18n";

type QuotaNotice = "warning" | "limit" | null;

export default function PayrollPage() {
  const nav = useNavigate();
  const { t } = useLanguage();
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
  const [monthYear, monthNumber] = month.split("-").map(Number);
  const payrollDate = new Date(Date.UTC(monthYear || 2026, (monthNumber || 1) - 1, 1));
  const academicYear = monthNumber >= 9
    ? `${monthYear}-${monthYear + 1}`
    : `${monthYear - 1}-${monthYear}`;
  const templateCells = useMemo(() => buildPayrollTemplateCells(staff, tariffs, rows, academicYear, month), [staff, tariffs, rows, academicYear, month]);
  const matchingTariffs = tariffs.filter((item) => {
    if (item.academicYear !== academicYear) return false;
    const from = new Date(item.effectiveFrom);
    const to = item.effectiveTo ? new Date(item.effectiveTo) : null;
    if (Number.isNaN(from.getTime()) || from > payrollDate || (to && to < payrollDate)) return false;
    if (!selectedStaff) return true;
    return item.staffId
      ? item.staffId === selectedStaff.id
      : String(item.positionTitle || "").trim().toLocaleLowerCase() === String(selectedStaff.positionTitle || "").trim().toLocaleLowerCase();
  });
  const availableTariffs = selectedStaff
    ? matchingTariffs.filter((item) => item.staffId === selectedStaff.id).length
      ? matchingTariffs.filter((item) => item.staffId === selectedStaff.id)
      : matchingTariffs.filter((item) => !item.staffId)
    : matchingTariffs;
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
      setErr(error instanceof Error ? error.message : t("finance.payrollSaveError"));
    } finally { setBusy(false); }
  };

  return <main className={styles.page}><div className={styles.wrap}>
    <header><div><small>TJS EDU · МОЛИЯ</small><h1>{t("finance.payrollTitle")}</h1><p>{t("finance.payrollSubtitle")}</p></div><div className={styles.actions}><LanguageSwitcher /><button className={styles.printButton} onClick={() => window.print()}>🖨 {t("common.printA4")}</button><button onClick={() => nav("/")}>← {t("common.mainDashboard")}</button></div></header>
    {err && <p className={styles.error}>{err}</p>}
    <section className={styles.panel}><div className={styles.filters}><label>{t("finance.institution")}<select value={school} onChange={(event) => setSchool(event.target.value)}>{schools.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>{t("finance.month")}<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label></div></section>
    {school && <div className={styles.templateArea}><ExcelTemplateEditor title={t("finance.payrollTitle")} templateUrl="/_cdn/static/aef649ff-c65f-4d60-b3d4-b819d651e1dc-saformad-payroll-template.xlsx" documentType="payroll" institutionId={school} academicYear={academicYear} periodKey={month} worksheetName="Лист1" headerRows={4} maxRows={152} maxColumns={30} editableThroughRow={142} prefillCells={templateCells} orientation="landscape" printScale={0.7} /></div>}
    <section className={styles.panel}><h2>{t("finance.payrollEntry")}</h2><p className={styles.note}>{t("finance.payrollNote")}</p><form onSubmit={save}>
      <label>{t("finance.employee")}<select required value={f.staffId} onChange={(event) => { const staffId = event.target.value; setF((value) => ({ ...value, staffId, tariffId: "", baseAmount: "" })); }}><option value="">{t("finance.select")}</option>{staff.map((item) => <option key={item.id} value={item.id}>{item.fullName} · {item.positionTitle}</option>)}</select></label>
      <label>{t("finance.category")}<select value={f.tariffId} onChange={(event) => { const id = event.target.value; const tariff = availableTariffs.find((item) => item.id === id); setF((value) => ({ ...value, tariffId: id, baseAmount: tariff ? String(tariff.monthlyBase) : value.baseAmount })); }}><option value="">{t("finance.noLink")}</option>{availableTariffs.map((item) => <option key={item.id} value={item.id}>{item.staffId ? t("finance.personalTariff") : item.positionTitle} · {item.qualificationCategory || ""} · {item.monthlyBase} сомонӣ</option>)}</select>{selectedStaff && matchingTariffs.length === 0 && <small className={styles.note}>{t("finance.noMatchingTariff").replace("{position}", selectedStaff.positionTitle)}</small>}</label>
      <label>{t("finance.baseAmount")}<input required type="number" min="0" step="0.01" value={f.baseAmount} readOnly={!!f.tariffId} onChange={(event) => set("baseAmount", event.target.value)} />{f.tariffId && <small className={styles.note}>{t("finance.tariffAutoAmount")}</small>}</label>
      <label>{t("finance.allowances")}<input type="number" min="0" step="0.01" value={f.allowances} onChange={(event) => set("allowances", event.target.value)} /></label>
      <label>{t("finance.deductions")}<input type="number" min="0" step="0.01" value={f.deductions} onChange={(event) => set("deductions", event.target.value)} /></label>
      <label>{t("finance.notes")}<input value={f.notes} onChange={(event) => set("notes", event.target.value)} /></label>
      <div className={styles.totals}><span>{t("finance.gross")} <b>{gross.toFixed(2)} сомонӣ</b></span><span>{t("finance.net")} <b>{net.toFixed(2)} сомонӣ</b></span></div>
      <button disabled={busy || !school || !f.staffId || Number(f.deductions) > gross}>{busy ? t("finance.saving") : t("finance.savePayroll")}</button>
    </form></section>
    <section className={styles.panel}><h2>{t("finance.payrollList")} · {month} ({rows.length})</h2><div className={styles.table}><table><thead><tr><th>{t("finance.employeeHeader")}</th><th>{t("finance.positionHeader")}</th><th>{t("finance.baseAmount")}</th><th>{t("finance.allowances")}</th><th>{t("finance.gross")}</th><th>{t("finance.deductions")}</th><th>{t("finance.net")}</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.fullName}</td><td>{row.positionTitle}</td><td>{Number(row.baseAmount).toFixed(2)}</td><td>{Number(row.allowances).toFixed(2)}</td><td>{Number(row.grossAmount).toFixed(2)}</td><td>{Number(row.deductions).toFixed(2)}</td><td><b>{Number(row.netAmount).toFixed(2)}</b></td></tr>)}</tbody></table>{!rows.length && <p>{t("finance.noPayroll")}</p>}</div></section>
    <footer>© 2026 TJS Edu · {t("finance.accountingFooter")}</footer>
  </div><PlanQuotaNotice status={quotaNotice} onClose={() => setQuotaNotice(null)} /></main>;
}