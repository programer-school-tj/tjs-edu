import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getInstitutions, postInstitution } from "../endpoints/institutions/create_POST.schema";
import { getClasses, getStudents } from "../helpers/educationClient";
import { getStaff } from "../helpers/staffClient";
import { Button } from "../components/Button";
import { useAuth } from "../helpers/useAuth";
import { Badge } from "../components/Badge";
import { Input } from "../components/Input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/Select";
import { ThemeModeSwitch } from "../components/ThemeModeSwitch";
import styles from "./_index.module.css";
import { BrandMark } from "../components/BrandMark";
import {
  Activity, ArrowDownRight, ArrowUpRight, Bell, BookOpen, Building2, CalendarCheck,
  CalendarDays, CheckCircle2, ChevronDown, CircleHelp, ClipboardList,
  GraduationCap, LayoutDashboard, Menu, Plus, Search, Settings,
  ShieldCheck, Users, Wallet, X, Crown
} from "lucide-react";

const navItems = [
  { label: "Шарҳи умумӣ", icon: LayoutDashboard },
  { label: "Муассисаҳо", icon: Building2 },
  { label: "Омӯзгорон ва кормандон", icon: Users },
  { label: "Хонандагон ва донишҷӯён", icon: GraduationCap },
  { label: "Синфҳо", icon: Users },
  { label: "Ҷадвали дарсҳо", icon: CalendarDays },
  { label: "Давомоти хонандагон", icon: CalendarCheck },
  { label: "Мавод ва дарсҳо", icon: BookOpen },
  { label: "Ҳисоб ва маош", icon: Wallet },
  { label: "Тарификатсия", icon: ClipboardList },
  { label: "Ҳисоботҳо", icon: ClipboardList },
  { label: "Роҳнамо ва омӯзиш", icon: CircleHelp },
  { label: "Тарофаҳо ва PRO", icon: Crown },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { authState } = useAuth();
  const visibleNavItems = authState.type === "authenticated" && authState.user.role === "admin" ? [...navItems, { label: "Маъмурияти платформа", icon: ShieldCheck }] : navItems;
  const [activeNav, setActiveNav] = useState("Шарҳи умумӣ");
  const [showRegistration, setShowRegistration] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [loadingInstitutions, setLoadingInstitutions] = useState(true);
  const [liveCounts, setLiveCounts] = useState({ staff: 0, students: 0, classes: 0 });
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [savingInstitution, setSavingInstitution] = useState(false);
  const [formData, setFormData] = useState({ name: "", phone: "", institutionType: "school" as "school" | "lyceum" | "gymnasium" | "college" | "university", region: "", directorName: "" });
  const [formError, setFormError] = useState("");

  const loadInstitutions = async () => {
    try { setInstitutions(await getInstitutions()); }
    catch (error) { console.error(error); }
    finally { setLoadingInstitutions(false); }
  };
  useEffect(() => { void loadInstitutions(); }, []);

  useEffect(() => {
    const approved = institutions.filter((item) => item.status === "approved");
    if (!approved.length) {
      setLiveCounts({ staff: 0, students: 0, classes: 0 });
      setLoadingCounts(false);
      return;
    }
    let cancelled = false;
    setLoadingCounts(true);
    void Promise.all(approved.map(async (institution) => {
      const [staff, students, classes] = await Promise.all([
        getStaff(institution.id),
        getStudents(institution.id),
        getClasses(institution.id),
      ]);
      return { staff: staff.length, students: students.length, classes: classes.length };
    })).then((results) => {
      if (cancelled) return;
      setLiveCounts(results.reduce((total, item) => ({
        staff: total.staff + item.staff,
        students: total.students + item.students,
        classes: total.classes + item.classes,
      }), { staff: 0, students: 0, classes: 0 }));
    }).catch((error) => {
      console.error("TJS Edu dashboard counts:", error);
    }).finally(() => {
      if (!cancelled) setLoadingCounts(false);
    });
    return () => { cancelled = true; };
  }, [institutions]);

  const handleInstitutionSubmit = async () => {
    setFormError("");
    if (!formData.name.trim() || !formData.region.trim() || !formData.directorName.trim()) {
      setFormError("Лутфан номи муассиса, маҳал ва номи роҳбарро пур кунед."); return;
    }
    setSavingInstitution(true);
    try {
      await postInstitution(formData);
      setShowRegistration(false);
      setFormData({ name: "", phone: "", institutionType: "school", region: "", directorName: "" });
      await loadInstitutions();
      window.alert("Дархости муассиса ба таври бомуваффақият сабт шуд. Он барои тасдиқ фиристода шуд.");
    } catch (error) { setFormError(error instanceof Error ? error.message : "Сабти муассиса иҷро нашуд."); }
    finally { setSavingInstitution(false); }
  };

  const filteredInstitutions = institutions.filter((item) =>
    `${item.name} ${item.institutionType} ${item.region}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={styles.appShell}>
      <aside className={`${styles.sidebar} ${mobileMenu ? styles.sidebarOpen : ""}`}>
        <div className={styles.brand}>
          <BrandMark size={42} className={styles.brandMarkSvg} />
          <div><div className={styles.brandName}>TJS <span>Edu</span></div><div className={styles.brandCaption}>МАОРИФИ ТОҶИКИСТОН</div></div>
          <button className={styles.mobileClose} onClick={() => setMobileMenu(false)} aria-label="Пӯшидан"><X size={19} /></button>
        </div>

        <div className={styles.workspaceLabel}>ПЛАТФОРМА</div>
        <nav className={styles.navigation}>
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            return <button key={item.label} className={`${styles.navItem} ${activeNav === item.label ? styles.navActive : ""}`} onClick={() => { if (item.label === "Маъмурияти платформа") { navigate("/admin"); return; } if (item.label === "Омӯзгорон ва кормандон") { navigate("/staff"); return; } if (item.label === "Хонандагон ва донишҷӯён") { navigate("/students"); return; } if (item.label === "Синфҳо") { navigate("/classes"); return; } if (item.label === "Ҷадвали дарсҳо") { navigate("/timetable"); return; } if (item.label === "Давомоти хонандагон") { navigate("/attendance"); return; } if (item.label === "Мавод ва дарсҳо") { navigate("/materials"); return; } if (item.label === "Ҳисоб ва маош") { navigate("/payroll"); return; } if (item.label === "Тарификатсия") { navigate("/tariffs"); return; } if (item.label === "Ҳисоботҳо") { navigate("/reports"); return; } if (item.label === "Роҳнамо ва омӯзиш") { navigate("/help"); return; } if (item.label === "Тарофаҳо ва PRO") { navigate("/plans"); return; } setActiveNav(item.label); setMobileMenu(false); }}>
              <Icon size={18} /><span>{item.label}</span>
            </button>;
          })}
        </nav>

        <div className={styles.sidebarBottom}>
          <div className={styles.helpCard}><div className={styles.helpIcon}><CircleHelp size={18} /></div><strong>Кӯмак лозим аст?</strong><p>Роҳнамо ва дастгирии TJS Edu</p><button onClick={() => { navigate("/help"); }}>Маркази кӯмак <span>↗</span></button></div>
          <button className={styles.navItem} onClick={() => setActiveNav("Танзимот")}><Settings size={18} /><span>Танзимот</span></button>
          <div className={styles.profileRow}><div className={styles.avatar}>{authState.type === "authenticated" ? (authState.user.displayName || authState.user.email).charAt(0).toUpperCase() : "?"}</div><div className={styles.profileText}><strong>{authState.type === "authenticated" ? (authState.user.displayName || authState.user.email) : "Корбар"}</strong><span>{authState.type === "authenticated" ? authState.user.email : "Санҷиши воридшавӣ..."}</span></div><ChevronDown size={16} /></div>
        </div>
      </aside>

      {mobileMenu && <button className={styles.backdrop} onClick={() => setMobileMenu(false)} aria-label="Пӯшидани меню" />}

      <main className={styles.mainArea}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}><Button variant="ghost" size="icon-md" className={styles.menuButton} onClick={() => setMobileMenu(true)}><Menu size={20} /></Button><div className={styles.breadcrumb}>Платформа <span>/</span> <strong>{activeNav}</strong></div></div>
          <div className={styles.topbarRight}><div className={styles.searchBox}><Search size={16} /><input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Ҷустуҷӯ..." /></div><ThemeModeSwitch /><button className={styles.iconButton} aria-label="Огоҳиномаҳо"><Bell size={18} /><i /></button><div className={styles.topAvatar}>С</div></div>
        </header>

        <div className={styles.pageContent}>
          <div className={styles.pageHeading}>
            <div><div className={styles.eyebrow}><span /> ПАНЕЛИ ИДОРАКУНИИ ПЛАТФОРМА</div><h1>{activeNav === "Шарҳи умумӣ" ? "Хуш омадед ба TJS Edu" : activeNav}</h1><p>Идоракунии ягонаи муассисаҳои таълимии Тоҷикистон</p></div>
            <Button onClick={() => setShowRegistration(true)}><Plus size={17} /> Иловаи муассиса</Button>
          </div>

          <div className={styles.notice}><div className={styles.noticeIcon}><ShieldCheck size={19} /></div><div><strong>Пайвастшавӣ ба пойгоҳи дода</strong><p>Маълумоти муассисаҳо аз пойгоҳи дода гирифта мешавад. Дархостҳои нав то тасдиқи маъмур дар интизорӣ мемонанд.</p></div><Badge variant="success">ОНЛАЙН</Badge></div>
          <section className={styles.plansBanner}><div className={styles.plansBannerIcon}><Crown size={22}/></div><div><strong>Имкониятҳои FREE ва PRO</strong><p>Аз имкониятҳои ройгон оғоз кунед ва ҳангоми зарурат ба истифодаи бемаҳдуд гузаред.</p></div><button onClick={() => navigate("/plans")}>Дидани тарофаҳо <span>→</span></button></section>

          <section className={styles.statsGrid}>
            <div className={styles.statCard}><div className={styles.statTop}><span>Ҳамаи муассисаҳо</span><div className={styles.statIcon}><Building2 size={18} /></div></div><div className={styles.statValue}>{institutions.length}</div><div className={styles.statFoot}><span className={styles.positive}><CheckCircle2 size={14} /> воқеӣ</span><span>муассисаҳои ҳисоби шумо</span></div><div className={styles.sparkline}><span style={{height:"35%"}}/><span style={{height:"48%"}}/><span style={{height:"42%"}}/><span style={{height:"60%"}}/><span style={{height:"52%"}}/><span style={{height:"72%"}}/><span style={{height:"66%"}}/><span style={{height:"88%"}}/></div></div>
            <div className={styles.statCard}><div className={styles.statTop}><span>Омӯзгорон ва кормандон</span><div className={styles.statIcon}><Users size={18} /></div></div><div className={styles.statValue}>{loadingCounts ? "…" : liveCounts.staff}</div><div className={styles.statFoot}><span>Маълумоти пойгоҳи дода</span><span>корманди фаъол ва ғайрифаъол</span></div></div>
            <div className={styles.statCard}><div className={styles.statTop}><span>Хонандагону донишҷӯён</span><div className={styles.statIcon}><GraduationCap size={18} /></div></div><div className={styles.statValue}>{loadingCounts ? "…" : liveCounts.students}</div><div className={styles.statFoot}><span>Маълумоти пойгоҳи дода</span><span>хонандагони муассисаҳои тасдиқшуда</span></div></div>
            <div className={styles.statCard}><div className={styles.statTop}><span>Дархостҳои нав</span><div className={styles.statIcon}><Activity size={18} /></div></div><div className={styles.statValue}>{institutions.filter((item) => item.status === "pending").length}</div><div className={styles.statFoot}><span className={styles.pendingText}><ArrowDownRight size={14} /> Дар интизорӣ</span><span>дархостҳои шумо</span></div></div>
          </section>

          <section className={styles.contentGrid}>
            <div className={styles.panel}>
              <div className={styles.panelHeader}><div><h2>Муассисаҳои охирин</h2><p>Муассисаҳои сабтшуда дар ҳисоби шумо</p></div><Button variant="outline" size="sm" onClick={() => setActiveNav("Муассисаҳо")}>Ҳамаи муассисаҳо <span>↗</span></Button></div>
              <div className={styles.tableWrap}><table><thead><tr><th>НОМИ МУАССИСА</th><th>НАМУД</th><th>МАҲАЛ</th><th>ҲОЛАТ</th><th>САНА</th></tr></thead><tbody>{filteredInstitutions.map((item) => <tr key={item.id}><td><div className={styles.institutionCell}><div className={styles.institutionIcon}><Building2 size={17} /></div><strong>{item.name}</strong></div></td><td>{{school:"Мактаб",lyceum:"Литсей",gymnasium:"Гимназия",college:"Коллеҷ",university:"Донишгоҳ"}[item.institutionType as string] || item.institutionType}</td><td>{item.region}</td><td><Badge variant={item.status === "approved" ? "success" : "warning"}><span className={styles.statusDot} />{item.status === "approved" ? "Тасдиқшуда" : item.status === "rejected" ? "Радшуда" : "Дар интизорӣ"}</Badge></td><td className={styles.dateCell}>{new Date(item.createdAt).toLocaleDateString("tg-TJ")}</td></tr>)}</tbody></table>{filteredInstitutions.length === 0 && <div className={styles.emptyState}>{loadingInstitutions ? "Рӯйхат бор мешавад..." : "Ҳоло муассиса сабт нашудааст."}</div>}</div>
              <div className={styles.tableFooter}><span>Намоиши {filteredInstitutions.length} муассиса</span><button onClick={() => setActiveNav("Муассисаҳо")}>Ба рӯйхати пурра <span>→</span></button></div>
            </div>

            <div className={styles.panelSide}>
              <div className={styles.panel}><div className={styles.panelHeader}><div><h2>Дархостҳо</h2><p>Вазъи бақайдгирӣ</p></div><Badge variant="warning">{institutions.filter((item) => item.status === "pending").length} нав</Badge></div><div className={styles.requestNumber}>{institutions.filter((item) => item.status === "pending").length.toString().padStart(2,"0")} <span>дар интизорӣ</span></div><div className={styles.requestProgress}><span style={{width: `${institutions.length ? institutions.filter((item) => item.status === "approved").length / institutions.length * 100 : 0}%`}} /></div><div className={styles.requestLegend}><span><i className={styles.dotGreen} /> Тасдиқшуда <b>{institutions.filter((item) => item.status === "approved").length}</b></span><span><i className={styles.dotAmber} /> Дар интизорӣ <b>{institutions.filter((item) => item.status === "pending").length}</b></span></div><Button variant="outline" className={styles.fullButton} onClick={() => setActiveNav("Муассисаҳо")}>Баррасии дархостҳо</Button></div>
              <div className={styles.tipCard}><div className={styles.tipIcon}><CheckCircle2 size={20} /></div><div><strong>Қадами аввал</strong><p>Муассисаи таълимиро ба платформа илова кунед ва маълумоти ибтидоии онро пур намоед.</p><button onClick={() => setShowRegistration(true)}>Оғози бақайдгирӣ <span>→</span></button></div></div>
            </div>
          </section>

          <footer className={styles.footer}><span>© 2026 TJS Edu · Платформаи идоракунии маориф</span><span>Муаллиф: Тоҷиддинов Сафармад</span></footer>
        </div>
      </main>

      {showRegistration && <div className={styles.modalBackdrop} role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowRegistration(false); }}><section className={styles.registrationModal} role="dialog" aria-modal="true" aria-labelledby="registration-title"><div className={styles.modalHeader}><div><div className={styles.eyebrow}>ҚАДАМИ 01 · БАҚАЙДГИРӢ</div><h2 id="registration-title">Иловаи муассисаи нав</h2><p>Маълумоти ибтидоии муассисаро ворид кунед.</p></div><button className={styles.iconButton} onClick={() => setShowRegistration(false)} aria-label="Пӯшидан"><X size={19} /></button></div><div className={styles.formGrid}><label>Номи муассиса<Input value={formData.name} onChange={(e) => setFormData(v => ({...v,name:e.target.value}))} placeholder="Масалан: МТМУ №14" /></label><label>Рақами тамос<Input value={formData.phone} onChange={(e) => setFormData(v => ({...v,phone:e.target.value}))} placeholder="+992 ..." /></label><label>Намуди муассиса<Select value={formData.institutionType} onValueChange={(value: any) => setFormData(v => ({...v,institutionType:value}))}><SelectTrigger className={styles.selectField}><SelectValue placeholder="Интихоб кунед" /></SelectTrigger><SelectContent><SelectItem value="school">Муассисаи таҳсилоти миёнаи умумӣ</SelectItem><SelectItem value="lyceum">Литсей</SelectItem><SelectItem value="gymnasium">Гимназия</SelectItem><SelectItem value="college">Коллеҷ</SelectItem><SelectItem value="university">Донишгоҳ</SelectItem></SelectContent></Select></label><label>Вилоят / шаҳр<Input value={formData.region} onChange={(e) => setFormData(v => ({...v,region:e.target.value}))} placeholder="Масалан: ш. Кӯлоб" /></label><label className={styles.fullField}>Номи роҳбар<Input value={formData.directorName} onChange={(e) => setFormData(v => ({...v,directorName:e.target.value}))} placeholder="Ному насаби директор ё роҳбар" /></label></div>{formError && <div className={styles.formError}>{formError}</div>}<div className={styles.modalNote}><ShieldCheck size={17} /><span>Дархост дар пойгоҳи дода сабт шуда, барои тасдиқи маъмури платформа фиристода мешавад.</span></div><div className={styles.modalActions}><Button variant="outline" onClick={() => setShowRegistration(false)}>Бекор кардан</Button><Button disabled={savingInstitution} onClick={handleInstitutionSubmit}>{savingInstitution ? "Сабт шуда истодааст..." : "Сабти дархост"} <span>→</span></Button></div></section></div>}
    </div>
  );
}