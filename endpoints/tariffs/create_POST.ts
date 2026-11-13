import { getServerUserSession } from "../../helpers/getServerUserSession";
import { db } from "../../helpers/db";
import { withPlanQuota } from "../../helpers/planQuota";
import { z } from "zod";
import superjson from "superjson";

const hasAtMostTwoDecimals = (value: number) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-7;

const schema = z.object({
  institutionId: z.string().uuid(),
  staffId: z.string().uuid().optional(),
  positionTitle: z.string().trim().min(2).max(120),
  educationLevel: z.string().max(100).optional(),
  qualificationCategory: z.string().max(100).optional(),
  weeklyHours: z.number().positive("Соатҳои ҳафтаина бояд аз сифр зиёд бошанд.").max(60).optional(),
  monthlyBase: z.number().positive("Маблағи музди асосӣ бояд аз сифр зиёд бошад.").max(1000000).refine(hasAtMostTwoDecimals, "Музди моҳона бояд то 2 рақами пас аз вергул бошад."),
  effectiveFrom: z.string().date(),
  effectiveTo: z.string().date().optional(),
  academicYear: z.string().regex(/^20[0-9]{2}-20[0-9]{2}$/),
  sourceTitle: z.string().max(240).optional(),
  sourceReference: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
}).refine(
  (value) => !value.effectiveTo || value.effectiveTo >= value.effectiveFrom,
  { path: ["effectiveTo"], message: "Санаи анҷом набояд аз санаи оғоз пештар бошад." },
).refine(
  (value) => {
    const [startYear, endYear] = value.academicYear.split("-").map(Number);
    if (endYear !== startYear + 1) return false;
    const schoolYearStart = `${startYear}-09-01`;
    const schoolYearEnd = `${endYear}-08-31`;
    return value.effectiveFrom >= schoolYearStart
      && value.effectiveFrom <= schoolYearEnd
      && (!value.effectiveTo || value.effectiveTo <= schoolYearEnd);
  },
  { path: ["academicYear"], message: "Соли таҳсил бояд пайдарпай бошад ва муҳлати тариф дар ҳудуди сентябр–август ҷой гирад." },
);

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
      return new Response(superjson.stringify({ message: "Танҳо директори муассисаи тасдиқшуда метавонад тариф ворид кунад." }), { status: 403 });
    }

    const outcome = await withPlanQuota(x.institutionId, "tariffs", async (trx) => {
      if (x.staffId) {
        const staff = await trx.selectFrom("institutionStaff")
          .select(["id", "positionTitle"])
          .where("id", "=", x.staffId)
          .where("institutionId", "=", x.institutionId)
          .executeTakeFirst();

        if (!staff) throw new Error("STAFF_NOT_FOUND");
        if (staff.positionTitle.trim().toLocaleLowerCase() !== x.positionTitle.trim().toLocaleLowerCase()) {
          throw new Error("STAFF_POSITION_MISMATCH");
        }
      }

      const existingTariffs = await trx.selectFrom("institutionTariffs")
        .select(["id", "staffId", "positionTitle", "educationLevel", "qualificationCategory", "effectiveFrom", "effectiveTo"])
        .where("institutionId", "=", x.institutionId)
        .where("academicYear", "=", x.academicYear)
        .execute();

      const normalize = (value: string | null | undefined) => (value || "").trim().toLocaleLowerCase();
      const newStart = new Date(`${x.effectiveFrom}T00:00:00.000Z`).getTime();
      const newEnd = x.effectiveTo ? new Date(`${x.effectiveTo}T23:59:59.999Z`).getTime() : Number.POSITIVE_INFINITY;
      const overlapping = existingTariffs.some((item) => {
        const sameScope = item.staffId === (x.staffId || null)
          && normalize(item.positionTitle) === normalize(x.positionTitle)
          && normalize(item.educationLevel) === normalize(x.educationLevel)
          && normalize(item.qualificationCategory) === normalize(x.qualificationCategory);
        if (!sameScope) return false;
        const oldStart = item.effectiveFrom.getTime();
        const oldEnd = item.effectiveTo ? item.effectiveTo.getTime() : Number.POSITIVE_INFINITY;
        return newStart <= oldEnd && oldStart <= newEnd;
      });
      if (overlapping) throw new Error("TARIFF_PERIOD_OVERLAP");

      const monthlyBase = Math.round(x.monthlyBase * 100) / 100;
      return trx.insertInto("institutionTariffs").values({
        institutionId: x.institutionId,
        staffId: x.staffId || null,
        positionTitle: x.positionTitle,
        educationLevel: x.educationLevel || null,
        qualificationCategory: x.qualificationCategory || null,
        weeklyHours: x.weeklyHours ?? null,
        monthlyBase,
        effectiveFrom: new Date(x.effectiveFrom),
        effectiveTo: x.effectiveTo ? new Date(x.effectiveTo) : null,
        academicYear: x.academicYear,
        sourceTitle: x.sourceTitle || null,
        sourceReference: x.sourceReference || null,
        notes: x.notes || null,
        createdBy: user.id,
      }).returningAll().executeTakeFirstOrThrow();
    });

    return new Response(superjson.stringify({
      tariff: outcome.result,
      operationCount: outcome.operationCount,
      plan: outcome.plan,
    }), { status: 201, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const isAuthError = (error as { name?: string })?.name === "NotAuthenticatedError";
    const isValidationError = error instanceof z.ZodError || code === "STAFF_POSITION_MISMATCH";
    const message = error instanceof z.ZodError ? (error.issues[0]?.message || "Маълумоти тариф нодуруст аст.")
      : code === "PLAN_LIMIT_REACHED" ? "Ҳадди 5 амалиёти ройгони тарификатсия истифода шуд. Барои идома ба нақшаи PRO гузаред."
      : code === "STAFF_NOT_FOUND" ? "Корманди интихобшуда дар ин муассиса нест."
      : code === "STAFF_POSITION_MISMATCH" ? "Вазифаи тариф ба вазифаи корманди интихобшуда мувофиқат намекунад."
      : code === "TARIFF_PERIOD_OVERLAP" ? "Барои ҳамин корманд ва гурӯҳи тарифӣ дар ин муҳлат тарифи дигар мавҷуд аст. Сана ё тарифро санҷед."
      : "Ҳангоми сабти тариф хатои дохилӣ рух дод. Лутфан баъдтар такрор кунед.";
    const status = isAuthError ? 401
      : code === "PLAN_LIMIT_REACHED" ? 402
      : code === "STAFF_NOT_FOUND" ? 404
      : code === "TARIFF_PERIOD_OVERLAP" ? 409
      : isValidationError ? 400
      : 500;
    const publicCode = ["PLAN_LIMIT_REACHED", "STAFF_NOT_FOUND", "STAFF_POSITION_MISMATCH", "TARIFF_PERIOD_OVERLAP"].includes(code) ? code : undefined;

    return new Response(superjson.stringify({ message, code: publicCode }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
}
