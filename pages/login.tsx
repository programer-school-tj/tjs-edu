import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { BrandMark } from "../components/BrandMark";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useLanguage } from "../helpers/i18n";
import { PasswordLoginForm } from "../components/PasswordLoginForm";
import styles from "./login.module.css";

export default function LoginPage() {
  const { t } = useLanguage();
  return <main className={styles.authPage}>
    <div className={styles.authTop}><div className={styles.authBrand}><BrandMark size={43} className={styles.brandMarkSvg} /><div><strong>TJS <span>Edu</span></strong><small>МАОРИФИ ТОҶИКИСТОН</small></div></div><LanguageSwitcher /></div>
    <section className={styles.authCard}>
      <div className={styles.authIcon}><ShieldCheck size={22} /></div>
      <div className={styles.kicker}>{t("auth.welcome")}</div>
      <h1>{t("auth.title")}</h1>
      <p className={styles.description}>{t("auth.description")}</p>
      <PasswordLoginForm />
      <div className={styles.authFoot}>{t("auth.noAccount")} <Link to="/register">{t("auth.register")}</Link></div>
    </section>
    <footer className={styles.authFooter}>© 2026 TJS Edu · Муаллиф: Тоҷиддинов Сафармад</footer>
  </main>;
}