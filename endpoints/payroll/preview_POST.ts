import { getServerUserSession } from "../../helpers/getServerUserSession";
import { db } from "../../helpers/db";
import { z } from "zod";
import superjson from "superjson";
import { aggregateFinanceRuleValues, getFinanceRuleTarget, matchesFinanceRule, type FinanceRuleInput, type FinanceRuleTarget } from "../../helpers/financeRuleCalculation";

const schema = z.object({
  institutionId: z.string().uuid(),
  staffId: z.string().uuid(),
  payrollMonth: z.string().regex(/^20[0-9]{2}-(0[1-9]|1[0-2])$/),
  tariffId: z.string().uuid().optional(),
  baseAmount: z.number().min(0).max(1000000),
  workRate: z.number().min(0.01).max(5),
  weeklyHours: z.number().min(0).max(60),
  workingDays: z.number().int().min(0).max(31),
  classHeadAllowance: z.number().min(0).max(1000000),
  notebookCheckingAllowance: z.number().min(0).max(1000000),
  methodicalAssociationHeadAllowance: z.number().min(0).max(1000000),
  otherAllowances: z.number().min(0).max(1000000),
  incomeTaxDeduction: z.number().min(0).max(1000000),
  partyDuesDeduction: z.number().min(0).max(1000000),
  tradeUnionDuesDeduction: z.number().min(0).max(1000000),
  newspaperDeduction: z.number().min(0).max(1000000),
  otherDeductions: z.number().min(0).max(1000000),
});

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const x = schema.parse(superjson.parse(await request.text()));
    const access = await db.selectFrom("institutionMemberships")
      .innerJoin("institutions", "institutions.id", "institutionMemberships.institutionId")
      .select("institutionMemberships.id")
      .where("institutionMemberships.institutionId", "=", x.institutionId)
      .where("institutionMemberships.userId", "=", user.id)
      .where("institutionMemberships.isActive", "=", true)
      .where("institutionMemberships.role", "=", "director")
      .where("institutions.status", "=", "approved")
      .executeTakeFirst();
    if (user.role !== "admin" && !access) {
      return new Response(superjson.stringify({ message: "Иҷозат надоред." }), { status: 403 });
    }

    const staff = await db.selectFrom("institutionStaff").select(["id", "positionTitle"])
      .where("id", "=", x.staffId).where("institutionId", "=", x.institutionId)
      .where("isActive", "=", true).executeTakeFirst();
    if (!staff) return new Response(superjson.stringify({ message: "Корманд ёфт нашуд." }), { status: 404 });
    const institution = await db.selectFrom("institutions").select(["institutionType"])
      .where("id", "=", x.institutionId).executeTakeFirstOrThrow();

    const year = Number(x.payrollMonth.slice(0, 4));
    const month = Number(x.payrollMonth.slice(5, 7));
    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 0));
    if (x.workingDays > monthEnd.getUTCDate()) {
      return new Response(superjson.stringify({ message: "Шумораи рӯзҳои корӣ аз шумораи рӯзҳои моҳи интихобшуда зиёд аст." }), { status: 400 });
    }

    let baseCents = Math.round(x.baseAmount * 100);
    let weeklyHours = x.weeklyHours;
    let qualificationCategory: string | null = null;
    let educationLevel: string | null = null;
    if (x.tariffId) {
      const tariff = await db.selectFrom("institutionTariffs")
        .select(["staffId", "positionTitle", "monthlyBase", "weeklyHours", "effectiveFrom", "effectiveTo", "academicYear", "qualificationCategory", "educationLevel"])
        .where("id", "=", x.tariffId).where("institutionId", "=", x.institutionId).executeTakeFirst();
      if (!tariff) return new Response(superjson.stringify({ message: "Тариф ёфт нашуд." }), { status: 404 });
      if (tariff.staffId && tariff.staffId !== staff.id) {
        return new Response(superjson.stringify({ message: "Тариф ба корманди интихобшуда мувофиқат намекунад." }), { status: 400 });
      }
      if (tariff.positionTitle.trim().toLocaleLowerCase() !== staff.positionTitle.trim().toLocaleLowerCase()) {
        return new Response(superjson.stringify({ message: "Вазифаи тариф ба вазифаи корманд мувофиқат намекунад." }), { status: 400 });
      }
      const academicYear = month >= 9 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
      if (tariff.academicYear !== academicYear || tariff.effectiveFrom > monthStart || (tariff.effectiveTo && tariff.effectiveTo < monthEnd)) {
        return new Response(superjson.stringify({ message: "Тариф дар моҳи интихобшуда амал намекунад." }), { status: 400 });
      }
      baseCents = Math.round(Number(tariff.monthlyBase) * 100);
      weeklyHours = Number(tariff.weeklyHours ?? weeklyHours);
      qualificationCategory = tariff.qualificationCategory;
      educationLevel = tariff.educationLevel;
    }

    const rules = await db.selectFrom("financeRules").selectAll()
      .where("isActive", "=", true).where("effectiveFrom", "<=", monthStart).execute();
    const applicable = (rules as unknown as FinanceRuleInput[]).filter((rule) =>
      (!rule.effectiveTo || new Date(rule.effectiveTo).getTime() >= monthEnd.getTime())
      && matchesFinanceRule(rule, {
        institutionType: institution.institutionType,
        positionTitle: staff.positionTitle,
        qualificationCategory,
        educationLevel,
      })
      && getFinanceRuleTarget(rule) !== null
    );

    let classHead = Math.round(x.classHeadAllowance * 100);
    let notebook = Math.round(x.notebookCheckingAllowance * 100);
    let methodical = Math.round(x.methodicalAssociationHeadAllowance * 100);
    let otherAllowances = Math.round(x.otherAllowances * 100);
    let incomeTax = Math.round(x.incomeTaxDeduction * 100);
    let party = Math.round(x.partyDuesDeduction * 100);
    let union = Math.round(x.tradeUnionDuesDeduction * 100);
    let newspaper = Math.round(x.newspaperDeduction * 100);
    let otherDeductions = Math.round(x.otherDeductions * 100);
    const snapshots: Array<Record<string, unknown>> = [];

    const contextFor = (exclude?: FinanceRuleTarget) => {
      const allowances = classHead + notebook + methodical + otherAllowances
        - (exclude === "classHeadAllowance" ? classHead : 0)
        - (exclude === "notebookCheckingAllowance" ? notebook : 0)
        - (exclude === "methodicalAssociationHeadAllowance" ? methodical : 0)
        - (exclude === "otherAllowances" ? otherAllowances : 0);
      return {
        baseAmount: baseCents / 100,
        grossAmount: (baseCents + allowances) / 100,
        allowances: allowances / 100,
        weeklyHours,
        workRate: x.workRate,
        workingDays: x.workingDays,
      };
    };
    const apply = (target: FinanceRuleTarget, setAmount: (value: number) => void) => {
      const selected = applicable.filter((rule) => getFinanceRuleTarget(rule) === target);
      if (!selected.length) return;
      const result = aggregateFinanceRuleValues(selected, contextFor(target));
      const amount = result.totals[target];
      if (amount === undefined || !Number.isFinite(amount) || amount < 0 || amount > 1000000) {
        throw new Error("FINANCE_RULE_RESULT_INVALID");
      }
      setAmount(Math.round(amount * 100));
      snapshots.push(...result.snapshots);
    };

    apply("baseAmount", (value) => { baseCents = value; });
    apply("weeklyHours", (value) => { weeklyHours = value / 100; });
    if (weeklyHours < 0 || weeklyHours > 60) throw new Error("FINANCE_RULE_RESULT_INVALID");
    apply("classHeadAllowance", (value) => { classHead = value; });
    apply("notebookCheckingAllowance", (value) => { notebook = value; });
    apply("methodicalAssociationHeadAllowance", (value) => { methodical = value; });
    apply("otherAllowances", (value) => { otherAllowances = value; });
    apply("incomeTaxDeduction", (value) => { incomeTax = value; });
    apply("partyDuesDeduction", (value) => { party = value; });
    apply("tradeUnionDuesDeduction", (value) => { union = value; });
    apply("newspaperDeduction", (value) => { newspaper = value; });
    apply("otherDeductions", (value) => { otherDeductions = value; });

    const allowances = classHead + notebook + methodical + otherAllowances;
    const gross = baseCents + allowances;
    const deductions = incomeTax + party + union + newspaper + otherDeductions;
    if (deductions > gross) {
      return new Response(superjson.stringify({ message: "Нигоҳдоштиҳо аз маблағи умумӣ зиёданд." }), { status: 400 });
    }
    return new Response(superjson.stringify({
      preview: {
        baseAmount: baseCents / 100,
        weeklyHours,
        classHeadAllowance: classHead / 100,
        notebookCheckingAllowance: notebook / 100,
        methodicalAssociationHeadAllowance: methodical / 100,
        otherAllowances: otherAllowances / 100,
        allowances: allowances / 100,
        grossAmount: gross / 100,
        incomeTaxDeduction: incomeTax / 100,
        partyDuesDeduction: party / 100,
        tradeUnionDuesDeduction: union / 100,
        newspaperDeduction: newspaper / 100,
        otherDeductions: otherDeductions / 100,
        deductions: deductions / 100,
        netAmount: (gross - deductions) / 100,
        financeRuleSnapshot: snapshots,
      },
    }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    const message = error instanceof z.ZodError
      ? error.issues[0]?.message || "Маълумоти пешнамоиш нодуруст аст."
      : error instanceof Error && error.message === "FINANCE_RULE_RESULT_INVALID"
        ? "Натиҷаи қоидаи молиявӣ нодуруст аст. Қоидаҳоро санҷед."
        : "Пешнамоиши маош ҳисоб карда нашуд.";
    return new Response(superjson.stringify({ message }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
}
