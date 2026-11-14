import { getServerUserSession } from "../../helpers/getServerUserSession";
import { db } from "../../helpers/db";
import { withPlanQuota } from "../../helpers/planQuota";
import { z } from "zod";
import superjson from "superjson";

const schema = z.object({
  institutionId: z.string().uuid(),
  academicYear: z.string().regex(/^20[0-9]{2}-20[0-9]{2}$/),
  effectiveFrom: z.string().date(),
  adjustmentPercent: z.number().gt(-100).max(500).refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-7, "Фоиз бояд то ду рақами пас аз вергул бошад."),
  positionTitle: z.string().trim().min(2).max(120).optional(),
  staffId: z.string().uuid().optional(),
  sourceTitle: z.string().trim().min(3).max(240),
  sourceReference: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
}).refine((value) => {
  const [startYear, endYear] = value.academicYear.split("-").map(Number);
  return endYear === startYear + 1
    && value.effectiveFrom >= `${startYear}-09-01`
    && value.effectiveFrom <= `${endYear}-08-31`;
}, { path: ["effectiveFrom"], message: "Санаи тағйирот бояд дар ҳудуди соли таҳсилии интихобшуда бошад." })
.refine((value) => !(value.staffId && value.positionTitle), {
  message: "Ҳамзамон корманд ва вазифаро интихоб накунед.",
});

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const input = schema.parse(superjson.parse(await request.text()));
    const access = await db.selectFrom("institutionMemberships")
      .innerJoin("institutions", "institutions.id", "institutionMemberships.institutionId")
      .select("institutionMemberships.id")
      .where("institutionMemberships.institutionId", "=", input.institutionId)
      .where("institutionMemberships.userId", "=", user.id)
      .where("institutionMemberships.isActive", "=", true)
      .where("institutionMemberships.role", "=", "director")
      .where("institutions.status", "=", "approved")
      .executeTakeFirst();
    if (user.role !== "admin" && !access) {
      return new Response(superjson.stringify({ message: "Танҳо директори муассисаи тасдиқшуда метавонад тағйироти тарифро татбиқ кунад." }), { status: 403 });
    }

    const outcome = await withPlanQuota(input.institutionId, "tariffs", async (trx) => {
      let query = trx.selectFrom("institutionTariffs")
        .selectAll()
        .where("institutionId", "=", input.institutionId)
        .where("academicYear", "=", input.academicYear);
      if (input.staffId) query = query.where("staffId", "=", input.staffId);
      if (input.positionTitle) query = query.where("positionTitle", "=", input.positionTitle);
      const tariffs = await query.execute();
      const effectiveDate = new Date(`${input.effectiveFrom}T00:00:00.000Z`);
      const effectiveTime = effectiveDate.getTime();
      const dayBefore = new Date(effectiveTime - 24 * 60 * 60 * 1000);
      const active = tariffs.filter((tariff) => {
        const start = tariff.effectiveFrom.getTime();
        const end = tariff.effectiveTo?.getTime() ?? Number.POSITIVE_INFINITY;
        return start < effectiveTime && start <= effectiveTime && end >= effectiveTime;
      });
      if (!active.length) throw new Error("NO_ACTIVE_TARIFFS");
      const conflicts = tariffs.filter((tariff) => tariff.effectiveFrom.getTime() === effectiveTime);
      if (conflicts.length) throw new Error("TARIFF_VERSION_ALREADY_EXISTS");

      const changed = [];
      for (const tariff of active) {
        const oldAmount = Number(tariff.monthlyBase);
        const newAmount = Math.round((oldAmount * (1 + input.adjustmentPercent / 100) + Number.EPSILON) * 100) / 100;
        if (!Number.isFinite(newAmount) || newAmount <= 0 || newAmount > 1000000) throw new Error("ADJUSTED_AMOUNT_OUT_OF_RANGE");

        await trx.updateTable("institutionTariffs")
          .set({ effectiveTo: dayBefore })
          .where("id", "=", tariff.id)
          .where("institutionId", "=", input.institutionId)
          .execute();

        const created = await trx.insertInto("institutionTariffs").values({
          institutionId: tariff.institutionId,
          staffId: tariff.staffId,
          positionTitle: tariff.positionTitle,
          educationLevel: tariff.educationLevel,
          qualificationCategory: tariff.qualificationCategory,
          weeklyHours: tariff.weeklyHours,
          monthlyBase: newAmount,
          effectiveFrom: effectiveDate,
          effectiveTo: tariff.effectiveTo,
          academicYear: tariff.academicYear,
          sourceTitle: input.sourceTitle,
          sourceReference: input.sourceReference || null,
          notes: [
            tariff.notes,
            input.notes,
            `Тағйироти ${input.adjustmentPercent}% аз ${input.effectiveFrom}; маблағи пешина: ${oldAmount.toFixed(2)} сомонӣ.`,
          ].filter(Boolean).join("\n").slice(0, 1000) || null,
          createdBy: user.id,
        }).returning(["id", "staffId", "positionTitle", "monthlyBase", "effectiveFrom", "effectiveTo"]).executeTakeFirstOrThrow();
        changed.push(created);
      }
      return { changed, count: changed.length };
    });

    return new Response(superjson.stringify({
      changed: outcome.result.changed,
      changedCount: outcome.result.count,
      operationCount: outcome.operationCount,
      plan: outcome.plan,
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const authError = (error as { name?: string })?.name === "NotAuthenticatedError";
    const validationIssues = error instanceof z.ZodError ? error.issues : [];
    const validationError = validationIssues.length > 0;
    const message = validationError ? (validationIssues[0]?.message || "Маълумоти тағйирот нодуруст аст.")
      : code === "NO_ACTIVE_TARIFFS" ? "Дар санаи интихобшуда тарифи амалкунанда ёфт нашуд."
      : code === "TARIFF_VERSION_ALREADY_EXISTS" ? "Барои санаи интихобшуда аллакай версияи тариф мавҷуд аст."
      : code === "ADJUSTED_AMOUNT_OUT_OF_RANGE" ? "Маблағи нави тариф аз ҳудуди иҷозатшуда берун мебарояд."
      : code === "PLAN_LIMIT_REACHED" ? "Ҳадди 5 амалиёти ройгони тарификатсия истифода шуд. Барои идома ба нақшаи PRO гузаред."
      : "Тағйироти тариф сабт нашуд. Маълумотро санҷед ва такрор кунед.";
    const status = authError ? 401 : code === "PLAN_LIMIT_REACHED" ? 402 : validationError ? 400
      : code === "NO_ACTIVE_TARIFFS" ? 404 : code === "TARIFF_VERSION_ALREADY_EXISTS" ? 409 : code === "ADJUSTED_AMOUNT_OUT_OF_RANGE" ? 400 : 500;
    const publicCode = ["NO_ACTIVE_TARIFFS", "TARIFF_VERSION_ALREADY_EXISTS", "ADJUSTED_AMOUNT_OUT_OF_RANGE", "PLAN_LIMIT_REACHED"].includes(code) ? code : undefined;
    return new Response(superjson.stringify({ message, code: publicCode }), { status, headers: { "Content-Type": "application/json" } });
  }
}
