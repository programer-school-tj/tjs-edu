import { getServerUserSession } from "../../helpers/getServerUserSession";
import { db } from "../../helpers/db";
import { withPlanQuota } from "../../helpers/planQuota";
import { z } from "zod";
import superjson from "superjson";

const schema = z.object({
  institutionId: z.string().uuid(),
  staffId: z.string().uuid(),
  payrollMonth: z.string().regex(/^20[0-9]{2}-(0[1-9]|1[0-2])$/),
  tariffId: z.string().uuid().optional(),
  baseAmount: z.number().min(0).max(1000000),
  allowances: z.number().min(0).max(1000000).default(0),
  deductions: z.number().min(0).max(1000000).default(0),
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

      let baseAmount = x.baseAmount;
      if (x.tariffId) {
        const tariff = await trx.selectFrom("institutionTariffs")
          .select(["id", "staffId", "positionTitle", "monthlyBase", "effectiveFrom", "effectiveTo", "academicYear"])
          .where("id", "=", x.tariffId).where("institutionId", "=", x.institutionId).executeTakeFirst();
        if (!tariff) throw new Error("TARIFF_NOT_FOUND");
        if (tariff.staffId && tariff.staffId !== staff.id) throw new Error("TARIFF_STAFF_MISMATCH");
        if (tariff.positionTitle.trim().toLocaleLowerCase() !== staff.positionTitle.trim().toLocaleLowerCase()) throw new Error("TARIFF_POSITION_MISMATCH");
        const monthDate = new Date(`${x.payrollMonth}-01T00:00:00.000Z`);
        if (tariff.effectiveFrom > monthDate || (tariff.effectiveTo && tariff.effectiveTo < monthDate)) throw new Error("TARIFF_NOT_EFFECTIVE");
        baseAmount = Number(tariff.monthlyBase);
      }

      const grossAmount = baseAmount + x.allowances;
      if (x.deductions > grossAmount) throw new Error("DEDUCTIONS_EXCEED_GROSS");
      return trx.insertInto("institutionPayrollEntries").values({
        institutionId: x.institutionId, staffId: x.staffId, payrollMonth: new Date(`${x.payrollMonth}-01T00:00:00.000Z`),
        tariffId: x.tariffId || null, baseAmount, allowances: x.allowances, grossAmount,
        deductions: x.deductions, netAmount: grossAmount - x.deductions, notes: x.notes || null, createdBy: user.id,
      }).returningAll().executeTakeFirstOrThrow();
    });
    return new Response(superjson.stringify({ entry: outcome.result, operationCount: outcome.operationCount, plan: outcome.plan }), { status: 201, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const message = error instanceof z.ZodError ? "Маълумоти табели маош нодуруст аст."
      : code === "PLAN_LIMIT_REACHED" ? "Ҳадди 5 амалиёти ройгони табели маош истифода шуд. Барои идома ба нақшаи PRO гузаред."
      : code === "STAFF_NOT_FOUND" ? "Корманд ёфт нашуд."
      : code === "TARIFF_NOT_FOUND" ? "Тариф ба ин муассиса тааллуқ надорад."
      : code === "TARIFF_STAFF_MISMATCH" ? "Ин тариф ба корманди интихобшуда тааллуқ надорад."
      : code === "TARIFF_POSITION_MISMATCH" ? "Вазифаи тариф ба вазифаи корманд мувофиқат намекунад."
      : code === "TARIFF_NOT_EFFECTIVE" ? "Тарифи интихобшуда дар моҳи ҳисоботӣ амал намекунад."
      : code === "DEDUCTIONS_EXCEED_GROSS" ? "Нигоҳдоштиҳо аз маблағи ҳисобшуда зиёд буда наметавонанд."
      : "Сабти маош иҷро нашуд. Барои ин корманд ва моҳ шояд сабт аллакай вуҷуд дорад.";
    const status = (error as { name?: string })?.name === "NotAuthenticatedError" ? 401 : code === "PLAN_LIMIT_REACHED" ? 402 : code === "TARIFF_NOT_FOUND" || code === "STAFF_NOT_FOUND" ? 404 : 400;
    return new Response(superjson.stringify({ message, code: code || undefined }), { status, headers: { "Content-Type": "application/json" } });
  }
}
