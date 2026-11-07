import React, { useEffect, useState } from "react";
import styles from "./PlanQuotaNotice.module.css";

type Props = { status: "warning" | "limit" | null; onClose: () => void };

export function PlanQuotaNotice({ status, onClose }: Props) {
  const [showPlans, setShowPlans] = useState(false);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setShowPlans(false);
    if (!status) { setVisible(false); return; }
    try {
      const lastPrompt = Number(localStorage.getItem("tjsedu-quota-prompt-at") || "0");
      if (Date.now() - lastPrompt < 10 * 60 * 1000) { setVisible(false); return; }
      localStorage.setItem("tjsedu-quota-prompt-at", String(Date.now()));
    } catch { /* If browser storage is unavailable, still show the quota notice. */ }
    setVisible(true);
  }, [status]);
  if (!status || !visible) return null;

  const limited = status === "limit";
  return (
    <div className={styles.overlay} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="plan-quota-title">
        <div className={styles.kicker}>TJS EDU · НАКШАИ ИСТИФОДА</div>
        <h2 id="plan-quota-title">{showPlans ? "Тарофаҳои TJS Edu" : limited ? "Лимити FREE пур шуд" : "Шумо ба лимити FREE наздик шудед"}</h2>
        {showPlans ? (
          <>
            <div className={styles.planGrid}>
              <article><strong>FREE</strong><b>5 амалиёт</b><span>Дар ҳар модул: ҷадвали дарсӣ, тарификатсия ва табели маош.</span></article>
              <article><strong>PRO</strong><b>Бемаҳдуд</b><span>Истифодаи бемаҳдуди модулҳои маҳдудшуда.</span></article>
            </div>
            <p className={styles.note}>Нарх ва пардохти онлайн ҳоло дар барнома фаъол нестанд. Барои фаъол кардани PRO ба маъмури платформа муроҷиат кунед. Маълумоти шумо ҳангоми гузариш ба PRO нигоҳ дошта мешавад.</p>
            <div className={styles.actions}><button className={styles.secondary} onClick={() => setShowPlans(false)}>Бозгашт</button><button className={styles.primary} onClick={onClose}>Фаҳмо</button></div>
          </>
        ) : (
          <>
            <p>{limited ? "Шумо 5 аз 5 амалиёти ройгони ин модулро истифода бурдед. Сабти нав то фаъол шудани PRO иҷозат дода намешавад." : "Шумо 4 аз 5 амалиёти ройгони ин модулро истифода бурдед. Як амалиёти ройгон боқӣ мондааст."}</p>
            <div className={styles.meter}><span style={{ width: limited ? "100%" : "80%" }} /></div>
            <div className={styles.meterLabel}>{limited ? "5 / 5 амалиёт истифода шуд" : "4 / 5 амалиёт истифода шуд"}</div>
            <div className={styles.actions}><button className={styles.secondary} onClick={onClose}>Баъдтар</button><button className={styles.primary} onClick={() => setShowPlans(true)}>Дидани тарофаҳо</button></div>
          </>
        )}
      </section>
    </div>
  );
}
