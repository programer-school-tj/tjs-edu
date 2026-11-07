import { getServerUserSession } from "../../helpers/getServerUserSession";
import { db } from "../../helpers/db";
import { z } from "zod";
import superjson from "superjson";

const schema = z.object({ institutionId: z.string().uuid(), classId: z.string().uuid(), fullName: z.string().trim().min(3).max(180), birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")), gender: z.enum(["male","female","other"]).optional(), studentNumber: z.string().trim().max(40).optional(), guardianName: z.string().trim().max(180).optional(), guardianPhone: z.string().trim().max(40).optional() });
export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const input = schema.parse(superjson.parse(await request.text()));
    const access = await db.selectFrom("institutionMemberships").innerJoin("institutions", "institutions.id", "institutionMemberships.institutionId").select("institutionMemberships.id").where("institutionMemberships.institutionId", "=", input.institutionId).where("institutionMemberships.userId", "=", user.id).where("institutionMemberships.isActive", "=", true).where("institutionMemberships.role", "=", "director").where("institutions.status", "=", "approved").executeTakeFirst();
    if (user.role !== "admin" && !access) return new Response(superjson.stringify({ message: "Танҳо директори муассисаи тасдиқшуда метавонад хонанда сабт кунад." }), { status: 403 });
    const schoolClass = await db.selectFrom("institutionClasses").select("id").where("id", "=", input.classId).where("institutionId", "=", input.institutionId).executeTakeFirst();
    if (!schoolClass) return new Response(superjson.stringify({ message: "Синфи интихобшуда ба ин муассиса тааллуқ надорад." }), { status: 400 });
    const created = await db.transaction().execute(async trx => {
      const row = await trx.insertInto("institutionStudents").values({ institutionId: input.institutionId, classId: input.classId, fullName: input.fullName, birthDate: input.birthDate ? new Date(`${input.birthDate}T00:00:00.000Z`) : null, gender: input.gender || null, studentNumber: input.studentNumber || null, guardianName: input.guardianName || null, guardianPhone: input.guardianPhone || null, createdBy: user.id }).returningAll().executeTakeFirstOrThrow();
      await trx.insertInto("institutionAuditLogs").values({ institutionId: input.institutionId, actorUserId: user.id, action: "student.created", entityType: "institution_student", entityId: row.id, details: { fullName: row.fullName, classId: row.classId } }).execute();
      return row;
    });
    return new Response(superjson.stringify({ student: created }), { status: 201, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    const status = (error as { name?: string })?.name === "NotAuthenticatedError" ? 401 : error instanceof z.ZodError ? 400 : 409;
    return new Response(superjson.stringify({ message: error instanceof z.ZodError ? "Маълумоти хонанда нодуруст аст." : "Сабти хонанда иҷро нашуд. Рақами шахсӣ такрор нашуда бошад." }), { status, headers: { "Content-Type": "application/json" } });
  }
}
