import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getInstitutions } from "../endpoints/institutions/create_POST.schema";
import { getStaff } from "../helpers/staffClient";
import { getPayroll, addPayroll, getTariffs, previewPayroll } from "../helpers/financeScheduleClient";
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
  const [preview, setPreview] = useState<any | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [quotaNotice, setQuotaNotice] = useState<QuotaNotice>(null);
  const [f, setF] = useState({ staffId: "", tariffId: "", baseAmount: "", workRate: "1", weeklyHours: "0", workingDays: "0", classHeadAllowance: "0", notebookCheckingAllowance: "0", methodicalAssociationHeadAllowance: "0", otherAllowances: "0", incomeTaxDeduction: "0", partyDuesDeduction: "0", tradeUnionDuesDeduction: "0", newspaperDeduction: "0", otherDeductions: "0", notes: "" });

  useEffect(() => {
    void getInstitutions().then((items) => {
      const approved = items.filter((item: any) => item.status === "approved");
      setSchools(approved);
      if (approved[0]) setSchool(approved[0].id);
    }).catch((error) => setErr(error.message));
  }, []);
  useEffect(() => {
    if (!school) return;
    setF({ staffId: "", tariffId: "", baseAmount: "", workRate: "1", weeklyHours: "0", workingDays: "0", classHeadAllowance: "0", notebookCheckingAllowance: "0", methodicalAssociationHeadAllowance: "0", otherAllowances: "0", incomeTaxDeduction: "0", partyDuesDeduction: "0", tradeUnionDuesDeduction: "0", newspaperDeduction: "0", otherDeductions: "0", notes: "" });
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
  const academicYear = monthNumber >= 9
    ? `${monthYear}-${monthYear + 1}`
    : `${monthYear - 1}-${monthYear}`;
  const templateCells = useMemo(() => buildPayrollTemplateCells(staff, tariffs, rows, academicYear, month), [staff, tariffs, rows, academicYear, month]);
  const matchingTariffs = tariffs.filter((item) => {
    if (item.academicYear !== academicYear) return false;
    const monthStart = new Date(Date.UTC(monthYear, monthNumber - 1, 1));
    const monthEnd = new Date(Date.UTC(monthYear, monthNumber, 0));
    const from = new Date(item.effectiveFrom);
    const to = item.effectiveTo ? new Date(item.effectiveTo) : null;
    if (Number.isNaN(from.getTime()) || from > monthStart || (to && to < monthEnd)) return false;
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
  const allowanceTotal = Number(f.classHeadAllowance || 0) + Number(f.notebookCheckingAllowance || 0) + Number(f.methodicalAssociationHeadAllowance || 0) + Number(f.otherAllowances || 0);
  const gross = Number(f.baseAmount || 0) + allowanceTotal;
  const deductionTotal = Number(f.incomeTaxDeduction || 0) + Number(f.partyDuesDeduction || 0) + Number(f.tradeUnionDuesDeduction || 0) + Number(f.newspaperDeduction || 0) + Number(f.otherDeductions || 0);
  const net = gross - deductionTotal;
  useEffect(() => {
    setPreview(null);
    setPreviewError("");
    if (!school || !f.staffId || !f.baseAmount || Number(f.baseAmount) < 0) {
      setPreviewBusy(false);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setPreviewBusy(true);
      void previewPayroll({
        institutionId: school, staffId: f.staffId, payrollMonth: month,
        tariffId: f.tariffId || undefined, baseAmount: Number(f.baseAmount),
        workRate: Number(f.workRate), weeklyHours: Number(f.weeklyHours),
        workingDays: Number(f.workingDays), classHeadAllowance: Number(f.classHeadAllowance),
        notebookCheckingAllowance: Number(f.notebookCheckingAllowance),
        methodicalAssociationHeadAllowance: Number(f.methodicalAssociationHeadAllowance),
        otherAllowances: Number(f.otherAllowances), incomeTaxDeduction: Number(f.incomeTaxDeduction),
        partyDuesDeduction: Number(f.partyDuesDeduction), tradeUnionDuesDeduction: Number(f.tradeUnionDuesDeduction),
        newspaperDeduction: Number(f.newspaperDeduction), otherDeductions: Number(f.otherDeductions),
      }).then(({ preview: result }) => {
        if (!cancelled) setPreview(result);
      }).catch((error) => {
        if (!cancelled) setPreviewError(error instanceof Error ? error.message : "Пешнамоиш ҳисоб нашуд.");
      }).finally(() => {
        if (!cancelled) setPreviewBusy(false);
      });
    }, 300);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [school, month, f.staffId, f.tariffId, f.baseAmount, f.workRate, f.weeklyHours, f.workingDays, f.classHeadAllowance, f.notebookCheckingAllowance, f.methodicalAssociationHeadAllowance, f.otherAllowances, f.incomeTaxDeduction, f.partyDuesDeduction, f.tradeUnionDuesDeduction, f.newspaperDeduction, f.otherDeductions]);
  const shownGross = preview?.grossAmount ?? gross;
  const shownNet = preview?.netAmount ?? net;
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setErr("");
    try {
      const result = await addPayroll({ institutionId: school, staffId: f.staffId, payrollMonth: month, tariffId: f.tariffId || undefined, baseAmount: Number(f.baseAmount), workRate: Number(f.workRate), weeklyHours: Number(f.weeklyHours), workingDays: Number(f.workingDays), classHeadAllowance: Number(f.classHeadAllowance), notebookCheckingAllowance: Number(f.notebookCheckingAllowance), methodicalAssociationHeadAllowance: Number(f.methodicalAssociationHeadAllowance), otherAllowances: Number(f.otherAllowances), incomeTaxDeduction: Number(f.incomeTaxDeduction), partyDuesDeduction: Number(f.partyDuesDeduction), tradeUnionDuesDeduction: Number(f.tradeUnionDuesDeduction), newspaperDeduction: Number(f.newspaperDeduction), otherDeductions: Number(f.otherDeductions), notes: f.notes });
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
    <section className={styles.panel}><h2>{t("finance.payrollEntry")}</h2><p className={styles.note}>{t("finance.payrollNote")}</p><p className={styles.note}>Пешнамоиши серверӣ: қоидаҳои марказии молиявӣ барои корманд ва моҳи интихобшуда пеш аз сабт ҳисоб карда мешаванд. {previewBusy ? "Ҳисоб шуда истодааст…" : preview ? `Қоидаҳои татбиқшуда: ${preview.financeRuleSnapshot.length}` : "Қоидаҳои мувофиқ ҳангоми ворид кардани маълумот санҷида мешаванд."}</p>{previewError && <p className={styles.error}>{previewError}</p>}<form onSubmit={save}>
      <label>{t("finance.employee")}<select required value={f.staffId} onChange={(event) => { const staffId = event.target.value; setF((value) => ({ ...value, staffId, tariffId: "", baseAmount: "", weeklyHours: "0" })); }}><option value="">{t("finance.select")}</option>{staff.map((item) => <option key={item.id} value={item.id}>{item.fullName} · {item.positionTitle}</option>)}</select></label>
      <label>{t("finance.category")}<select value={f.tariffId} onChange={(event) => { const id = event.target.value; const tariff = availableTariffs.find((item) => item.id === id); setF((value) => ({ ...value, tariffId: id, baseAmount: tariff ? String(tariff.monthlyBase) : value.baseAmount, weeklyHours: tariff ? String(tariff.weeklyHours ?? 0) : value.weeklyHours })); }}><option value="">{t("finance.noLink")}</option>{availableTariffs.map((item) => <option key={item.id} value={item.id}>{item.staffId ? t("finance.personalTariff") : item.positionTitle} · {item.qualificationCategory || ""} · {item.monthlyBase} сомонӣ</option>)}</select>{selectedStaff && matchingTariffs.length === 0 && <small className={styles.note}>{t("finance.noMatchingTariff").replace("{position}", selectedStaff.positionTitle)}</small>}</label>
      <label>{t("finance.baseAmount")}<input required type="number" min="0" step="0.01" value={f.baseAmount} readOnly={!!f.tariffId} onChange={(event) => set("baseAmount", event.target.value)} />{f.tariffId && <small className={styles.note}>{t("finance.tariffAutoAmount")}</small>}</label>
      <label>{t("finance.workRate")}<input type="number" min="0.01" max="5" step="0.25" value={f.workRate} onChange={(event) => set("workRate", event.target.value)} /></label>
      <label>{t("finance.weeklyHours")}<input type="number" min="0" max="60" step="0.5" value={f.weeklyHours} readOnly={!!f.tariffId} onChange={(event) => set("weeklyHours", event.target.value)} /></label>
      <label>{t("finance.workingDays")}<input type="number" min="0" max={new Date(monthYear, monthNumber, 0).getDate()} step="1" value={f.workingDays} onChange={(event) => set("workingDays", event.target.value)} /></label>
      <h3>{t("finance.allowances")}</h3>
      <label>{t("finance.classHeadAllowance")} (сомонӣ)<input type="number" min="0" step="0.01" value={f.classHeadAllowance} onChange={(event) => set("classHeadAllowance", event.target.value)} /></label>
      <label>{t("finance.notebookCheckingAllowance")} (сомонӣ)<input type="number" min="0" step="0.01" value={f.notebookCheckingAllowance} onChange={(event) => set("notebookCheckingAllowance", event.target.value)} /></label>
      <label>{t("finance.methodicalAssociationHeadAllowance")} (сомонӣ)<input type="number" min="0" step="0.01" value={f.methodicalAssociationHeadAllowance} onChange={(event) => set("methodicalAssociationHeadAllowance", event.target.value)} /></label>
      <label>{t("finance.otherAllowances")} (сомонӣ)<input type="number" min="0" step="0.01" value={f.otherAllowances} onChange={(event) => set("otherAllowances", event.target.value)} /></label>
      <h3>{t("finance.deductions")}</h3>
      <label>{t("finance.incomeTaxDeduction")} (сомонӣ)<input type="number" min="0" step="0.01" value={f.incomeTaxDeduction} onChange={(event) => set("incomeTaxDeduction", event.target.value)} /></label>
      <label>{t("finance.partyDuesDeduction")} (сомонӣ)<input type="number" min="0" step="0.01" value={f.partyDuesDeduction} onChange={(event) => set("partyDuesDeduction", event.target.value)} /></label>
      <label>{t("finance.tradeUnionDuesDeduction")} (сомонӣ)<input type="number" min="0" step="0.01" value={f.tradeUnionDuesDeduction} onChange={(event) => set("tradeUnionDuesDeduction", event.target.value)} /></label>
      <label>{t("finance.newspaperDeduction")} (сомонӣ)<input type="number" min="0" step="0.01" value={f.newspaperDeduction} onChange={(event) => set("newspaperDeduction", event.target.value)} /></label>
      <label>{t("finance.otherDeductions")} (сомонӣ)<input type="number" min="0" step="0.01" value={f.otherDeductions} onChange={(event) => set("otherDeductions", event.target.value)} /></label>
      <label>{t("finance.notes")}<input value={f.notes} onChange={(event) => set("notes", event.target.value)} /></label>
      <div className={styles.totals}><span>{t("finance.gross")} <b>{shownGross.toFixed(2)} сомонӣ</b></span><span>{t("finance.net")} <b>{shownNet.toFixed(2)} сомонӣ</b></span></div>{preview && preview.financeRuleSnapshot.length > 0 && <div className={styles.note}>Қоидаҳои татбиқшуда: {preview.financeRuleSnapshot.map((rule: any) => `${rule.title}: ${Number(rule.appliedAmount).toFixed(2)} сомонӣ`).join(" · ")}</div>}
      <button disabled={busy || !school || !f.staffId}>{busy ? t("finance.saving") : t("finance.savePayroll")}</button>
    </form></section>
    <section className={styles.panel}><h2>{t("finance.payrollList")} · {month} ({rows.length})</h2><div className={styles.table}><table><thead><tr><th>{t("finance.employeeHeader")}</th><th>{t("finance.positionHeader")}</th><th>{t("finance.category")}</th><th>{t("finance.workRate")}</th><th>{t("finance.weeklyHours")}</th><th>{t("finance.workingDays")}</th><th>{t("finance.baseAmount")}</th><th>{t("finance.allowances")} · ҷамъ</th><th>{t("finance.classHeadAllowance")}</th><th>{t("finance.notebookCheckingAllowance")}</th><th>{t("finance.methodicalAssociationHeadAllowance")}</th><th>{t("finance.otherAllowances")}</th><th>{t("finance.gross")}</th><th>{t("finance.incomeTaxDeduction")}</th><th>{t("finance.partyDuesDeduction")}</th><th>{t("finance.tradeUnionDuesDeduction")}</th><th>{t("finance.newspaperDeduction")}</th><th>{t("finance.otherDeductions")}</th><th>{t("finance.deductions")} · ҷамъ</th><th>{t("finance.net")}</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.fullName}{Array.isArray(row.financeRuleSnapshot) && row.financeRuleSnapshot.length > 0 && <small className={styles.note} style={{display:"block"}}>Қоидаҳои марказӣ: {row.financeRuleSnapshot.map((rule: any) => `${rule.title}: ${Number(rule.appliedAmount).toFixed(2)} сомонӣ`).join(" · ")}</small>}</td><td>{row.positionTitle}</td><td>{row.qualificationCategory || "—"}</td><td>{Number(row.workRate || 1).toFixed(2)}</td><td>{Number(row.weeklyHours || 0).toFixed(2)}</td><td>{Number(row.workingDays || 0)}</td><td>{Number(row.baseAmount).toFixed(2)}</td><td>{Number(row.allowances || 0).toFixed(2)}</td><td>{Number(row.classHeadAllowance || 0).toFixed(2)}</td><td>{Number(row.notebookCheckingAllowance || 0).toFixed(2)}</td><td>{Number(row.methodicalAssociationHeadAllowance || 0).toFixed(2)}</td><td>{Number(row.otherAllowances || 0).toFixed(2)}</td><td>{Number(row.grossAmount).toFixed(2)}</td><td>{Number(row.incomeTaxDeduction || 0).toFixed(2)}</td><td>{Number(row.partyDuesDeduction || 0).toFixed(2)}</td><td>{Number(row.tradeUnionDuesDeduction || 0).toFixed(2)}</td><td>{Number(row.newspaperDeduction || 0).toFixed(2)}</td><td>{Number(row.otherDeductions || 0).toFixed(2)}</td><td>{Number(row.deductions || 0).toFixed(2)}</td><td><b>{Number(row.netAmount).toFixed(2)}</b></td></tr>)}</tbody></table>{!rows.length && <p>{t("finance.noPayroll")}</p>}</div></section>
    <footer>© 2026 TJS Edu · {t("finance.accountingFooter")}</footer>
  </div><PlanQuotaNotice status={quotaNotice} onClose={() => setQuotaNotice(null)} /></main>;
}