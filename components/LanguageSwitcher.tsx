import React from "react";
import { Languages } from "lucide-react";
import { AppLanguage, useLanguage } from "../helpers/i18n";
import styles from "./LanguageSwitcher.module.css";

const options: { value: AppLanguage; label: string }[] = [
  { value: "tg", label: "Тоҷикӣ" },
  { value: "ru", label: "Русский" },
  { value: "en", label: "English" },
  { value: "uz", label: "O‘zbekcha" },
  { value: "fa", label: "فارسی" }
];

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();
  return <label className={styles.switcher} title={t("language.name")}>
    <Languages size={15} aria-hidden="true" />
    <span className={styles.srOnly}>{t("language.name")}</span>
    <select aria-label={t("language.name")} value={language} onChange={(event) => setLanguage(event.target.value as AppLanguage)}>
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </label>;
}
