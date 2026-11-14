import React, { useEffect, useState } from "react";
import superjson from "superjson";
import { Check, X, RefreshCw, ShieldCheck, Clock3, Building2 } from "lucide-react";
import { BrandMark } from "../components/BrandMark";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import styles from "./admin.module.css";

type Institution = { id: string; name: string; institutionType: string; region: string; phone: string | null; directorName: string; status: string; createdAt: string; plan?: string; planExpiresAt?: string | null; };
type FinanceRule = { id: string; ruleKey: string; title: string; category: string; calculationType: string; numericValue: number | null; formula: string | null; effectiveFrom: string; effectiveTo: string | null; sourceTitle: string; sourceReference: string | null; notes: string | null; };

export default function AdminPage() {
  const [items, setItems] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState<Record<string, string>>({});
  const [planBusyId, setPlanBusyId] = useState("");
  const [planExpiry, setPlanExpiry] = useState<Record<string, string>>({});
  const [rules, setRules] = useState<FinanceRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [ruleBusy, setRuleBusy] = useState(false);
  const [ruleError, setRuleError] = useState("");
  const [ruleForm, setRuleForm] = useState({ ruleKey: "", title: "", category: "deduction", calculationType: "percentage", numericValue: "", formula: "", target: "incomeTaxDeduction", base: "grossAmount", institutionType: "", positionTitle: "", qualificationCategory: "", educationLevel: "", effectiveFrom: new Date().toISOString().slice(0, 10), sourceTitle: "", sourceReference: "", notes: "" });

  const load = async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/_api/institutions/list", { credentials: "include" });
      const data = superjson.parse<{ institutions?: Institution[]; message?: string }>(await response.text());
      if (!response.ok) throw new Error(data.message || "Рӯйхат дастрас нест.");
      setItems(data.institutions || []);
    } catch (e) { setError(e instanceof Error ? e.message : "Хатогӣ ҳангоми боркунӣ."); }
    finally { setLoading(false); }
  };

  const loadRules = async () => {
    setRulesLoading(true); setRuleError("");
    try {
      const response = await fetch("/_api/finance-rules/list", { credentials: "include" });
      const data = superjson.parse<{ rules?: FinanceRule[]; message?: string }>(await response.text());
      if (!response.ok) throw new Error(data.message || "Қоидаҳо дастрас нестанд.");
      setRules(data.rules || []);
    } catch (e) { setRuleError(e instanceof Error ? e.message : "Қоидаҳо бор карда нашуданд."); }
    finally { setRulesLoading(false); }
  };

  useEffect(() => { void load(); void loadRules(); }, []);

  const review = async (id: string, decision: "approved" | "rejected") => {
    setBusyId(id); setError("");
    try {
      const response = await fetch("/_api/institutions/review", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: superjson.stringify({ institutionId: id, decision, reviewNote: note[id] || "" }) });
      const data = superjson.parse<{ message?: string }>(await response.text());
      if (!response.ok) throw new Error(data.message || "Амалиёт иҷро нашуд.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Амалиёт иҷро нашуд."); }
    finally { setBusyId(""); }
  };

  const changePlan = async (id: string, plan: "free" | "pro") => {
    setPlanBusyId(id); setError("");
    try {
      const expiry = planExpiry[id];
      const response = await fetch("/_api/plans/update", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: superjson.stringify({ institutionId: id, plan, planExpiresAt: plan === "pro" && expiry ? new Date(`${expiry}T23:59:59`).toISOString() : null }) });
      const data = superjson.parse<{ message?: string }>(await response.text());
      if (!response.ok) throw new Error(data.message || "Тағйири нақша иҷро нашуд.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Тағйири нақша иҷро нашуд."); }
    finally { setPlanBusyId(""); }
  };

  const saveRule = async (event: React.FormEvent) => {
    event.preventDefault(); setRuleBusy(true); setRuleError("");
    try {
      const payload = {
        ...ruleForm,
        numericValue: ruleForm.calculationType === "formula" ? undefined : Number(ruleForm.numericValue),
        formula: ruleForm.calculationType === "formula" ? ruleForm.formula : undefined,
        sourceReference: ruleForm.sourceReference || undefined,
        notes: ruleForm.notes || undefined,
        appliesTo: { target: ruleForm.target, base: ruleForm.base, ...(ruleForm.institutionType ? { institutionType: ruleForm.institutionType } : {}), ...(ruleForm.positionTitle.trim() ? { positionTitle: ruleForm.positionTitle.trim() } : {}), ...(ruleForm.qualificationCategory.trim() ? { qualificationCategory: ruleForm.qualificationCategory.trim() } : {}), ...(ruleForm.educationLevel.trim() ? { educationLevel: ruleForm.educationLevel.trim() } : {}) },
      };
      const response = await fetch("/_api/finance-rules/save", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: superjson.stringify(payload),
      });
      const data = superjson.parse<{ message?: string }>(await response.text());
      if (!response.ok) throw new Error(data.message || "Қоида сабт нашуд.");
      setRuleForm({ ruleKey: "", title: "", category: "deduction", calculationType: "percentage", numericValue: "", formula: "", target: "incomeTaxDeduction", base: "grossAmount", institutionType: "", positionTitle: "", qualificationCategory: "", educationLevel: "", effectiveFrom: new Date().toISOString().slice(0, 10), sourceTitle: "", sourceReference: "", notes: "" });
      await loadRules();
    } catch (e) { setRuleError(e instanceof Error ? e.message : "Қоида сабт нашуд."); }
    finally { setRuleBusy(false); }
  };

  const pending = items.filter(x => x.status === "pending");
  return <main className={styles.page}>
    <header className={styles.header}><div className={styles.brand}><BrandMark size={42} className={styles.logoSvg}/><div><strong>TJS <span>Edu</span></strong><small>ПАНЕЛИ МАЪМУРИ АСОСӢ</small></div></div><Badge variant="success"><ShieldCheck size={13}/> Super Admin</Badge></header>
    <section className={styles.intro}><div><div className={styles.kicker}>ИДОРАКУНИИ ПЛАТФОРМА</div><h1>Баррасии муассисаҳо</h1><p>Дархостҳои бақайдгириро санҷед ва қарор қабул намоед.</p></div><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw size={16}/> Навсозӣ</Button></section>
    <section className={styles.metrics}><div><Building2/><span>Ҳамаи муассисаҳо</span><strong>{items.length}</strong></div><div><Clock3/><span>Дар интизорӣ</span><strong>{pending.length}</strong></div><div><Check/><span>Тасдиқшуда</span><strong>{items.filter(x => x.status === "approved").length}</strong></div></section>
    {error && <div className={styles.error}>{error}</div>}
    <section className={styles.panel}><div className={styles.panelHead}><div><h2>Дархостҳои муассисаҳо</h2><p>Қарорҳо дар пойгоҳи дода сабт мешаванд.</p></div><Badge variant="warning">{pending.length} дар интизорӣ</Badge></div>
      {loading ? <div className={styles.empty}>Рӯйхат бор мешавад...</div> : items.length === 0 ? <div className={styles.empty}>Ҳоло ягон муассиса сабт нашудааст.</div> : <div className={styles.list}>{items.map(item => <article className={styles.item} key={item.id}><div className={styles.itemTop}><div><h3>{item.name}</h3><p>{item.institutionType} · {item.region}</p></div><Badge variant={item.status === "approved" ? "success" : item.status === "rejected" ? "destructive" : "warning"}>{item.status === "approved" ? "Тасдиқшуда" : item.status === "rejected" ? "Радшуда" : "Дар интизорӣ"}</Badge></div><div className={styles.details}><span><b>Роҳбар:</b> {item.directorName}</span><span><b>Телефон:</b> {item.phone || "Нишон дода нашудааст"}</span><span><b>Сана:</b> {new Date(item.createdAt).toLocaleDateString("tg-TJ")}</span></div><div className={styles.planBox}><div><b>Нақшаи обуна:</b> <Badge variant={item.plan === "pro" ? "success" : "secondary"}>{item.plan === "pro" ? "PRO" : "FREE"}</Badge><p>{item.plan === "pro" ? (item.planExpiresAt ? `То ${new Date(item.planExpiresAt).toLocaleDateString("tg-TJ")}` : "Бе муҳлати анҷом") : "5 амалиёт дар ҳар модули маҳдуд"}</p></div><div className={styles.planActions}><input aria-label="Санаи анҷоми PRO" type="date" value={planExpiry[item.id] || (item.planExpiresAt ? new Date(item.planExpiresAt).toISOString().slice(0,10) : "")} onChange={e => setPlanExpiry(v => ({...v,[item.id]:e.target.value}))}/><Button size="sm" disabled={planBusyId === item.id || item.plan === "pro"} onClick={() => void changePlan(item.id,"pro")}>{planBusyId === item.id ? "Сабт..." : "Фаъол кардани PRO"}</Button><Button size="sm" variant="outline" disabled={planBusyId === item.id || item.plan !== "pro"} onClick={() => void changePlan(item.id,"free")}>Гузариш ба FREE</Button></div></div>{item.status === "pending" && <><textarea value={note[item.id] || ""} onChange={e => setNote(v => ({...v,[item.id]:e.target.value}))} placeholder="Шарҳи маъмур (ихтиёрӣ)"/><div className={styles.actions}><Button variant="outline" disabled={busyId === item.id} onClick={() => void review(item.id,"rejected")}><X size={15}/> Рад кардан</Button><Button disabled={busyId === item.id} onClick={() => void review(item.id,"approved")}><Check size={15}/> {busyId === item.id ? "Сабт..." : "Тасдиқ кардан"}</Button></div></>}</article>)}</div>}
    </section>
    <section className={styles.panel} style={{ marginTop: 24 }}>
      <div className={styles.panelHead}>
        <div><h2>Қоидаҳои марказии молиявӣ</h2><p>Меъёрҳои давлатӣ, фоизҳо ва формулаҳоро бо санаи амал сабт кунед. Версияҳои гузашта нигоҳ дошта мешаванд.</p></div>
        <Button variant="outline" onClick={() => void loadRules()} disabled={rulesLoading}><RefreshCw size={15}/> Навсозӣ</Button>
      </div>
      {ruleError && <div className={styles.error} style={{ marginTop: 14 }}>{ruleError}</div>}
      <form onSubmit={saveRule} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12, padding: "18px 0" }}>
        <label>Калиди қоида<input required value={ruleForm.ruleKey} onChange={e => setRuleForm(v => ({...v,ruleKey:e.target.value}))} placeholder="income_tax"/></label>
        <label>Номи қоида<input required value={ruleForm.title} onChange={e => setRuleForm(v => ({...v,title:e.target.value}))} placeholder="Фоизи андоз"/></label>
        <label>Гурӯҳ<select value={ruleForm.category} onChange={e => setRuleForm(v => ({...v,category:e.target.value}))}><option value="base_salary">Маоши асосӣ</option><option value="allowance">Иловапулӣ</option><option value="deduction">Нигоҳдошт</option><option value="work_hours">Соатҳои корӣ</option><option value="other">Дигар</option></select></label>
        <label>Навъи ҳисоб<select value={ruleForm.calculationType} onChange={e => setRuleForm(v => ({...v,calculationType:e.target.value}))}><option value="percentage">Фоиз</option><option value="fixed">Маблағи собит</option><option value="formula">Формулаи Excel</option></select></label>
        <label>Ба кадом қисми маош таъсир мекунад<select value={ruleForm.target} onChange={e => setRuleForm(v => ({...v,target:e.target.value}))}>
          <option value="baseAmount">Маоши асосӣ</option><option value="classHeadAllowance">Иловапулии роҳбарии синф</option><option value="notebookCheckingAllowance">Иловапулии санҷиши дафтар</option><option value="methodicalAssociationHeadAllowance">Иловапулии роҳбари иттиҳодияи методӣ</option><option value="otherAllowances">Дигар иловапулиҳо</option><option value="incomeTaxDeduction">Андоз аз даромад</option><option value="partyDuesDeduction">Ҳаққи ҳизб</option><option value="tradeUnionDuesDeduction">Ҳаққи иттифоқи касаба</option><option value="newspaperDeduction">Обуна ба рӯзнома</option><option value="otherDeductions">Дигар нигоҳдоштҳо</option><option value="weeklyHours">Соатҳои ҳафтаина</option>
        </select></label>
        {ruleForm.calculationType !== "fixed" && <label>Аз кадом маблағ ҳисоб шавад<select value={ruleForm.base} onChange={e => setRuleForm(v => ({...v,base:e.target.value}))}>
          <option value="baseAmount">Маоши асосӣ</option><option value="grossAmount">Маоши умумӣ (бо иловапулиҳо)</option><option value="allowances">Ҷамъи иловапулиҳо</option><option value="weeklyHours">Соатҳои ҳафтаина</option><option value="workRate">Меъёри корӣ</option><option value="workingDays">Рӯзҳои корӣ</option>
        </select></label>}
        {ruleForm.calculationType === "formula"
          ? <label style={{ gridColumn: "1 / -1" }}>Формула<input required value={ruleForm.formula} onChange={e => setRuleForm(v => ({...v,formula:e.target.value}))} placeholder="=ROUND(A2*0.13,2)"/><small style={{gridColumn:"1 / -1"}}>Дар формула: A1 маоши асосӣ, A2 маоши умумӣ, A3 соатҳои ҳафтаина, A4 меъёри корӣ, A5 иловапулиҳо, A6 рӯзҳои корӣ.</small></label>
          : <label>{ruleForm.calculationType === "percentage" ? "Фоиз (%)" : "Маблағ (сомонӣ)"}<input required type="number" step="0.0001" value={ruleForm.numericValue} onChange={e => setRuleForm(v => ({...v,numericValue:e.target.value}))}/></label>}
        <label>Навъи муассиса (ихтиёрӣ)<select value={ruleForm.institutionType} onChange={e => setRuleForm(v => ({...v,institutionType:e.target.value}))}><option value="">Ҳамаи муассисаҳо</option><option value="school">Мактаб</option><option value="college">Коллеҷ</option><option value="university">Донишгоҳ</option><option value="lyceum">Литсей</option><option value="gymnasium">Гимназия</option></select></label>
        <label>Вазифа (ихтиёрӣ)<input value={ruleForm.positionTitle} onChange={e => setRuleForm(v => ({...v,positionTitle:e.target.value}))} placeholder="Омӯзгор"/></label>
        <label>Категорияи тахассусӣ (ихтиёрӣ)<input value={ruleForm.qualificationCategory} onChange={e => setRuleForm(v => ({...v,qualificationCategory:e.target.value}))} placeholder="олӣ"/></label>
        <label>Маълумоти таҳсилот (ихтиёрӣ)<input value={ruleForm.educationLevel} onChange={e => setRuleForm(v => ({...v,educationLevel:e.target.value}))} placeholder="олӣ"/></label>
        <small style={{gridColumn:"1 / -1"}}>Фоиз барои маоши асосӣ ва соатҳои ҳафтаина ҳамчун зиёд/камшавӣ ҳисоб мешавад. Барои иловапулиҳо ва нигоҳдоштҳо фоизи маблағи интихобшуда ҳисоб карда мешавад.</small>\n        <label>Аз кадом сана амал мекунад<input required type="date" value={ruleForm.effectiveFrom} onChange={e => setRuleForm(v => ({...v,effectiveFrom:e.target.value}))}/></label>
        <label>Асоси ҳуқуқӣ / қарор<input required value={ruleForm.sourceTitle} onChange={e => setRuleForm(v => ({...v,sourceTitle:e.target.value}))} placeholder="Қарори Ҳукумати ҶТ ..."/></label>
        <label>Рақам ё пайванди ҳуҷҷат<input value={ruleForm.sourceReference} onChange={e => setRuleForm(v => ({...v,sourceReference:e.target.value}))}/></label>
        <label style={{ gridColumn: "1 / -1" }}>Шарҳ<textarea value={ruleForm.notes} onChange={e => setRuleForm(v => ({...v,notes:e.target.value}))}/></label>
        <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}><Button type="submit" disabled={ruleBusy}>{ruleBusy ? "Сабт мешавад..." : "Сабти қоидаи нав"}</Button></div>
      </form>
      <div className={styles.panelHead}><div><h3>Таърихи қоидаҳо</h3><p>Версияҳои кӯҳна нест карда намешаванд.</p></div><Badge>{rules.length} қоида</Badge></div>
      {rulesLoading ? <div className={styles.empty}>Бор мешавад...</div> : rules.length === 0 ? <div className={styles.empty}>Қоидаҳо ҳоло сабт нашудаанд.</div> : <div className={styles.list}>{rules.map(rule => <article className={styles.item} key={rule.id}>
        <div className={styles.itemTop}><div><h3>{rule.title}</h3><p>{rule.ruleKey} · {rule.category}</p></div><Badge variant={rule.effectiveTo ? "secondary" : "success"}>{rule.effectiveTo ? "Версияи гузашта" : "Версияи ҷорӣ"}</Badge></div>
        <div className={styles.details}><span><b>Қимат:</b> {rule.calculationType === "formula" ? rule.formula : rule.calculationType === "percentage" ? `${rule.numericValue}%` : `${rule.numericValue} сомонӣ`}</span><span><b>Аз:</b> {new Date(rule.effectiveFrom).toLocaleDateString("tg-TJ")}</span><span><b>То:</b> {rule.effectiveTo ? new Date(rule.effectiveTo).toLocaleDateString("tg-TJ") : "Ҳоло амал мекунад"}</span><span><b>Асос:</b> {rule.sourceTitle}</span></div>
      </article>)}</div>}
      <p style={{ fontSize: 12, color: "#8a6500", marginTop: 14 }}>Қоидаи фаъол ҳангоми сохтани табели нав ба қисми интихобшудаи маош татбиқ мешавад. Маблағи дастӣ воридшуда дар ҳамон майдон бо натиҷаи қоидаи марказӣ иваз мешавад. Қоида бояд санади расмӣ дошта бошад; фоизҳои андоз ё дигар меъёрҳоро худсарона ворид накунед.</p>
    </section>
    <footer className={styles.footerNote}>© 2026 TJS Edu · Муаллиф: Тоҷиддинов Сафармад</footer>
  </main>;
}