import { getServerUserSession } from "../../helpers/getServerUserSession";
import { db } from "../../helpers/db";
import { z } from "zod";
import superjson from "superjson";

const schema = z.object({
  institutionId: z.string().uuid(),
  documentType: z.enum(["tariffing", "payroll", "timetable"]),
  academicYear: z.string().regex(/^20[0-9]{2}-20[0-9]{2}$/),
  periodKey: z.string().max(40).default(""),
  templateVersion: z.string().max(80).default("2026-11-05-v1"),
  cells: z.record(z.string().regex(/^[A-Z]{1,3}[1-9][0-9]*$/), z.string().max(2000)).refine((value) => Object.keys(value).length <= 6000, "Ҳуҷайраҳо аз ҳад зиёданд."),
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
    if (user.role !== "admin" && !access) return new Response(superjson.stringify({ message: "Танҳо роҳбари муассисаи тасдиқшуда метавонад бланкаро сабт кунад." }), { status: 403 });

    const document = await db.insertInto("institutionFormDocuments").values({
      institutionId: input.institutionId,
      documentType: input.documentType,
      academicYear: input.academicYear,
      periodKey: input.periodKey,
      templateVersion: input.templateVersion,
      payload: { cells: input.cells },
      createdBy: user.id,
    }).onConflict((conflict) => conflict.columns(["institutionId", "documentType", "academicYear", "periodKey"]).doUpdateSet({
      templateVersion: input.templateVersion,
      payload: { cells: input.cells },
      createdBy: user.id,
      updatedAt: new Date(),
    })).returning(["id", "documentType", "academicYear", "periodKey", "updatedAt"]).executeTakeFirstOrThrow();

    return new Response(superjson.stringify({ document }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    const status = (error as { name?: string })?.name === "NotAuthenticatedError" ? 401 : error instanceof z.ZodError ? 400 : 500;
    const message = error instanceof z.ZodError ? "Маълумоти бланка нодуруст аст." : "Сабти бланка иҷро нашуд.";
    return new Response(superjson.stringify({ message }), { status, headers: { "Content-Type": "application/json" } });
  }
}
