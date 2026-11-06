import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, FileText, Link2, PlayCircle, Plus, Search, ExternalLink } from "lucide-react";
import { getInstitutions } from "../endpoints/institutions/create_POST.schema";
import { addMaterial, getMaterials, updateMaterial, uploadMaterialFile } from "../helpers/materialsClient";
import styles from "./materials.module.css";

const typeLabels: Record<string, string> = { lesson: "Дарс", pdf: "PDF", book: "Китоб", video: "Видео", link: "Пайванд" };
const typeIcons: Record<string, React.ElementType> = { lesson: BookOpen, pdf: FileText, book: BookOpen, video: PlayCircle, link: Link2 };

export default function MaterialsPage() {
  const navigate = useNavigate();
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [institutionId, setInstitutionId] = useState("");
  const [materials, setMaterials] = useState<any[]>([]);
  const [gradeFilter, setGradeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", subject: "", grade: "", materialType: "pdf", resourceUrl: "", academicYear: "2026-2027" });

  useEffect(() => {
    void getInstitutions().then((rows) => {
      const approved = rows.filter((item: any) => item.status === "approved");
      setInstitutions(approved);
      if (approved[0]) setInstitutionId(approved[0].id);
    }).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!institutionId) return;
    void getMaterials(institutionId, gradeFilter).then(setMaterials).catch((e) => setError(e.message));
  }, [institutionId, gradeFilter]);

  const filtered = useMemo(() => materials.filter((item) => `${item.title} ${item.subject || ""} ${item.description || ""}`.toLowerCase().includes(search.toLowerCase())), [materials, search]);
  const update = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(""); setNotice("");
    setSaving(true);
    try {
      if (editingId) {
        const current = materials.find((item) => item.id === editingId);
        await updateMaterial({ institutionId, materialId: editingId, ...form, grade: form.grade ? Number(form.grade) : null, materialType: form.materialType as "lesson" | "pdf" | "book" | "video" | "link", isPublished: Boolean(current?.isPublished) });
      } else {
        const resourceUrl = selectedFile ? await uploadMaterialFile(institutionId, selectedFile) : form.resourceUrl;
        if (!resourceUrl) throw new Error("Файлро интихоб кунед ё пайванди интернетиро ворид намоед.");
        await addMaterial({ institutionId, ...form, resourceUrl, grade: form.grade ? Number(form.grade) : null, materialType: form.materialType as "lesson" | "pdf" | "book" | "video" | "link" });
      }
      setForm({ title: "", description: "", subject: "", grade: "", materialType: "pdf", resourceUrl: "", academicYear: "2026-2027" });
      setSelectedFile(null);
      setEditingId(null);
      setShowForm(false);
      setMaterials(await getMaterials(institutionId, gradeFilter));
      setNotice("Мавод бомуваффақият сабт шуд.");
    } catch (e) { setError(e instanceof Error ? e.message : "Сабти мавод иҷро нашуд."); }
    finally { setSaving(false); }
  };

  const beginEdit = (item: any) => {
    setEditingId(item.id);
    setForm({ title: item.title || "", description: item.description || "", subject: item.subject || "", grade: item.grade ? String(item.grade) : "", materialType: item.materialType || "pdf", resourceUrl: "", academicYear: item.academicYear || "2026-2027" });
    setSelectedFile(null);
    setShowForm(true);
    setError(""); setNotice("");
  };

  const togglePublish = async (item: any) => {
    setError(""); setNotice("");
    try {
      await updateMaterial({ institutionId, materialId: item.id, title: item.title, description: item.description || "", subject: item.subject || "", grade: item.grade ?? null, materialType: item.materialType, academicYear: item.academicYear || "2026-2027", isPublished: !item.isPublished });
      setMaterials(await getMaterials(institutionId, gradeFilter));
      setNotice(item.isPublished ? "Мавод пинҳон карда шуд." : "Мавод нашр шуд.");
    } catch (e) { setError(e instanceof Error ? e.message : "Тағйири ҳолати нашр иҷро нашуд."); }
  };

  return <main className={styles.page}><div className={styles.wrap}>
    <header className={styles.header}><div><div className={styles.eyebrow}>TJS EDU · ЗАХИРАИ ТАЪЛИМӢ</div><h1>Мавод ва дарсҳо</h1><p>Китобҳо, дастурҳо, видеоҳо ва маводи таълимии муассиса</p></div><div className={styles.headerActions}><button className={styles.back} onClick={() => navigate("/")}>← Панели асосӣ</button><button className={styles.primary} onClick={() => { setEditingId(null); setSelectedFile(null); setForm({ title: "", description: "", subject: "", grade: "", materialType: "pdf", resourceUrl: "", academicYear: "2026-2027" }); setShowForm((value) => !value); }}><Plus size={17} /> Иловаи мавод</button></div></header>
    {error && <div className={styles.error}>{error}</div>}{notice && <div className={styles.notice}>{notice}</div>}
    <section className={styles.filters}><label>Муассиса<select value={institutionId} onChange={(e) => setInstitutionId(e.target.value)}>{institutions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Синф<select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)}><option value="all">Ҳамаи синфҳо</option>{Array.from({ length: 11 }, (_, i) => i + 1).map((n) => <option key={n} value={String(n)}>{n}-ум синф</option>)}</select></label><label className={styles.search}><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ҷустуҷӯи мавод..." /></label></section>
    {showForm && <section className={styles.panel}><div className={styles.panelTitle}><h2>{editingId ? "Таҳрири мавод" : "Иловаи маводи нав"}</h2><span>{editingId ? "Маълумоти маводро нав кунед" : "Файл ё пайванди интернетӣ"}</span></div><form onSubmit={submit} className={styles.form}>
      <label>Номи мавод *<input required minLength={3} value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="Масалан: Китоби информатика, синфи 7" /></label>
      <label>Навъи мавод<select value={form.materialType} onChange={(e) => update("materialType", e.target.value)}>{Object.entries(typeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>Фан<input value={form.subject} onChange={(e) => update("subject", e.target.value)} placeholder="Масалан: Информатика" /></label>
      <label>Синф<select value={form.grade} onChange={(e) => update("grade", e.target.value)}><option value="">Барои ҳамаи синфҳо</option>{Array.from({ length: 11 }, (_, i) => i + 1).map((n) => <option key={n} value={String(n)}>{n}-ум синф</option>)}</select></label>
      {!editingId && <><label className={styles.wide}>Боркунии файл (PDF, DOC, DOCX, PPT, PPTX, то 30 МБ)<input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} /></label>
      {selectedFile && <div className={`${styles.uploadNote} ${styles.wide}`}>Файли интихобшуда: {selectedFile.name} · {(selectedFile.size / (1024 * 1024)).toFixed(2)} МБ</div>}
      <label className={styles.wide}>Ё пайванди интернетӣ<input type="url" value={form.resourceUrl} onChange={(e) => update("resourceUrl", e.target.value)} placeholder="https://..." /></label></>}
      <label className={styles.wide}>Тавсиф<textarea rows={3} value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Маълумоти кӯтоҳ дар бораи мавод" /></label>
      <label>Соли таҳсил<input required value={form.academicYear} onChange={(e) => update("academicYear", e.target.value)} /></label>
      <div className={`${styles.uploadNote} ${styles.wide}`}>Файл дар захираи хусусии муассиса нигоҳ дошта мешавад. Ҳаҷми ҳадди аксар 30 МБ.</div>
      <div className={`${styles.actions} ${styles.wide}`}><button type="button" className={styles.back} onClick={() => setShowForm(false)}>Бекор кардан</button><button className={styles.primary} disabled={saving || !institutionId}>{saving ? "Сабт шуда истодааст..." : editingId ? "Нигоҳ доштани тағйирот" : "Сабти мавод"}</button></div>
    </form></section>}
    <section className={styles.summary}><div><strong>{materials.length}</strong><span>Ҳамаи мавод</span></div><div><strong>{materials.filter((m) => m.materialType === "pdf" || m.materialType === "book").length}</strong><span>PDF ва китобҳо</span></div><div><strong>{materials.filter((m) => m.materialType === "video").length}</strong><span>Видеоҳо</span></div></section>
    <section className={styles.materialGrid}>{filtered.map((item) => { const Icon = typeIcons[item.materialType] || FileText; return <article className={styles.materialCard} key={item.id}><div className={styles.cardTop}><span className={styles.fileIcon}><Icon size={21} /></span><span className={styles.type}>{typeLabels[item.materialType] || item.materialType}</span><span className={item.isPublished ? styles.published : styles.draft}>{item.isPublished ? "Нашр шудааст" : "Лоиҳа"}</span></div><h3>{item.title}</h3><p>{item.description || "Тавсиф илова нашудааст."}</p><div className={styles.meta}><span>{item.subject || "Фан муайян нашудааст"}</span><span>{item.grade ? `${item.grade}-ум синф` : "Ҳамаи синфҳо"}</span></div><div className={styles.cardActions}><a href={item.resourceUrl} target="_blank" rel="noopener noreferrer">Кушодани мавод <ExternalLink size={14} /></a><button type="button" className={styles.smallAction} onClick={() => beginEdit(item)}>Таҳрир</button><button type="button" className={styles.smallAction} onClick={() => void togglePublish(item)}>{item.isPublished ? "Пинҳон кардан" : "Нашр кардан"}</button></div></article>; })}{filtered.length === 0 && <div className={styles.empty}>{materials.length ? "Маводи мувофиқ ёфт нашуд." : "Ҳоло маводи таълимӣ илова нашудааст."}</div>}</section>
    <footer className={styles.footer}>© 2026 TJS Edu · Мавод танҳо барои муассисаи интихобшуда нигоҳ дошта мешавад.</footer>
  </div></main>;
}