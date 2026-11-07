import { getServerUserSession } from "../../helpers/getServerUserSession";
import { db } from "../../helpers/db";
import { z } from "zod";
import superjson from "superjson";

const schema = z.object({ institutionId: z.string().uuid(), grade: z.number().int().min(1).max(11), section: z.string().trim().min(1).max(8), academicYear: z.string().regex(/^20[0-9]{2}-20[0-9]{2}$/), classTeacherStaffId: z.string().uuid().nullable().optional() });
export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const input = schema.parse(superjson.parse(await request.text()));
    const access = await db.selectFrom("institutionMemberships").innerJoin("institutions", "institutions.id", "institutionMemberships.institutionId").select("institutionMemberships.id").where("institutionMemberships.institutionId", "=", input.institutionId).where("institutionMemberships.userId", "=", user.id).where("institutionMemberships.isActive", "=", true).where("institutionMemberships.role", "=", "director").where("institutions.status", "=", "approved").executeTakeFirst();
    if (user.role !== "admin" && !access) return new Response(superjson.stringify({ message: "Танҳо директори муассисаи тасдиқшуда метавонад синф илова кунад." }), { status: 403 });
    if (input.classTeacherStaffId) {
      const teacher = await db.selectFrom("institutionStaff").select("id").where("id", "=", input.classTeacherStaffId).where("institutionId", "=", input.institutionId).where("isActive", "=", true).executeTakeFirst();
      if (!teacher) return new Response(superjson.stringify({ message: "Роҳбари синф дар рӯйхати кормандони ҳамин муассиса ёфт нашуд." }), { status: 400 });
    }
    const created = await db.transaction().execute(async trx => {
      const row = await trx.insertInto("institutionClasses").values({ institutionId: input.institutionId, grade: input.grade, section: input.section, academicYear: input.academicYear, classTeacherStaffId: input.classTeacherStaffId || null, createdBy: user.id }).returningAll().executeTakeFirstOrThrow();
      await trx.insertInto("institutionAuditLogs").values({ institutionId: input.institutionId, actorUserId: user.id, action: "class.created", entityType: "institution_class", entityId: row.id, details: { grade: row.grade, section: row.section, academicYear: row.academicYear } }).execute();
      return row;
    });
    return new Response(superjson.stringify({ class: created }), { status: 201, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    const status = (error as { name?: string })?.name === "NotAuthenticatedError" ? 401 : error instanceof z.ZodError ? 400 : 409;
    return new Response(superjson.stringify({ message: error instanceof z.ZodError ? "Маълумоти синф нодуруст аст." : "Сабти синф иҷро нашуд. Эҳтимол ин синф барои соли таҳсили интихобшуда аллакай вуҷуд дорад." }), { status, headers: { "Content-Type": "application/json" } });
  }
}
