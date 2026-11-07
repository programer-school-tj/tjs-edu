import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";

export type AppLanguage = "tg" | "ru" | "en" | "uz" | "fa";

const messages: Record<AppLanguage, Record<string, string>> = {
  tg: {
    "language.name":"Забон",
    "finance.tariffsTitle":"Тарификатсия","finance.tariffsSubtitle":"Меъёрҳои маош ва маълумоти тахассусии кормандон","finance.payrollTitle":"Табели маош","finance.payrollSubtitle":"Ҳисоб ва сабти музди меҳнати кормандон","finance.timetableTitle":"Ҷадвали дарсӣ","finance.timetableSubtitle":"Тартибдиҳӣ ва идоракунии ҷадвали дарсҳо","common.printA4":"Чопи A4","common.mainDashboard":"Панели асосӣ","common.institution":"Муассиса", "nav.overview":"Шарҳи умумӣ", "nav.institutions":"Муассисаҳо",
    "nav.staff":"Омӯзгорон ва кормандон", "nav.students":"Хонандагон ва донишҷӯён",
    "nav.classes":"Синфҳо", "nav.timetable":"Ҷадвали дарсҳо", "nav.attendance":"Давомоти хонандагон",
    "nav.materials":"Мавод ва дарсҳо", "nav.payroll":"Ҳисоб ва маош", "nav.tariffs":"Тарификатсия",
    "nav.reports":"Ҳисоботҳо", "nav.help":"Роҳнамо ва омӯзиш", "nav.plans":"Тарофаҳо ва PRO",
    "nav.admin":"Маъмурияти платформа", "dashboard.title":"Хуш омадед ба TJS Edu",
    "dashboard.subtitle":"Идоракунии ягонаи муассисаҳои таълимии Тоҷикистон",
    "dashboard.addInstitution":"Иловаи муассиса", "dashboard.search":"Ҷустуҷӯ...",
    "dashboard.platform":"Платформа", "dashboard.overview":"ПАНЕЛИ ИДОРАКУНИИ ПЛАТФОРМА",
    "dashboard.connection":"Пайвастшавӣ ба пойгоҳи дода",
    "dashboard.connectionText":"Маълумоти муассисаҳо аз пойгоҳи дода гирифта мешавад. Дархостҳои нав то тасдиқи маъмур дар интизорӣ мемонанд.",
    "dashboard.plans":"Имкониятҳои FREE ва PRO",
    "dashboard.plansText":"Аз имкониятҳои ройгон оғоз кунед ва ҳангоми зарурат ба истифодаи бемаҳдуд гузаред.",
    "dashboard.viewPlans":"Дидани тарофаҳо", "dashboard.heroTitle":"Идоракунии муассисаи таълимӣ осонтар мешавад",
    "dashboard.heroText":"Тарификатсия, табели маош ва ҷадвали дарсӣ дар як платформа.",
    "dashboard.start":"Оғози кор", "dashboard.institutionsTitle":"Ҳамаи муассисаҳо",
    "dashboard.staffTitle":"Омӯзгорон ва кормандон", "dashboard.learnersTitle":"Хонандагону донишҷӯён",
    "dashboard.pendingTitle":"Дархостҳои нав", "dashboard.online":"ОНЛАЙН",
    "auth.welcome":"ХУШ ОМАДЕД", "auth.title":"Ба система ворид шавед",
    "auth.description":"Барои идоракунии муассисаи таълимии худ ба ҳисоби корбарӣ ворид шавед.",
    "auth.noAccount":"Ҳанӯз ҳисоб надоред?", "auth.register":"Бақайдгирӣ"
  },
  ru: {
    "language.name":"Язык",
    "finance.tariffsTitle":"Тарификация","finance.tariffsSubtitle":"Нормы оплаты и квалификационные сведения сотрудников","finance.payrollTitle":"Зарплатная ведомость","finance.payrollSubtitle":"Расчёт и учёт оплаты труда сотрудников","finance.timetableTitle":"Расписание уроков","finance.timetableSubtitle":"Составление и управление расписанием уроков","common.printA4":"Печать A4","common.mainDashboard":"Главная панель","common.institution":"Учреждение", "nav.overview":"Обзор", "nav.institutions":"Учреждения",
    "nav.staff":"Учителя и сотрудники", "nav.students":"Ученики и студенты", "nav.classes":"Классы",
    "nav.timetable":"Расписание уроков", "nav.attendance":"Посещаемость", "nav.materials":"Материалы и уроки",
    "nav.payroll":"Расчёт и зарплата", "nav.tariffs":"Тарификация", "nav.reports":"Отчёты",
    "nav.help":"Руководство и обучение", "nav.plans":"Тарифы и PRO", "nav.admin":"Администрирование платформы",
    "dashboard.title":"Добро пожаловать в TJS Edu", "dashboard.subtitle":"Единое управление образовательными учреждениями Таджикистана",
    "dashboard.addInstitution":"Добавить учреждение", "dashboard.search":"Поиск...",
    "dashboard.platform":"Платформа", "dashboard.overview":"ПАНЕЛЬ УПРАВЛЕНИЯ ПЛАТФОРМОЙ",
    "dashboard.connection":"Подключение к базе данных",
    "dashboard.connectionText":"Данные учреждений загружаются из базы данных. Новые заявки ожидают подтверждения администратора.",
    "dashboard.plans":"Возможности FREE и PRO",
    "dashboard.plansText":"Начните с бесплатных возможностей и при необходимости перейдите на безлимитный доступ.",
    "dashboard.viewPlans":"Посмотреть тарифы", "dashboard.heroTitle":"Управлять учебным заведением стало проще",
    "dashboard.heroText":"Тарификация, зарплатная ведомость и расписание в одной платформе.",
    "dashboard.start":"Начать работу", "dashboard.institutionsTitle":"Всего учреждений",
    "dashboard.staffTitle":"Учителя и сотрудники", "dashboard.learnersTitle":"Ученики и студенты",
    "dashboard.pendingTitle":"Новые заявки", "dashboard.online":"ОНЛАЙН",
    "auth.welcome":"ДОБРО ПОЖАЛОВАТЬ", "auth.title":"Войдите в систему",
    "auth.description":"Войдите в учётную запись для управления своим учебным заведением.",
    "auth.noAccount":"Ещё нет аккаунта?", "auth.register":"Регистрация"
  },
  en: {
    "language.name":"Language",
    "finance.tariffsTitle":"Tariffing","finance.tariffsSubtitle":"Pay rates and staff qualification details","finance.payrollTitle":"Payroll register","finance.payrollSubtitle":"Staff salary calculation and records","finance.timetableTitle":"Timetable","finance.timetableSubtitle":"Create and manage the lesson timetable","common.printA4":"Print A4","common.mainDashboard":"Main dashboard","common.institution":"Institution", "nav.overview":"Overview", "nav.institutions":"Institutions",
    "nav.staff":"Teachers and staff", "nav.students":"Pupils and students", "nav.classes":"Classes",
    "nav.timetable":"Timetable", "nav.attendance":"Attendance", "nav.materials":"Materials and lessons",
    "nav.payroll":"Payroll", "nav.tariffs":"Tariffing", "nav.reports":"Reports",
    "nav.help":"Guides and training", "nav.plans":"Plans and PRO", "nav.admin":"Platform administration",
    "dashboard.title":"Welcome to TJS Edu", "dashboard.subtitle":"Unified management of educational institutions in Tajikistan",
    "dashboard.addInstitution":"Add institution", "dashboard.search":"Search...",
    "dashboard.platform":"Platform", "dashboard.overview":"PLATFORM DASHBOARD",
    "dashboard.connection":"Database connection",
    "dashboard.connectionText":"Institution data is loaded from the database. New applications remain pending until approved by an administrator.",
    "dashboard.plans":"FREE and PRO features",
    "dashboard.plansText":"Start with free features and upgrade to unlimited access when needed.",
    "dashboard.viewPlans":"View plans", "dashboard.heroTitle":"Educational institution management made easier",
    "dashboard.heroText":"Tariffing, payroll and timetable in one platform.",
    "dashboard.start":"Get started", "dashboard.institutionsTitle":"All institutions",
    "dashboard.staffTitle":"Teachers and staff", "dashboard.learnersTitle":"Pupils and students",
    "dashboard.pendingTitle":"New requests", "dashboard.online":"ONLINE",
    "auth.welcome":"WELCOME", "auth.title":"Sign in to your account",
    "auth.description":"Sign in to manage your educational institution.",
    "auth.noAccount":"Don't have an account yet?", "auth.register":"Register"
  },
  uz: {
    "language.name":"Til",
    "finance.tariffsTitle":"Tarifikatsiya","finance.tariffsSubtitle":"Ish haqi me’yorlari va xodimlarning malaka ma’lumotlari","finance.payrollTitle":"Ish haqi jadvali","finance.payrollSubtitle":"Xodimlar ish haqini hisoblash va qayd etish","finance.timetableTitle":"Dars jadvali","finance.timetableSubtitle":"Dars jadvalini tuzish va boshqarish","common.printA4":"A4 chop etish","common.mainDashboard":"Asosiy panel","common.institution":"Muassasa", "nav.overview":"Umumiy ko‘rinish", "nav.institutions":"Muassasalar",
    "nav.staff":"O‘qituvchilar va xodimlar", "nav.students":"O‘quvchilar va talabalar", "nav.classes":"Sinflar",
    "nav.timetable":"Dars jadvali", "nav.attendance":"Davomat", "nav.materials":"Materiallar va darslar",
    "nav.payroll":"Hisob-kitob va maosh", "nav.tariffs":"Tarifikatsiya", "nav.reports":"Hisobotlar",
    "nav.help":"Qo‘llanma va ta’lim", "nav.plans":"Tariflar va PRO", "nav.admin":"Platforma boshqaruvi",
    "dashboard.title":"TJS Edu platformasiga xush kelibsiz", "dashboard.subtitle":"Tojikiston ta’lim muassasalarini yagona boshqarish tizimi",
    "dashboard.addInstitution":"Muassasa qo‘shish", "dashboard.search":"Qidirish...",
    "dashboard.platform":"Platforma", "dashboard.overview":"PLATFORMANI BOSHQARISH PANELI",
    "dashboard.connection":"Ma’lumotlar bazasiga ulanish",
    "dashboard.connectionText":"Muassasalar ma’lumotlari bazadan olinadi. Yangi arizalar administrator tasdig‘ini kutadi.",
    "dashboard.plans":"FREE va PRO imkoniyatlari",
    "dashboard.plansText":"Bepul imkoniyatlardan boshlang va zarur bo‘lganda cheksiz tarifga o‘ting.",
    "dashboard.viewPlans":"Tariflarni ko‘rish", "dashboard.heroTitle":"Ta’lim muassasasini boshqarish endi osonroq",
    "dashboard.heroText":"Tarifikatsiya, ish haqi jadvali va dars jadvali bir platformada.",
    "dashboard.start":"Ishni boshlash", "dashboard.institutionsTitle":"Barcha muassasalar",
    "dashboard.staffTitle":"O‘qituvchilar va xodimlar", "dashboard.learnersTitle":"O‘quvchilar va talabalar",
    "dashboard.pendingTitle":"Yangi arizalar", "dashboard.online":"ONLAYN",
    "auth.welcome":"XUSH KELIBSIZ", "auth.title":"Tizimga kiring",
    "auth.description":"Ta’lim muassasangizni boshqarish uchun hisobingizga kiring.",
    "auth.noAccount":"Hali hisobingiz yo‘qmi?", "auth.register":"Ro‘yxatdan o‘tish"
  },
  fa: {
    "language.name":"زبان",
    "finance.tariffsTitle":"تعرفه‌بندی","finance.tariffsSubtitle":"معیارهای معاش و اطلاعات تخصصی کارکنان","finance.payrollTitle":"جدول معاش","finance.payrollSubtitle":"محاسبه و ثبت معاش کارکنان","finance.timetableTitle":"برنامهٔ درسی","finance.timetableSubtitle":"تنظیم و مدیریت برنامهٔ درسی","common.printA4":"چاپ A4","common.mainDashboard":"داشبورد اصلی","common.institution":"مؤسسه", "nav.overview":"نمای کلی", "nav.institutions":"مؤسسات",
    "nav.staff":"معلمان و کارکنان", "nav.students":"دانش‌آموزان و دانشجویان", "nav.classes":"صنف‌ها",
    "nav.timetable":"برنامهٔ درسی", "nav.attendance":"حاضری", "nav.materials":"مواد و درس‌ها",
    "nav.payroll":"محاسبه و معاش", "nav.tariffs":"تعرفه‌بندی", "nav.reports":"گزارش‌ها",
    "nav.help":"راهنما و آموزش", "nav.plans":"تعرفه‌ها و PRO", "nav.admin":"مدیریت پلتفرم",
    "dashboard.title":"به TJS Edu خوش آمدید", "dashboard.subtitle":"مدیریت یکپارچهٔ مؤسسات آموزشی تاجیکستان",
    "dashboard.addInstitution":"افزودن مؤسسه", "dashboard.search":"جستجو...",
    "dashboard.platform":"پلتفرم", "dashboard.overview":"داشبورد مدیریت پلتفرم",
    "dashboard.connection":"اتصال به پایگاه داده",
    "dashboard.connectionText":"اطلاعات مؤسسات از پایگاه داده دریافت می‌شود. درخواست‌های جدید تا تأیید مدیر در انتظار می‌مانند.",
    "dashboard.plans":"امکانات FREE و PRO",
    "dashboard.plansText":"با امکانات رایگان آغاز کنید و در صورت نیاز به دسترسی نامحدود ارتقا دهید.",
    "dashboard.viewPlans":"مشاهده تعرفه‌ها", "dashboard.heroTitle":"مدیریت مؤسسهٔ آموزشی آسان‌تر می‌شود",
    "dashboard.heroText":"تعرفه‌بندی، جدول معاش و برنامهٔ درسی در یک پلتفرم.",
    "dashboard.start":"شروع کار", "dashboard.institutionsTitle":"همهٔ مؤسسات",
    "dashboard.staffTitle":"معلمان و کارکنان", "dashboard.learnersTitle":"دانش‌آموزان و دانشجویان",
    "dashboard.pendingTitle":"درخواست‌های جدید", "dashboard.online":"آنلاین",
    "auth.welcome":"خوش آمدید", "auth.title":"وارد سیستم شوید",
    "auth.description":"برای مدیریت مؤسسهٔ آموزشی خود وارد حساب کاربری شوید.",
    "auth.noAccount":"هنوز حساب ندارید؟", "auth.register":"ثبت‌نام"
  }
};

type LanguageContextValue = { language: AppLanguage; setLanguage: (language: AppLanguage) => void; t: (key: string) => string };
const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(() => {
    try {
      const saved = window.localStorage.getItem("tjs-edu-language");
      return saved && saved in messages ? saved as AppLanguage : "tg";
    } catch { return "tg"; }
  });
  const setLanguage = useCallback((next: AppLanguage) => {
    setLanguageState(next);
    try { window.localStorage.setItem("tjs-edu-language", next); } catch { /* storage may be unavailable */ }
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "fa" ? "rtl" : "ltr";
  }, [language]);
  const value = useMemo(() => ({
    language, setLanguage,
    t: (key: string) => messages[language][key] ?? messages.tg[key] ?? key
  }), [language, setLanguage]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}
