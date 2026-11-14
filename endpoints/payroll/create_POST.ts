import { getServerUserSession } from "../../helpers/getServerUserSession";
import { db } from "../../helpers/db";
import { withPlanQuota } from "../../helpers/planQuota";
import { z } from "zod";
import superjson from "superjson";
import { aggregateFinanceRuleValues, getFinanceRuleTarget, matchesFinanceRule, type FinanceRuleInput, type FinanceRuleTarget } from "../../helpers/financeRuleCalculation";
import type { JsonArray } from "../../helpers/schema";

const hasAtMostTwoDecimals = (value: number) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-7;

const schema = z.object({
  institutionId: z.string().uuid(),
  staffId: z.string().uuid(),
  payrollMonth: z.string().regex(/^20[0-9]{2}-(0[1-9]|1[0-2])$/),
  tariffId: z.string().uuid().optional(),
  baseAmount: z.number().min(0).max(1000000).refine(hasAtMostTwoDecimals, "Маблағи асосӣ бояд то 2 рақами пас аз вергул бошад."),
  workRate: z.number().min(0.01).max(5).refine(hasAtMostTwoDecimals).default(1),
  weeklyHours: z.number().min(0).max(60).refine(hasAtMostTwoDecimals).default(0),
  workingDays: z.number().int().min(0).max(31).default(0),
  allowances: z.number().min(0).max(1000000).refine(hasAtMostTwoDecimals, "Иловапулӣ бояд то 2 рақами пас аз вергул бошад.").default(0),
  deductions: z.number().min(0).max(1000000).refine(hasAtMostTwoDecimals, "Нигоҳдошт бояд то 2 рақами пас аз вергул бошад.").default(0),
  classHeadAllowance: z.number().min(0).max(1000000).refine(hasAtMostTwoDecimals).default(0),
  notebookCheckingAllowance: z.number().min(0).max(1000000).refine(hasAtMostTwoDecimals).default(0),
  methodicalAssociationHeadAllowance: z.number().min(0).max(1000000).refine(hasAtMostTwoDecimals).default(0),
  otherAllowances: z.number().min(0).max(1000000).refine(hasAtMostTwoDecimals).default(0),
  incomeTaxDeduction: z.number().min(0).max(1000000).refine(hasAtMostTwoDecimals).default(0),
  partyDuesDeduction: z.number().min(0).max(1000000).refine(hasAtMostTwoDecimals).default(0),
  tradeUnionDuesDeduction: z.number().min(0).max(1000000).refine(hasAtMostTwoDecimals).default(0),
  newspaperDeduction: z.number().min(0).max(1000000).refine(hasAtMostTwoDecimals).default(0),
  otherDeductions: z.number().min(0).max(1000000).refine(hasAtMostTwoDecimals).default(0),
  notes: z.string().max(1000).optional(),
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
      .where("institutions.status", "=", "approved").executeTakeFirst();
    if (user.role !== "admin" && !access) {
      return new Response(superjson.stringify({ message: "Танҳо директори муассисаи тасдиқшуда метавонад табели маошро сабт кунад." }), { status: 403 });
    }

    const outcome = await withPlanQuota(x.institutionId, "payroll", async (trx) => {
      const staff = await trx.selectFrom("institutionStaff").select(["id", "positionTitle"])
        .where("id", "=", x.staffId).where("institutionId", "=", x.institutionId).where("isActive", "=", true).executeTakeFirst();
      if (!staff) throw new Error("STAFF_NOT_FOUND");
      const institution = await trx.selectFrom("institutions").select(["institutionType"])
        .where("id", "=", x.institutionId).executeTakeFirstOrThrow();
      const payrollYear = Number(x.payrollMonth.slice(0, 4));
      const payrollMonthNumber = Number(x.payrollMonth.slice(5, 7));
      const daysInPayrollMonth = new Date(Date.UTC(payrollYear, payrollMonthNumber, 0)).getUTCDate();
      if (x.workingDays > daysInPayrollMonth) throw new Error("WORKING_DAYS_EXCEED_MONTH");

      // Ҳисобҳои пулӣ бо дирам (integer cents) иҷро мешаванд, то хатои float ҷамъ нашавад.
      let baseAmountCents = Math.round(x.baseAmount * 100);
      let qualificationCategory: string | null = null;
      let educationLevel: string | null = null;
      if (x.tariffId) {
        const tariff = await trx.selectFrom("institutionTariffs")
          .select(["id", "staffId", "positionTitle", "monthlyBase", "weeklyHours", "effectiveFrom", "effectiveTo", "academicYear", "qualificationCategory", "educationLevel"])
          .where("id", "=", x.tariffId).where("institutionId", "=", x.institutionId).executeTakeFirst();
        if (!tariff) throw new Error("TARIFF_NOT_FOUND");
        if (tariff.staffId && tariff.staffId !== staff.id) throw new Error("TARIFF_STAFF_MISMATCH");
      x.weeklyHours = Number(tariff.weeklyHours ?? x.weeklyHours);
        if (tariff.positionTitle.trim().toLocaleLowerCase() !== staff.positionTitle.trim().toLocaleLowerCase()) throw new Error("TARIFF_POSITION_MISMATCH");
        const monthYear = Number(x.payrollMonth.slice(0, 4));
        const monthNumber = Number(x.payrollMonth.slice(5, 7));
        const monthStart = new Date(Date.UTC(monthYear, monthNumber - 1, 1));
        const monthEnd = new Date(Date.UTC(monthYear, monthNumber, 0));
        const payrollAcademicYear = monthNumber >= 9
          ? `${monthYear}-${monthYear + 1}`
          : `${monthYear - 1}-${monthYear}`;
        if (tariff.academicYear !== payrollAcademicYear) throw new Error("TARIFF_YEAR_MISMATCH");
        // Тариф бояд тамоми моҳи ҳисоботиро фаро гирад, на танҳо рӯзи якумро.
        if (tariff.effectiveFrom > monthStart || (tariff.effectiveTo && tariff.effectiveTo < monthEnd)) {
          throw new Error("TARIFF_NOT_EFFECTIVE");
        }
        baseAmountCents = Math.round(Number(tariff.monthlyBase) * 100);
        qualificationCategory = tariff.qualificationCategory;
        educationLevel = tariff.educationLevel;
      }

      let classHeadAllowanceCents = Math.round(x.classHeadAllowance * 100);
      let notebookCheckingAllowanceCents = Math.round(x.notebookCheckingAllowance * 100);
      let methodicalAssociationHeadAllowanceCents = Math.round(x.methodicalAssociationHeadAllowance * 100);
      let otherAllowancesCents = Math.round((x.otherAllowances + x.allowances) * 100);
      let incomeTaxDeductionCents = Math.round(x.incomeTaxDeduction * 100);
      let partyDuesDeductionCents = Math.round(x.partyDuesDeduction * 100);
      let tradeUnionDuesDeductionCents = Math.round(x.tradeUnionDuesDeduction * 100);
      let newspaperDeductionCents = Math.round(x.newspaperDeduction * 100);
      let otherDeductionsCents = Math.round((x.otherDeductions + x.deductions) * 100);
      // Қоидаҳои марказӣ танҳо агар тамоми моҳи ҳисоботӣ дар давраи амали онҳо бошад, истифода мешаванд.
      const monthStart = new Date(Date.UTC(payrollYear, payrollMonthNumber - 1, 1));
      const monthEnd = new Date(Date.UTC(payrollYear, payrollMonthNumber, 0));
      const financeRules = await trx.selectFrom("financeRules").selectAll()
        .where("isActive", "=", true)
        .where("effectiveFrom", "<=", monthStart)
        .execute();
      const applicableRules = (financeRules as unknown as FinanceRuleInput[]).filter((rule) =>
        (!rule.effectiveTo || new Date(rule.effectiveTo).getTime() >= monthEnd.getTime())
        && matchesFinanceRule(rule, {
          institutionType: institution.institutionType,
          positionTitle: staff.positionTitle,
          qualificationCategory,
          educationLevel,
        })
        && getFinanceRuleTarget(rule) !== null
      );
      const ruleSnapshots: Array<Record<string, unknown>> = [];
      let weeklyHours = Number(x.weeklyHours);
      const buildContext = () => {
        const currentAllowances = classHeadAllowanceCents + notebookCheckingAllowanceCents
          + methodicalAssociationHeadAllowanceCents + otherAllowancesCents;
        return {
          baseAmount: baseAmountCents / 100,
          grossAmount: (baseAmountCents + currentAllowances) / 100,
          allowances: currentAllowances / 100,
          weeklyHours,
          workRate: Number(x.workRate),
          workingDays: x.workingDays,
        };
      };
      const applyTarget = (target: FinanceRuleTarget, setter: (amountCents: number) => void) => {
        const selected = applicableRules.filter((rule) => getFinanceRuleTarget(rule) === target);
        if (!selected.length) return;
        const calculated = aggregateFinanceRuleValues(selected, buildContext());
        const amount = calculated.totals[target];
        if (amount === undefined || !Number.isFinite(amount) || amount < 0 || amount > 1000000) {
          throw new Error("FINANCE_RULE_RESULT_INVALID");
        }
        setter(Math.round(amount * 100));
        ruleSnapshots.push(...calculated.snapshots);
      };

      applyTarget("baseAmount", (amount) => { baseAmountCents = amount; });
      applyTarget("weeklyHours", (amount) => { weeklyHours = amount / 100; });
      if (weeklyHours < 0 || weeklyHours > 60) throw new Error("FINANCE_RULE_RESULT_INVALID");
      applyTarget("classHeadAllowance", (amount) => { classHeadAllowanceCents = amount; });
      applyTarget("notebookCheckingAllowance", (amount) => { notebookCheckingAllowanceCents = amount; });
      applyTarget("methodicalAssociationHeadAllowance", (amount) => { methodicalAssociationHeadAllowanceCents = amount; });
      applyTarget("otherAllowances", (amount) => { otherAllowancesCents = amount; });
      applyTarget("incomeTaxDeduction", (amount) => { incomeTaxDeductionCents = amount; });
      applyTarget("partyDuesDeduction", (amount) => { partyDuesDeductionCents = amount; });
      applyTarget("tradeUnionDuesDeduction", (amount) => { tradeUnionDuesDeductionCents = amount; });
      applyTarget("newspaperDeduction", (amount) => { newspaperDeductionCents = amount; });
      applyTarget("otherDeductions", (amount) => { otherDeductionsCents = amount; });

      const allowancesCents = classHeadAllowanceCents + notebookCheckingAllowanceCents + methodicalAssociationHeadAllowanceCents + otherAllowancesCents;
      const deductionsCents = incomeTaxDeductionCents + partyDuesDeductionCents + tradeUnionDuesDeductionCents + newspaperDeductionCents + otherDeductionsCents;
      const grossAmountCents = baseAmountCents + allowancesCents;
      if (deductionsCents > grossAmountCents) throw new Error("DEDUCTIONS_EXCEED_GROSS");
      const baseAmount = baseAmountCents / 100;
      const allowances = allowancesCents / 100;
      const grossAmount = grossAmountCents / 100;
      const deductions = deductionsCents / 100;
      const netAmount = (grossAmountCents - deductionsCents) / 100;
      return trx.insertInto("institutionPayrollEntries").values({
        institutionId: x.institutionId, staffId: x.staffId, payrollMonth: new Date(`${x.payrollMonth}-01T00:00:00.000Z`),
        tariffId: x.tariffId || null, baseAmount, allowances, grossAmount, workRate: x.workRate, weeklyHours, workingDays: x.workingDays,
        financeRuleSnapshot: ruleSnapshots as unknown as JsonArray,
        classHeadAllowance: classHeadAllowanceCents / 100,
        notebookCheckingAllowance: notebookCheckingAllowanceCents / 100,
        methodicalAssociationHeadAllowance: methodicalAssociationHeadAllowanceCents / 100,
        otherAllowances: otherAllowancesCents / 100,
        incomeTaxDeduction: incomeTaxDeductionCents / 100,
        partyDuesDeduction: partyDuesDeductionCents / 100,
        tradeUnionDuesDeduction: tradeUnionDuesDeductionCents / 100,
        newspaperDeduction: newspaperDeductionCents / 100,
        otherDeductions: otherDeductionsCents / 100,
        deductions, netAmount, notes: x.notes || null, createdBy: user.id,
      }).returningAll().executeTakeFirstOrThrow();
    });
    return new Response(superjson.stringify({ entry: outcome.result, operationCount: outcome.operationCount, plan: outcome.plan }), { status: 201, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const databaseCode = (error as { code?: string })?.code;
    const isDuplicatePayroll = databaseCode === "23505";
    const knownCodes = new Set([
      "PLAN_LIMIT_REACHED",
      "STAFF_NOT_FOUND",
      "TARIFF_NOT_FOUND",
      "TARIFF_STAFF_MISMATCH",
      "TARIFF_POSITION_MISMATCH",
      "TARIFF_NOT_EFFECTIVE",
      "TARIFF_YEAR_MISMATCH",
      "DEDUCTIONS_EXCEED_GROSS",
      "WORKING_DAYS_EXCEED_MONTH",
      "FINANCE_RULE_RESULT_INVALID",
    ]);
    const message = error instanceof z.ZodError ? "Маълумоти табели маош нодуруст аст."
      : code === "PLAN_LIMIT_REACHED" ? "Ҳадди 5 амалиёти ройгони табели маош истифода шуд. Барои идома ба нақшаи PRO гузаред."
      : code === "STAFF_NOT_FOUND" ? "Корманд ёфт нашуд."
      : code === "TARIFF_NOT_FOUND" ? "Тариф ба ин муассиса тааллуқ надорад."
      : code === "TARIFF_STAFF_MISMATCH" ? "Ин тариф ба корманди интихобшуда тааллуқ надорад."
      : code === "TARIFF_POSITION_MISMATCH" ? "Вазифаи тариф ба вазифаи корманд мувофиқат намекунад."
      : code === "TARIFF_YEAR_MISMATCH" ? "Соли таҳсилии тарифи интихобшуда ба моҳи ҳисоботӣ мувофиқат намекунад."
      : code === "TARIFF_NOT_EFFECTIVE" ? "Тарифи интихобшуда дар моҳи ҳисоботӣ амал намекунад."
      : code === "DEDUCTIONS_EXCEED_GROSS" ? "Нигоҳдоштиҳо аз маблағи ҳисобшуда зиёд буда наметавонанд."
      : code === "WORKING_DAYS_EXCEED_MONTH" ? "Шумораи рӯзҳои корӣ аз шумораи рӯзҳои моҳи интихобшуда зиёд буда наметавонад."
      : code === "FINANCE_RULE_RESULT_INVALID" ? "Натиҷаи қоидаи марказии молиявӣ нодуруст аст. Қоидаҳоро дар панели маъмур санҷед."
      : isDuplicatePayroll ? "Барои ин корманд дар моҳи интихобшуда табели маош аллакай сабт шудааст."
      : "Ҳангоми сабти табели маош хатои дохилӣ рух дод. Лутфан баъдтар такрор кунед.";
    const isAuthError = (error as { name?: string })?.name === "NotAuthenticatedError";
    const isValidationError = error instanceof z.ZodError || [
      "TARIFF_STAFF_MISMATCH",
      "TARIFF_POSITION_MISMATCH",
      "TARIFF_NOT_EFFECTIVE",
      "TARIFF_YEAR_MISMATCH",
      "DEDUCTIONS_EXCEED_GROSS",
      "WORKING_DAYS_EXCEED_MONTH",
      "FINANCE_RULE_RESULT_INVALID",
    ].includes(code);
    const status = isAuthError ? 401
      : code === "PLAN_LIMIT_REACHED" ? 402
      : code === "TARIFF_NOT_FOUND" || code === "STAFF_NOT_FOUND" ? 404
      : isDuplicatePayroll ? 409
      : isValidationError ? 400
      : 500;
    const publicCode = isDuplicatePayroll ? "PAYROLL_ALREADY_EXISTS" : knownCodes.has(code) ? code : undefined;
    return new Response(superjson.stringify({ message, code: publicCode }), { status, headers: { "Content-Type": "application/json" } });
  }
}
