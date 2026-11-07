import React, { useEffect, useState } from "react";
import superjson from "superjson";
import { Check, X, RefreshCw, ShieldCheck, Clock3, Building2 } from "lucide-react";
import { BrandMark } from "../components/BrandMark";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import styles from "./admin.module.css";

type Institution = { id: string; name: string; institutionType: string; region: string; phone: string | null; directorName: string; status: string; createdAt: string; plan?: string; planExpiresAt?: string | null; };

export default function AdminPage() {
  const [items, setItems] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState<Record<string, string>>({});
  const [planBusyId, setPlanBusyId] = useState("");
  const [planExpiry, setPlanExpiry] = useState<Record<string, string>>({});

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

  useEffect(() => { void load(); }, []);

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

  const pending = items.filter(x => x.status === "pending");
  return <main className={styles.page}>
    <header className={styles.header}><div className={styles.brand}><BrandMark size={42} className={styles.logoSvg}/><div><strong>TJS <span>Edu</span></strong><small>ПАНЕЛИ МАЪМУРИ АСОСӢ</small></div></div><Badge variant="success"><ShieldCheck size={13}/> Super Admin</Badge></header>
    <section className={styles.intro}><div><div className={styles.kicker}>ИДОРАКУНИИ ПЛАТФОРМА</div><h1>Баррасии муассисаҳо</h1><p>Дархостҳои бақайдгириро санҷед ва қарор қабул намоед.</p></div><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw size={16}/> Навсозӣ</Button></section>
    <section className={styles.metrics}><div><Building2/><span>Ҳамаи муассисаҳо</span><strong>{items.length}</strong></div><div><Clock3/><span>Дар интизорӣ</span><strong>{pending.length}</strong></div><div><Check/><span>Тасдиқшуда</span><strong>{items.filter(x => x.status === "approved").length}</strong></div></section>
    {error && <div className={styles.error}>{error}</div>}
    <section className={styles.panel}><div className={styles.panelHead}><div><h2>Дархостҳои муассисаҳо</h2><p>Қарорҳо дар пойгоҳи дода сабт мешаванд.</p></div><Badge variant="warning">{pending.length} дар интизорӣ</Badge></div>
      {loading ? <div className={styles.empty}>Рӯйхат бор мешавад...</div> : items.length === 0 ? <div className={styles.empty}>Ҳоло ягон муассиса сабт нашудааст.</div> : <div className={styles.list}>{items.map(item => <article className={styles.item} key={item.id}><div className={styles.itemTop}><div><h3>{item.name}</h3><p>{item.institutionType} · {item.region}</p></div><Badge variant={item.status === "approved" ? "success" : item.status === "rejected" ? "destructive" : "warning"}>{item.status === "approved" ? "Тасдиқшуда" : item.status === "rejected" ? "Радшуда" : "Дар интизорӣ"}</Badge></div><div className={styles.details}><span><b>Роҳбар:</b> {item.directorName}</span><span><b>Телефон:</b> {item.phone || "Нишон дода нашудааст"}</span><span><b>Сана:</b> {new Date(item.createdAt).toLocaleDateString("tg-TJ")}</span></div><div className={styles.planBox}><div><b>Нақшаи обуна:</b> <Badge variant={item.plan === "pro" ? "success" : "secondary"}>{item.plan === "pro" ? "PRO" : "FREE"}</Badge><p>{item.plan === "pro" ? (item.planExpiresAt ? `То ${new Date(item.planExpiresAt).toLocaleDateString("tg-TJ")}` : "Бе муҳлати анҷом") : "5 амалиёт дар ҳар модули маҳдуд"}</p></div><div className={styles.planActions}><input aria-label="Санаи анҷоми PRO" type="date" value={planExpiry[item.id] || (item.planExpiresAt ? new Date(item.planExpiresAt).toISOString().slice(0,10) : "")} onChange={e => setPlanExpiry(v => ({...v,[item.id]:e.target.value}))}/><Button size="sm" disabled={planBusyId === item.id || item.plan === "pro"} onClick={() => void changePlan(item.id,"pro")}>{planBusyId === item.id ? "Сабт..." : "Фаъол кардани PRO"}</Button><Button size="sm" variant="outline" disabled={planBusyId === item.id || item.plan !== "pro"} onClick={() => void changePlan(item.id,"free")}>Гузариш ба FREE</Button></div></div>{item.status === "pending" && <><textarea value={note[item.id] || ""} onChange={e => setNote(v => ({...v,[item.id]:e.target.value}))} placeholder="Шарҳи маъмур (ихтиёрӣ)"/><div className={styles.actions}><Button variant="outline" disabled={busyId === item.id} onClick={() => void review(item.id,"rejected")}><X size={15}/> Рад кардан</Button><Button disabled={busyId === item.id} onClick={() => void review(item.id,"approved")}><Check size={15}/> {busyId === item.id ? "Сабт..." : "Тасдиқ кардан"}</Button></div></>}</article>)}</div>}
    </section>
    <footer className={styles.footerNote}>© 2026 TJS Edu · Муаллиф: Тоҷиддинов Сафармад</footer>
  </main>;
}