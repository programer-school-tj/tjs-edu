import { getServerUserSession } from "../../helpers/getServerUserSession";
import { db } from "../../helpers/db";
import { withPlanQuota } from "../../helpers/planQuota";
import { z } from "zod";
import superjson from "superjson";

const schema = z.object({
  institutionId: z.string().uuid(),
  academicYear: z.string().regex(/^20[0-9]{2}-20[0-9]{2}$/),
  rows: z.array(z.object({
    grade: z.number().int().min(1).max(12),
    section: z.string().trim().min(1).max(8),
    weekday: z.number().int().min(1).max(6),
    lessonNumber: z.number().int().min(1).max(12),
    subject: z.string().trim().min(2).max(120),
    teacherName: z.string().trim().min(2).max(160),
    room: z.string().trim().max(40).optional().default(""),
  })).min(1).max(500),
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
      return new Response(superjson.stringify({ message: "Танҳо роҳбари муассиса метавонад ҷадвал ворид кунад." }), { status: 403 });
    }

    const result = await withPlanQuota(x.institutionId, "timetable", async (trx) => {
      const [classes, staff, existing, availability, settings] = await Promise.all([
        trx.selectFrom("institutionClasses").select(["id", "grade", "section"])
          .where("institutionId", "=", x.institutionId).where("academicYear", "=", x.academicYear).execute(),
        trx.selectFrom("institutionStaff").select(["id", "fullName", "workloadHours"])
          .where("institutionId", "=", x.institutionId).where("isActive", "=", true).execute(),
        trx.selectFrom("institutionTimetableEntries").select(["classId", "staffId", "weekday", "lessonNumber", "shiftNumber", "room"])
          .where("institutionId", "=", x.institutionId).where("academicYear", "=", x.academicYear).execute(),
        trx.selectFrom("institutionStaffAvailability").select(["staffId", "weekday", "lessonNumber"])
          .where("institutionId", "=", x.institutionId).where("academicYear", "=", x.academicYear).execute(),
        trx.selectFrom("institutionTimetableSettings").selectAll()
          .where("institutionId", "=", x.institutionId).where("academicYear", "=", x.academicYear).executeTakeFirst(),
      ]);
      const schoolDays = Number(settings?.schoolDays ?? 6);
      const maxLessons = Number(settings?.maxLessonsPerDay ?? 6);
      const teacherLimit = Number(settings?.teacherDailyLimit ?? 6);
      const classLimit = Number(settings?.classDailyLimit ?? 6);
      const shiftSplitGrade = Number(settings?.shiftSplitGrade ?? 7);
      const teacherDailyLimits = (settings?.teacherDailyLimits || {}) as Record<string, number>;
      const classDailyLimits = (settings?.classDailyLimits || {}) as Record<string, number>;
      const classMap = new Map(classes.map((row) => [`${row.grade}:${row.section.trim().toLocaleLowerCase()}`, row]));
      const staffMap = new Map(staff.map((row) => [row.fullName.trim().toLocaleLowerCase(), row]));
      const teacherHours = new Map<string, number>();
      const teacherDayHours = new Map<string, number>();
      const classDayHours = new Map<string, number>();
      for (const row of existing) {
        teacherHours.set(row.staffId, (teacherHours.get(row.staffId) || 0) + 1);
        const dayKey = row.staffId + ":" + row.weekday;
        teacherDayHours.set(dayKey, (teacherDayHours.get(dayKey) || 0) + 1);
        const classDayKey = row.classId + ":" + row.weekday;
        classDayHours.set(classDayKey, (classDayHours.get(classDayKey) || 0) + 1);
      }
      const occupiedClass = new Set(existing.map((row) => `${row.classId}:${row.weekday}:${row.lessonNumber}`));
      const occupiedTeacher = new Set(existing.map((row) => `${row.staffId}:${row.weekday}:${row.lessonNumber}`));
      const occupiedRooms = new Set(existing.filter((row) => row.room?.trim()).map((row) => `${row.room!.trim().toLocaleLowerCase()}:${row.weekday}:${row.lessonNumber}`));
      const newRows: Array<{ institutionId: string; classId: string; staffId: string; subject: string; shiftNumber: number; weekday: number; lessonNumber: number; room: string | null; academicYear: string; createdBy: number }> = [];
      const importedHours = new Map<string, number>();

      for (let index = 0; index < x.rows.length; index++) {
        const row = x.rows[index];
        const cls = classMap.get(`${row.grade}:${row.section.trim().toLocaleLowerCase()}`);
        const teacher = staffMap.get(row.teacherName.trim().toLocaleLowerCase());
        if (!cls) throw new Error(`ROW_${index + 2}_CLASS_NOT_FOUND`);
        if (!teacher) throw new Error(`ROW_${index + 2}_TEACHER_NOT_FOUND`);
        if (row.weekday > schoolDays || row.lessonNumber > maxLessons) throw new Error(`ROW_${index + 2}_SLOT_OUTSIDE_SETTINGS`);
        const shiftNumber = Number(cls.grade) <= shiftSplitGrade ? 2 : 1;
        const teacherUnavailable = availability.some((slot) => slot.staffId === teacher.id && slot.weekday === row.weekday && (slot.lessonNumber === 0 || slot.lessonNumber === row.lessonNumber));
        if (teacherUnavailable) throw new Error(`ROW_${index + 2}_TEACHER_UNAVAILABLE`);
        const teacherDayKey = teacher.id + ":" + row.weekday;
        if ((teacherDayHours.get(teacherDayKey) || 0) >= Math.min(teacherLimit, Number(teacherDailyLimits[teacher.id] ?? teacherLimit))) throw new Error(`ROW_${index + 2}_TEACHER_DAILY_LIMIT`);
        const classDayKey = cls.id + ":" + row.weekday;
        if ((classDayHours.get(classDayKey) || 0) >= Math.min(classLimit, Number(classDailyLimits[cls.id] ?? classLimit))) throw new Error(`ROW_${index + 2}_CLASS_DAILY_LIMIT`);
        const classSlot = `${cls.id}:${row.weekday}:${row.lessonNumber}`;
        const teacherSlot = `${teacher.id}:${row.weekday}:${row.lessonNumber}`;
        const normalizedRoom = row.room.trim().toLocaleLowerCase();
        const roomSlot = normalizedRoom ? `${normalizedRoom}:${row.weekday}:${row.lessonNumber}` : "";
        if (occupiedClass.has(classSlot) || occupiedTeacher.has(teacherSlot) || (roomSlot && occupiedRooms.has(roomSlot))) throw new Error(`ROW_${index + 2}_CONFLICT`);
        occupiedClass.add(classSlot);
        occupiedTeacher.add(teacherSlot);
        teacherDayHours.set(teacherDayKey, (teacherDayHours.get(teacherDayKey) || 0) + 1);
        classDayHours.set(classDayKey, (classDayHours.get(classDayKey) || 0) + 1);
        if (roomSlot) occupiedRooms.add(roomSlot);
        importedHours.set(teacher.id, (importedHours.get(teacher.id) || 0) + 1);
        newRows.push({
          institutionId: x.institutionId, classId: cls.id, staffId: teacher.id,
          subject: row.subject, shiftNumber, weekday: row.weekday, lessonNumber: row.lessonNumber,
          room: row.room.trim() || null, academicYear: x.academicYear, createdBy: user.id,
        });
      }

      for (const [staffId, addedHours] of importedHours) {
        const approved = staffMap.size ? staff.find((row) => row.id === staffId)?.workloadHours : null;
        const total = (teacherHours.get(staffId) || 0) + addedHours;
        if (approved !== null && approved !== undefined && total > Number(approved)) {
          throw new Error("IMPORT_WORKLOAD_EXCEEDED");
        }
      }
      await trx.insertInto("institutionTimetableEntries").values(newRows).execute();
      return { imported: newRows.length };
    });
    return new Response(superjson.stringify({ ...result.result, operationCount: result.operationCount, plan: result.plan }), {
      status: 201, headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const rowMatch = /^ROW_(\d+)_(CLASS_NOT_FOUND|TEACHER_NOT_FOUND|CONFLICT|TEACHER_UNAVAILABLE|TEACHER_DAILY_LIMIT|CLASS_DAILY_LIMIT|SLOT_OUTSIDE_SETTINGS)$/.exec(code);
    const message = error instanceof z.ZodError ? "Файли Excel ё маълумоти он нодуруст аст."
      : rowMatch?.[2] === "CLASS_NOT_FOUND" ? `Синфи сатри ${rowMatch[1]} дар муассиса ёфт нашуд.`
      : rowMatch?.[2] === "TEACHER_NOT_FOUND" ? `Омӯзгори сатри ${rowMatch[1]} дар рӯйхати кормандон ёфт нашуд.`
      : rowMatch?.[2] === "CONFLICT" ? `Дар сатри ${rowMatch[1]} ихтилофи вақт вуҷуд дорад. Ҷадвал ворид нашуд.`
      : rowMatch?.[2] === "TEACHER_UNAVAILABLE" ? `Омӯзгори сатри ${rowMatch[1]} дар ин рӯз ё соат дастрас нест. Ҷадвал ворид нашуд.`
      : rowMatch?.[2] === "TEACHER_DAILY_LIMIT" ? `Дар сатри ${rowMatch[1]} омӯзгор аз меъёри рӯзонаи интихобшуда зиёд дарс дорад. Ҷадвал ворид нашуд.`
      : rowMatch?.[2] === "CLASS_DAILY_LIMIT" ? `Дар сатри ${rowMatch[1]} синф аз меъёри рӯзонаи интихобшуда зиёд дарс дорад. Ҷадвал ворид нашуд.`
      : rowMatch?.[2] === "SLOT_OUTSIDE_SETTINGS" ? `Дар сатри ${rowMatch[1]} рӯз ё соати дарс аз танзимоти ҷадвал берун аст.`
      : code === "IMPORT_WORKLOAD_EXCEEDED" ? "Соатҳои воридшаванда аз сарбории тасдиқшудаи омӯзгор зиёд мешаванд."
      : code === "PLAN_LIMIT_REACHED" ? "Ҳадди амалиёти ройгони ҷадвали дарсӣ истифода шуд. Барои идома ба нақшаи PRO гузаред."
      : "Ворид кардани ҷадвал иҷро нашуд.";
    const status = (error as { name?: string })?.name === "NotAuthenticatedError" ? 401
      : code === "PLAN_LIMIT_REACHED" ? 402
      : rowMatch?.[2] === "CLASS_NOT_FOUND" || rowMatch?.[2] === "TEACHER_NOT_FOUND" ? 404
      : rowMatch?.[2] === "CONFLICT" || rowMatch?.[2] === "TEACHER_UNAVAILABLE" || rowMatch?.[2] === "TEACHER_DAILY_LIMIT" || rowMatch?.[2] === "CLASS_DAILY_LIMIT" || rowMatch?.[2] === "SLOT_OUTSIDE_SETTINGS" ? 409
      : code === "IMPORT_WORKLOAD_EXCEEDED" ? 422
      : error instanceof z.ZodError ? 400 : 500;
    return new Response(superjson.stringify({ message, code: code || undefined }), { status, headers: { "Content-Type": "application/json" } });
  }
}
