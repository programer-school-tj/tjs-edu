import { getServerUserSession } from "../../helpers/getServerUserSession";
import { db } from "../../helpers/db";
import { z } from "zod";
import superjson from "superjson";

const schema = z.object({ institutionId: z.string().uuid(), classId: z.string().uuid(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => { const [year, month, day] = value.split("-").map(Number); const parsed = new Date(Date.UTC(year, month - 1, day)); return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day; }, "Сана нодуруст аст."), records: z.array(z.object({ studentId: z.string().uuid(), status: z.enum(["present","absent","late","excused"]), note: z.string().max(300).optional().default("") })).min(1).max(100) }).refine(input => new Set(input.records.map(record => record.studentId)).size === input.records.length, "Рӯйхат хонандаи такрорӣ дорад.");
export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const input = schema.parse(superjson.parse(await request.text()));
    const access = await db.selectFrom("institutionMemberships").innerJoin("institutions", "institutions.id", "institutionMemberships.institutionId").select("institutionMemberships.id").where("institutionMemberships.institutionId", "=", input.institutionId).where("institutionMemberships.userId", "=", user.id).where("institutionMemberships.isActive", "=", true).where("institutionMemberships.role", "=", "director").where("institutions.status", "=", "approved").executeTakeFirst();
    if (user.role !== "admin" && !access) return new Response(superjson.stringify({ message: "Танҳо директори муассисаи тасдиқшуда метавонад давомотро сабт кунад." }), { status: 403 });
    const valid = await db.selectFrom("institutionStudents").select("id").where("institutionId", "=", input.institutionId).where("classId", "=", input.classId).where("id", "in", input.records.map(r => r.studentId)).execute();
    if (valid.length !== input.records.length) return new Response(superjson.stringify({ message: "Баъзе хонандагон ба синфи интихобшуда тааллуқ надоранд." }), { status: 400 });
    await db.transaction().execute(async trx => {
      for (const record of input.records) {
        await trx.insertInto("institutionAttendance").values({ institutionId: input.institutionId, classId: input.classId, studentId: record.studentId, attendanceDate: new Date(`${input.date}T00:00:00.000Z`), status: record.status, note: record.note || null, createdBy: user.id }).onConflict(oc => oc.columns(["institutionId","studentId","attendanceDate"]).doUpdateSet({ status: record.status, note: record.note || null, updatedAt: new Date() })).execute();
      }
      await trx.insertInto("institutionAuditLogs").values({ institutionId: input.institutionId, actorUserId: user.id, action: "attendance.saved", entityType: "institution_attendance", entityId: input.classId, details: { date: input.date, count: input.records.length } }).execute();
    });
    return new Response(superjson.stringify({ saved: input.records.length }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    const status = (error as { name?: string })?.name === "NotAuthenticatedError" ? 401 : error instanceof z.ZodError ? 400 : 409;
    return new Response(superjson.stringify({ message: error instanceof z.ZodError ? "Маълумоти давомот нодуруст аст." : "Сабти давомот иҷро нашуд." }), { status, headers: { "Content-Type": "application/json" } });
  }
}
