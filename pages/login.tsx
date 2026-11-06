import React from "react";
import { Link } from "react-router-dom";
import { GraduationCap, ShieldCheck } from "lucide-react";
import { PasswordLoginForm } from "../components/PasswordLoginForm";
import styles from "./login.module.css";

export default function LoginPage() {
  return <main className={styles.authPage}>
    <div className={styles.authBrand}><div className={styles.brandMark}><GraduationCap size={26} /></div><div><strong>TJS <span>Edu</span></strong><small>МАОРИФИ ТОҶИКИСТОН</small></div></div>
    <section className={styles.authCard}>
      <div className={styles.authIcon}><ShieldCheck size={22} /></div>
      <div className={styles.kicker}>ХУШ ОМАДЕД</div>
      <h1>Ба система ворид шавед</h1>
      <p className={styles.description}>Барои идоракунии муассисаи таълимии худ ба ҳисоби корбарӣ ворид шавед.</p>
      <PasswordLoginForm />
      <div className={styles.authFoot}>Ҳанӯз ҳисоб надоред? <Link to="/register">Бақайдгирӣ</Link></div>
    </section>
    <footer className={styles.authFooter}>© 2026 TJS Edu · Муаллиф: Тоҷиддинов Сафармад</footer>
  </main>;
}