import React,{useEffect,useState}from"react";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useLanguage } from "../helpers/i18n";
import{useNavigate}from"react-router-dom";
import{getInstitutions}from"../endpoints/institutions/create_POST.schema";
import{getStaff}from"../helpers/staffClient";
import{getClasses,getStudents}from"../helpers/educationClient";
import{getPayroll,getTariffs,getTimetable}from"../helpers/financeScheduleClient";
import styles from"./reports.module.css";

export default function ReportsPage(){
 const {t}=useLanguage();
 const nav=useNavigate();const[schools,setSchools]=useState<any[]>([]);const[school,setSchool]=useState("");const[month,setMonth]=useState("2026-11");const[year,setYear]=useState("2026-2027");const[staff,setStaff]=useState<any[]>([]);const[classes,setClasses]=useState<any[]>([]);const[students,setStudents]=useState<any[]>([]);const[payroll,setPayroll]=useState<any[]>([]);const[tariffs,setTariffs]=useState<any[]>([]);const[timetable,setTimetable]=useState<any[]>([]);const[busy,setBusy]=useState(false);const[err,setErr]=useState("");
 useEffect(()=>{void getInstitutions().then(a=>{const v=a.filter((x:any)=>x.status==="approved");setSchools(v);if(v[0])setSchool(v[0].id);}).catch(e=>setErr(e.message));},[]);
 useEffect(()=>{if(!school)return;let live=true;setBusy(true);setErr("");void Promise.all([getStaff(school),getClasses(school),getStudents(school),getPayroll(school,month),getTariffs(school),getTimetable(school,year)]).then(([s,c,st,p,t,tt])=>{if(!live)return;setStaff(s);setClasses(c);setStudents(st);setPayroll(p);setTariffs(t);setTimetable(tt);}).catch(e=>{if(live)setErr(e instanceof Error?e.message:"Ҳисобот бор карда нашуд.");}).finally(()=>{if(live)setBusy(false);});return()=>{live=false};},[school,month,year]);
 const money=(n:number)=>Number(n||0).toLocaleString("tg-TJ",{minimumFractionDigits:2,maximumFractionDigits:2});
 const downloadPayrollCsv=()=>{
  const safe=(value:unknown)=>{
   const raw=String(value??"");
   const guarded=(/^[=+@-]/.test(raw)||raw.startsWith("\t")||raw.startsWith("\r"))?"'"+raw:raw;
   return '"'+guarded.replace(/"/g,'""')+'"';
  };
  const data=[
   ["Корманд","Вазифа","Моҳи ҳисоботӣ","Ҳисобшуда (сомонӣ)","Нигоҳдошт (сомонӣ)","Ба даст (сомонӣ)"],
   ...payroll.map(row=>[row.fullName,row.positionTitle,month,Number(row.grossAmount||0).toFixed(2),Number(row.deductions||0).toFixed(2),Number(row.netAmount||0).toFixed(2)])
  ];
  const csv="\uFEFF"+data.map(row=>row.map(safe).join(";")).join("\r\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;link.download="TJS-Edu-maosh-"+month+".csv";
  document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
 };const gross=payroll.reduce((a,r)=>a+Number(r.grossAmount||0),0);const net=payroll.reduce((a,r)=>a+Number(r.netAmount||0),0);const deductions=payroll.reduce((a,r)=>a+Number(r.deductions||0),0);
 return <main className={styles.page}><div className={styles.wrap}><header><div><small>TJS EDU · ҲИСОБОТ ВА ТАҲЛИЛ</small><h1>{t("reports.title")}</h1><p>{t("reports.subtitle")}</p></div><div className={styles.actions}><LanguageSwitcher /><button className={styles.print} onClick={()=>window.print()}>🖨 Чопи ҳисобот</button><button onClick={downloadPayrollCsv} disabled={!payroll.length||busy}>⬇ Excel (CSV)</button><button onClick={()=>nav("/")}>← Панели асосӣ</button></div></header>
 <section className={styles.filters}><label>{t("attendance.institution")}<select value={school} onChange={e=>setSchool(e.target.value)}>{schools.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>{t("reports.month")}<input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label><label>{t("reports.year")}<input value={year} onChange={e=>setYear(e.target.value)}/></label></section>
 {err&&<p className={styles.error}>{err}</p>}{busy&&<p className={styles.loading}>Маълумот бор шуда истодааст...</p>}
 <div className={styles.cards}><article><span>Омӯзгорону кормандон</span><b>{staff.length}</b></article><article><span>Синфҳо</span><b>{classes.length}</b></article><article><span>Хонандагон</span><b>{students.length}</b></article><article><span>Сатрҳои тарифӣ</span><b>{tariffs.length}</b></article><article><span>Дарсҳо дар ҷадвал</span><b>{timetable.length}</b></article></div>
 <section className={styles.panel}><h2>{t("reports.finance")} · {month}</h2><div className={styles.finance}><div><span>Шумораи кормандони маошгирифта</span><b>{payroll.length}</b></div><div><span>Маҷмӯи ҳисобшуда</span><b>{money(gross)} сомонӣ</b></div><div><span>Нигоҳдоштиҳо</span><b>{money(deductions)} сомонӣ</b></div><div><span>Ба даст</span><b>{money(net)} сомонӣ</b></div></div><div className={styles.table}><table><thead><tr><th>КОРМАНД</th><th>ВАЗИФА</th><th>ҲИСОБШУДА</th><th>НИГОҲДОШТ</th><th>БА ДАСТ</th></tr></thead><tbody>{payroll.map(r=><tr key={r.id}><td>{r.fullName}</td><td>{r.positionTitle}</td><td>{money(r.grossAmount)}</td><td>{money(r.deductions)}</td><td><b>{money(r.netAmount)}</b></td></tr>)}</tbody></table>{!payroll.length&&<p>Барои моҳи интихобшуда сабти маош нест.</p>}</div></section>
 <section className={styles.panel}><h2>{t("reports.staff")}</h2><div className={styles.table}><table><thead><tr><th>НОМУ НАСАБ</th><th>ВАЗИФА</th><th>НАМУДИ КОР</th><th>ФАН</th><th>ҲОЛАТ</th></tr></thead><tbody>{staff.map(s=><tr key={s.id}><td>{s.fullName}</td><td>{s.positionTitle}</td><td>{s.employmentType}</td><td>{s.subject||"—"}</td><td>{s.isActive?"Фаъол":"Ғайрифаъол"}</td></tr>)}</tbody></table>{!staff.length&&<p>Корманд сабт нашудааст.</p>}</div></section>
 <footer>© 2026 TJS Edu · Маълумот аз пойгоҳи додаи муассиса гирифта шудааст. Ҳисоботи молиявӣ бояд бо ҳуҷҷатҳои муҳосибӣ муқоиса шавад.</footer></div></main>
}