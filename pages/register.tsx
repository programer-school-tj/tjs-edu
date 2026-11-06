import React from "react";
import { Link } from "react-router-dom";
import { GraduationCap, UserPlus } from "lucide-react";
import { PasswordRegisterForm } from "../components/PasswordRegisterForm";
import styles from "./register.module.css";

export default function RegisterPage() {
  return <main className={styles.authPage}>
    <div className={styles.authBrand}><div className={styles.brandMark}><GraduationCap size={26} /></div><div><strong>TJS <span>Edu</span></strong><small>МАОРИФИ ТОҶИКИСТОН</small></div></div>
    <section className={styles.authCard}>
      <div className={styles.authIcon}><UserPlus size={22} /></div>
      <div className={styles.kicker}>ҲИСОБИ НАВ</div>
      <h1>Бақайдгирии корбар</h1>
      <p className={styles.description}>Ҳисоб эҷод кунед. Баъд аз воридшавӣ метавонед дархости пайваст кардани муассисаро пешниҳод намоед.</p>
      <PasswordRegisterForm />
      <div className={styles.authFoot}>Аллакай ҳисоб доред? <Link to="/login">Воридшавӣ</Link></div>
    </section>
    <footer className={styles.authFooter}>© 2026 TJS Edu · Муаллиф: Тоҷиддинов Сафармад</footer>
  </main>;
}