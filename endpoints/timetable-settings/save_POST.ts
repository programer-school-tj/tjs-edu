import { getServerUserSession } from "../../helpers/getServerUserSession";
import { db } from "../../helpers/db";
import { z } from "zod";
import superjson from "superjson";

const limitMap = z.record(z.string().uuid(), z.number().int().min(1).max(12)).default({});
const schema = z.object({
  institutionId: z.string().uuid(),
  academicYear: z.string().regex(/^20[0-9]{2}-20[0-9]{2}$/),
  schoolDays: z.number().int().min(1).max(6),
  maxLessonsPerDay: z.number().int().min(1).max(12),
  teacherDailyLimit: z.number().int().min(1).max(12),
  classDailyLimit: z.number().int().min(1).max(12),
  shiftSplitGrade: z.number().int().min(1).max(10),
  teacherDailyLimits: limitMap,
  classDailyLimits: limitMap,
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
    if (user.role !== "admin" && !access) return new Response(superjson.stringify({ message: "Танҳо роҳбари муассиса метавонад танзимоти ҷадвалро тағйир диҳад." }), { status: 403 });

    const teacherIds = Object.keys(x.teacherDailyLimits);
    const classIds = Object.keys(x.classDailyLimits);
    if (teacherIds.length) {
      const found = await db.selectFrom("institutionStaff").select("id")
        .where("institutionId", "=", x.institutionId).where("id", "in", teacherIds).execute();
      if (found.length !== teacherIds.length) return new Response(superjson.stringify({ message: "Дар танзимот омӯзгори муассисаи дигар ёфт шуд." }), { status: 400 });
    }
    if (classIds.length) {
      const found = await db.selectFrom("institutionClasses").select("id")
        .where("institutionId", "=", x.institutionId).where("id", "in", classIds)
        .where("academicYear", "=", x.academicYear).execute();
      if (found.length !== classIds.length) return new Response(superjson.stringify({ message: "Дар танзимот синфи муассисаи дигар ё соли таҳсили дигар ёфт шуд." }), { status: 400 });
    }

    await db.insertInto("institutionTimetableSettings").values({
      institutionId: x.institutionId, academicYear: x.academicYear,
      schoolDays: x.schoolDays, maxLessonsPerDay: x.maxLessonsPerDay,
      teacherDailyLimit: x.teacherDailyLimit, classDailyLimit: x.classDailyLimit,
      shiftSplitGrade: x.shiftSplitGrade,
      teacherDailyLimits: x.teacherDailyLimits as any,
      classDailyLimits: x.classDailyLimits as any,
      updatedBy: user.id, updatedAt: new Date(),
    }).onConflict((oc) => oc.columns(["institutionId", "academicYear"]).doUpdateSet({
      schoolDays: x.schoolDays, maxLessonsPerDay: x.maxLessonsPerDay,
      teacherDailyLimit: x.teacherDailyLimit, classDailyLimit: x.classDailyLimit,
      shiftSplitGrade: x.shiftSplitGrade,
      teacherDailyLimits: x.teacherDailyLimits as any,
      classDailyLimits: x.classDailyLimits as any,
      updatedBy: user.id, updatedAt: new Date(),
    })).execute();

    await db.insertInto("institutionAuditLogs").values({
      institutionId: x.institutionId, actorUserId: user.id, action: "timetable.settings.updated",
      entityType: "institution_timetable_settings", entityId: x.academicYear,
      details: { schoolDays: x.schoolDays, maxLessonsPerDay: x.maxLessonsPerDay,
        teacherDailyLimit: x.teacherDailyLimit, classDailyLimit: x.classDailyLimit,
        shiftSplitGrade: x.shiftSplitGrade },
    }).execute();

    return new Response(superjson.stringify({ saved: true }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    const status = (error as { name?: string })?.name === "NotAuthenticatedError" ? 401 : error instanceof z.ZodError ? 400 : 409;
    return new Response(superjson.stringify({ message: error instanceof z.ZodError ? "Маълумоти танзимоти ҷадвал нодуруст аст." : "Танзимоти ҷадвал сабт нашуд." }), { status, headers: { "Content-Type": "application/json" } });
  }
}
