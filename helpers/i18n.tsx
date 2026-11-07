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
    "auth.noAccount":"Ҳанӯз ҳисоб надоред?", "auth.register":"Бақайдгирӣ",
    "reports.title":"Ҳисоботҳои муассиса","reports.subtitle":"Ҷамъбасти кадрҳо, хонандагон, тарифҳо ва маош","reports.month":"Моҳи ҳисоботӣ","reports.year":"Соли таҳсил","reports.staff":"Ҳисоботи кадрҳо","reports.finance":"Ҳисоботи молиявӣ",
    "reports.print":"Чопи ҳисобот","reports.export":"Excel (CSV)","reports.loading":"Маълумот бор шуда истодааст...","reports.staffCount":"Омӯзгорону кормандон","reports.classes":"Синфҳо","reports.students":"Хонандагон","reports.tariffRows":"Сатрҳои тарифӣ","reports.lessons":"Дарсҳо дар ҷадвал","reports.payrollCount":"Шумораи кормандони маошгирифта","reports.gross":"Маҷмӯи ҳисобшуда","reports.deductions":"Нигоҳдоштиҳо","reports.net":"Ба даст","reports.employee":"Корманд","reports.position":"Вазифа","reports.employmentType":"Намуди кор","reports.subject":"Фан","reports.status":"Ҳолат","reports.active":"Фаъол","reports.inactive":"Ғайрифаъол","reports.noPayroll":"Барои моҳи интихобшуда сабти маош нест.","reports.noStaff":"Корманд сабт нашудааст.","reports.footer":"Маълумот аз пойгоҳи додаи муассиса гирифта шудааст. Ҳисоботи молиявӣ бояд бо ҳуҷҷатҳои муҳосибӣ муқоиса шавад.","reports.error":"Ҳисобот бор карда нашуд.",
    "attendance.name":"Ному насаб","attendance.title":"Давомоти хонандагон","attendance.subtitle":"Қайд ва нигоҳдории ҳозиршавии ҳаррӯзаи хонандагон","attendance.institution":"Муассиса","attendance.class":"Синф","attendance.date":"Сана","attendance.present":"Ҳозир","attendance.absent":"Ғоиб","attendance.late":"Дер омад","attendance.excused":"Бо сабаб","attendance.list":"Рӯйхати хонандагон","attendance.marked":"аз","attendance.markedSuffix":"нафар қайд шудаанд","attendance.markAll":"Ҳамаро ҳозир қайд кун","attendance.export":"Excel (CSV)","attendance.save":"Сабти давомот","attendance.saving":"Сабт шуда истодааст...","attendance.loading":"Рӯйхат бор мешавад...","attendance.empty":"Дар синфи интихобшуда хонанда нест.","attendance.number":"Рақами шахсӣ","attendance.status":"Ҳолат","attendance.note":"Эзоҳ","attendance.choose":"Интихоб кунед","attendance.notePlaceholder":"Сабаби ғоибӣ...","attendance.unmarked":"Қайд нашудааст","attendance.footer":"Давомоти сабтшуда бо сана ва муассиса нигоҳ дошта мешавад."
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
    "auth.noAccount":"Ещё нет аккаунта?", "auth.register":"Регистрация",
    "reports.title":"Отчёты учреждения","reports.subtitle":"Сводка по кадрам, учащимся, тарифам и зарплате","reports.month":"Отчётный месяц","reports.year":"Учебный год","reports.staff":"Кадровый отчёт","reports.finance":"Финансовый отчёт",
    "reports.print":"Печать отчёта","reports.export":"Excel (CSV)","reports.loading":"Загрузка данных...","reports.staffCount":"Учителя и сотрудники","reports.classes":"Классы","reports.students":"Учащиеся","reports.tariffRows":"Тарифные строки","reports.lessons":"Уроки в расписании","reports.payrollCount":"Количество сотрудников в ведомости","reports.gross":"Начислено всего","reports.deductions":"Удержания","reports.net":"К выплате","reports.employee":"Сотрудник","reports.position":"Должность","reports.employmentType":"Вид занятости","reports.subject":"Предмет","reports.status":"Статус","reports.active":"Активен","reports.inactive":"Неактивен","reports.noPayroll":"За выбранный месяц зарплатных записей нет.","reports.noStaff":"Сотрудники не зарегистрированы.","reports.footer":"Данные получены из базы учреждения. Финансовый отчёт необходимо сверить с бухгалтерскими документами.","reports.error":"Не удалось загрузить отчёт.",
    "attendance.name":"ФИО","attendance.title":"Посещаемость учащихся","attendance.subtitle":"Ежедневная отметка посещаемости учащихся","attendance.institution":"Учреждение","attendance.class":"Класс","attendance.date":"Дата","attendance.present":"Присутствует","attendance.absent":"Отсутствует","attendance.late":"Опоздал","attendance.excused":"По уважительной причине","attendance.list":"Список учащихся","attendance.marked":"из","attendance.markedSuffix":"чел. отмечено","attendance.markAll":"Отметить всех присутствующими","attendance.export":"Excel (CSV)","attendance.save":"Сохранить посещаемость","attendance.saving":"Сохранение...","attendance.loading":"Загрузка списка...","attendance.empty":"В выбранном классе нет учащихся.","attendance.number":"Личный номер","attendance.status":"Статус","attendance.note":"Примечание","attendance.choose":"Выберите","attendance.notePlaceholder":"Причина отсутствия...","attendance.unmarked":"Не отмечено","attendance.footer":"Посещаемость хранится с указанием даты и учреждения."
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
    "auth.noAccount":"Don't have an account yet?", "auth.register":"Register",
    "reports.title":"Institution reports","reports.subtitle":"Summary of staff, students, tariffs and payroll","reports.month":"Reporting month","reports.year":"Academic year","reports.staff":"Staff report","reports.finance":"Financial report",
    "reports.print":"Print report","reports.export":"Excel (CSV)","reports.loading":"Loading data...","reports.staffCount":"Teachers and staff","reports.classes":"Classes","reports.students":"Students","reports.tariffRows":"Tariff records","reports.lessons":"Scheduled lessons","reports.payrollCount":"Employees on payroll","reports.gross":"Total gross pay","reports.deductions":"Deductions","reports.net":"Net pay","reports.employee":"Employee","reports.position":"Position","reports.employmentType":"Employment type","reports.subject":"Subject","reports.status":"Status","reports.active":"Active","reports.inactive":"Inactive","reports.noPayroll":"No payroll records for the selected month.","reports.noStaff":"No staff records found.","reports.footer":"Data is retrieved from the institution database. Financial reports should be checked against accounting documents.","reports.error":"Could not load the report.",
    "attendance.name":"Full name","attendance.title":"Student attendance","attendance.subtitle":"Record and store students’ daily attendance","attendance.institution":"Institution","attendance.class":"Class","attendance.date":"Date","attendance.present":"Present","attendance.absent":"Absent","attendance.late":"Late","attendance.excused":"Excused","attendance.list":"Student list","attendance.marked":"of","attendance.markedSuffix":"students marked","attendance.markAll":"Mark everyone present","attendance.export":"Excel (CSV)","attendance.save":"Save attendance","attendance.saving":"Saving...","attendance.loading":"Loading list...","attendance.empty":"No students in the selected class.","attendance.number":"Personal number","attendance.status":"Status","attendance.note":"Note","attendance.choose":"Select","attendance.notePlaceholder":"Reason for absence...","attendance.unmarked":"Not marked","attendance.footer":"Attendance is stored by date and institution."
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
    "auth.noAccount":"Hali hisobingiz yo‘qmi?", "auth.register":"Ro‘yxatdan o‘tish",
    "reports.title":"Muassasa hisobotlari","reports.subtitle":"Xodimlar, o‘quvchilar, tariflar va ish haqi bo‘yicha jamlanma","reports.month":"Hisobot oyi","reports.year":"O‘quv yili","reports.staff":"Kadrlar hisoboti","reports.finance":"Moliyaviy hisobot",
    "reports.print":"Hisobotni chop etish","reports.export":"Excel (CSV)","reports.loading":"Ma’lumotlar yuklanmoqda...","reports.staffCount":"O‘qituvchilar va xodimlar","reports.classes":"Sinflar","reports.students":"O‘quvchilar","reports.tariffRows":"Tarif yozuvlari","reports.lessons":"Jadvaldagi darslar","reports.payrollCount":"Maosh oluvchi xodimlar soni","reports.gross":"Jami hisoblangan","reports.deductions":"Ushlanmalar","reports.net":"Qo‘lga tegadi","reports.employee":"Xodim","reports.position":"Lavozim","reports.employmentType":"Ish turi","reports.subject":"Fan","reports.status":"Holat","reports.active":"Faol","reports.inactive":"Faol emas","reports.noPayroll":"Tanlangan oy uchun maosh yozuvlari yo‘q.","reports.noStaff":"Xodimlar qayd etilmagan.","reports.footer":"Ma’lumot muassasa bazasidan olindi. Moliyaviy hisobot buxgalteriya hujjatlari bilan solishtirilishi kerak.","reports.error":"Hisobotni yuklab bo‘lmadi.",
    "attendance.name":"F.I.Sh.","attendance.title":"O‘quvchilar davomati","attendance.subtitle":"O‘quvchilarning kundalik davomatini qayd etish","attendance.institution":"Muassasa","attendance.class":"Sinf","attendance.date":"Sana","attendance.present":"Bor","attendance.absent":"Yo‘q","attendance.late":"Kechikdi","attendance.excused":"Uzrli","attendance.list":"O‘quvchilar ro‘yxati","attendance.marked":"dan","attendance.markedSuffix":"nafar belgilangan","attendance.markAll":"Barchasini bor deb belgilash","attendance.export":"Excel (CSV)","attendance.save":"Davomatni saqlash","attendance.saving":"Saqlanmoqda...","attendance.loading":"Ro‘yxat yuklanmoqda...","attendance.empty":"Tanlangan sinfda o‘quvchi yo‘q.","attendance.number":"Shaxsiy raqam","attendance.status":"Holat","attendance.note":"Izoh","attendance.choose":"Tanlang","attendance.notePlaceholder":"Kelmaslik sababi...","attendance.unmarked":"Belgilanmagan","attendance.footer":"Davomat sana va muassasa bo‘yicha saqlanadi."
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
    "auth.noAccount":"هنوز حساب ندارید؟", "auth.register":"ثبت‌نام",
    "reports.title":"گزارش‌های مؤسسه","reports.subtitle":"خلاصهٔ کارکنان، دانش‌آموزان، تعرفه‌ها و معاش","reports.month":"ماه گزارش","reports.year":"سال تحصیلی","reports.staff":"گزارش کارکنان","reports.finance":"گزارش مالی",
    "reports.print":"چاپ گزارش","reports.export":"Excel (CSV)","reports.loading":"در حال بارگذاری اطلاعات...","reports.staffCount":"معلمان و کارکنان","reports.classes":"صنف‌ها","reports.students":"دانش‌آموزان","reports.tariffRows":"ردیف‌های تعرفه","reports.lessons":"درس‌های برنامه","reports.payrollCount":"تعداد کارکنان دارای معاش","reports.gross":"مجموع начис‌شده","reports.deductions":"کسورات","reports.net":"قابل پرداخت","reports.employee":"کارمند","reports.position":"سمت","reports.employmentType":"نوع کار","reports.subject":"مضمون","reports.status":"وضعیت","reports.active":"فعال","reports.inactive":"غیرفعال","reports.noPayroll":"برای ماه انتخاب‌شده ثبت معاش وجود ندارد.","reports.noStaff":"کارمندی ثبت نشده است.","reports.footer":"اطلاعات از پایگاه دادهٔ مؤسسه دریافت شده است. گزارش مالی باید با اسناد حسابداری تطبیق شود.","reports.error":"بارگذاری گزارش انجام نشد.",
    "attendance.name":"نام و نام خانوادگی","attendance.title":"حاضری دانش‌آموزان","attendance.subtitle":"ثبت حاضری روزانهٔ دانش‌آموزان","attendance.institution":"مؤسسه","attendance.class":"صنف","attendance.date":"تاریخ","attendance.present":"حاضر","attendance.absent":"غایب","attendance.late":"با تأخیر","attendance.excused":"با عذر","attendance.list":"فهرست دانش‌آموزان","attendance.marked":"از","attendance.markedSuffix":"نفر ثبت شده‌اند","attendance.markAll":"ثبت حضور همه","attendance.export":"Excel (CSV)","attendance.save":"ذخیرهٔ حاضری","attendance.saving":"در حال ذخیره...","attendance.loading":"در حال بارگذاری فهرست...","attendance.empty":"در صنف انتخاب‌شده دانش‌آموزی نیست.","attendance.number":"شمارهٔ شخصی","attendance.status":"وضعیت","attendance.note":"یادداشت","attendance.choose":"انتخاب کنید","attendance.notePlaceholder":"دلیل غیبت...","attendance.unmarked":"ثبت نشده","attendance.footer":"حاضری بر اساس تاریخ و مؤسسه ذخیره می‌شود."
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
