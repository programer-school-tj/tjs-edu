import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, Crown, ShieldCheck, Sparkles } from "lucide-react";
import { BrandMark } from "../components/BrandMark";
import styles from "./plans.module.css";

const features = [
  "Идоракунии муассиса, кормандон ва хонандагон",
  "Синфҳо, давомот ва маводи таълимӣ",
  "Ҳисобот ва чопи ҳуҷҷатҳо",
  "Дастрасӣ ба роҳнамо ва дастгирӣ",
];

export default function PlansPage() {
  return <main className={styles.page}>
    <header className={styles.header}><Link to="/" className={styles.back}><ArrowLeft size={17}/> Ба панели асосӣ</Link><div className={styles.brand}><BrandMark size={38}/><strong>TJS <span>Edu</span></strong></div></header>
    <section className={styles.intro}><div className={styles.kicker}>ТАРОФАҲОИ TJS EDU</div><h1>Нақшаи мувофиқро интихоб кунед</h1><p>Аз имкониятҳои асосӣ оғоз кунед. Ҳангоми зарурат ба PRO гузаред.</p></section>
    <section className={styles.grid}>
      <article className={styles.plan}><div className={styles.planHead}><div><span className={styles.planLabel}>ОҒОЗ БАРОИ ҲАМА</span><h2>FREE</h2></div><ShieldCheck size={28}/></div><p className={styles.price}>Ройгон</p><p className={styles.description}>Барои шиносоӣ ва истифодаи имкониятҳои асосии платформа.</p><ul>{features.map((feature)=><li key={feature}><Check size={16}/>{feature}</li>)}</ul><div className={styles.limit}><strong>5 амалиёт</strong><span>дар ҳар яке аз модулҳои тарификатсия, табели маош ва ҷадвали дарсӣ.</span></div><Link className={styles.freeButton} to="/">Истифодаи FREE</Link></article>
      <article className={styles.planPro}><div className={styles.planHead}><div><span className={styles.planLabel}>БАРОИ ИСТИФОДАИ ПУРРА</span><h2>PRO</h2></div><Crown size={30}/></div><p className={styles.price}>Нарх муайян карда мешавад</p><p className={styles.description}>Барои муассисаҳое, ки кори ҳаррӯзаро бе маҳдудияти амалиёт пеш мебаранд.</p><ul>{features.map((feature)=><li key={feature}><Check size={16}/>{feature}</li>)}<li><Sparkles size={16}/>Амалиёти бемаҳдуд дар модулҳои PRO</li><li><Sparkles size={16}/>Имкониятҳои иловагӣ ҳангоми дастрас шудан</li></ul><div className={styles.limitPro}><strong>PRO фаъол карда мешавад</strong><span>Пас аз тасдиқи маъмур ва шартҳои пардохт.</span></div><a className={styles.proButton} href="https://wa.me/992985979706" target="_blank" rel="noreferrer">Дархости фаъолсозии PRO</a></article>
    </section>
    <p className={styles.disclaimer}>Эзоҳ: пардохти онлайн ва нархномаи ниҳоӣ ҳоло фаъол нестанд. Барои пешгирӣ аз ҳисоббаробаркунии нодуруст, маблағи PRO то тасдиқи расмӣ нишон дода намешавад. Маълумоти муассиса ҳангоми гузариш ба PRO нигоҳ дошта мешавад.</p>
    <footer className={styles.footer}>© 2026 TJS Edu · Муаллиф: Тоҷиддинов Сафармад Ҷамолиждинович</footer>
  </main>;
}
