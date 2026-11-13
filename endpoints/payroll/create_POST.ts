import { getServerUserSession } from "../../helpers/getServerUserSession";
import { db } from "../../helpers/db";
import { withPlanQuota } from "../../helpers/planQuota";
import { z } from "zod";
import superjson from "superjson";

const hasAtMostTwoDecimals = (value: number) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-7;

const schema = z.object({
  institutionId: z.string().uuid(),
  staffId: z.string().uuid(),
  payrollMonth: z.string().regex(/^20[0-9]{2}-(0[1-9]|1[0-2])$/),
  tariffId: z.string().uuid().optional(),
  baseAmount: z.number().min(0).max(1000000).refine(hasAtMostTwoDecimals, "Маблағи асосӣ бояд то 2 рақами пас аз вергул бошад."),
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

      // Ҳисобҳои пулӣ бо дирам (integer cents) иҷро мешаванд, то хатои float ҷамъ нашавад.
      let baseAmountCents = Math.round(x.baseAmount * 100);
      if (x.tariffId) {
        const tariff = await trx.selectFrom("institutionTariffs")
          .select(["id", "staffId", "positionTitle", "monthlyBase", "effectiveFrom", "effectiveTo", "academicYear"])
          .where("id", "=", x.tariffId).where("institutionId", "=", x.institutionId).executeTakeFirst();
        if (!tariff) throw new Error("TARIFF_NOT_FOUND");
        if (tariff.staffId && tariff.staffId !== staff.id) throw new Error("TARIFF_STAFF_MISMATCH");
        if (tariff.positionTitle.trim().toLocaleLowerCase() !== staff.positionTitle.trim().toLocaleLowerCase()) throw new Error("TARIFF_POSITION_MISMATCH");
        const monthDate = new Date(`${x.payrollMonth}-01T00:00:00.000Z`);
        const monthYear = Number(x.payrollMonth.slice(0, 4));
        const monthNumber = Number(x.payrollMonth.slice(5, 7));
        const payrollAcademicYear = monthNumber >= 9
          ? `${monthYear}-${monthYear + 1}`
          : `${monthYear - 1}-${monthYear}`;
        if (tariff.academicYear !== payrollAcademicYear) throw new Error("TARIFF_YEAR_MISMATCH");
        if (tariff.effectiveFrom > monthDate || (tariff.effectiveTo && tariff.effectiveTo < monthDate)) throw new Error("TARIFF_NOT_EFFECTIVE");
        baseAmountCents = Math.round(Number(tariff.monthlyBase) * 100);
      }

      const classHeadAllowanceCents = Math.round(x.classHeadAllowance * 100);
      const notebookCheckingAllowanceCents = Math.round(x.notebookCheckingAllowance * 100);
      const methodicalAssociationHeadAllowanceCents = Math.round(x.methodicalAssociationHeadAllowance * 100);
      const otherAllowancesCents = Math.round((x.otherAllowances + x.allowances) * 100);
      const incomeTaxDeductionCents = Math.round(x.incomeTaxDeduction * 100);
      const partyDuesDeductionCents = Math.round(x.partyDuesDeduction * 100);
      const tradeUnionDuesDeductionCents = Math.round(x.tradeUnionDuesDeduction * 100);
      const newspaperDeductionCents = Math.round(x.newspaperDeduction * 100);
      const otherDeductionsCents = Math.round((x.otherDeductions + x.deductions) * 100);
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
        tariffId: x.tariffId || null, baseAmount, allowances, grossAmount,
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
      : isDuplicatePayroll ? "Барои ин корманд дар моҳи интихобшуда табели маош аллакай сабт шудааст."
      : "Ҳангоми сабти табели маош хатои дохилӣ рух дод. Лутфан баъдтар такрор кунед.";
    const isAuthError = (error as { name?: string })?.name === "NotAuthenticatedError";
    const isValidationError = error instanceof z.ZodError || [
      "TARIFF_STAFF_MISMATCH",
      "TARIFF_POSITION_MISMATCH",
      "TARIFF_NOT_EFFECTIVE",
      "TARIFF_YEAR_MISMATCH",
      "DEDUCTIONS_EXCEED_GROSS",
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
