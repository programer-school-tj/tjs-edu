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
    lessonNumber: z.number().int().min(1).max(6),
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
      const [classes, staff, existing] = await Promise.all([
        trx.selectFrom("institutionClasses").select(["id", "grade", "section"])
          .where("institutionId", "=", x.institutionId).where("academicYear", "=", x.academicYear).execute(),
        trx.selectFrom("institutionStaff").select(["id", "fullName", "workloadHours"])
          .where("institutionId", "=", x.institutionId).where("isActive", "=", true).execute(),
        trx.selectFrom("institutionTimetableEntries").select(["classId", "staffId", "weekday", "lessonNumber", "shiftNumber"])
          .where("institutionId", "=", x.institutionId).where("academicYear", "=", x.academicYear).execute(),
      ]);
      const classMap = new Map(classes.map((row) => [`${row.grade}:${row.section.trim().toLocaleLowerCase()}`, row]));
      const staffMap = new Map(staff.map((row) => [row.fullName.trim().toLocaleLowerCase(), row]));
      const teacherHours = new Map<string, number>();
      for (const row of existing) teacherHours.set(row.staffId, (teacherHours.get(row.staffId) || 0) + 1);
      const occupiedClass = new Set(existing.map((row) => `${row.classId}:${row.weekday}:${row.lessonNumber}`));
      const occupiedTeacher = new Set(existing.map((row) => `${row.staffId}:${row.weekday}:${row.shiftNumber}:${row.lessonNumber}`));
      const newRows: Array<{ institutionId: string; classId: string; staffId: string; subject: string; shiftNumber: number; weekday: number; lessonNumber: number; room: string | null; academicYear: string; createdBy: number }> = [];
      const importedHours = new Map<string, number>();

      for (let index = 0; index < x.rows.length; index++) {
        const row = x.rows[index];
        const cls = classMap.get(`${row.grade}:${row.section.trim().toLocaleLowerCase()}`);
        const teacher = staffMap.get(row.teacherName.trim().toLocaleLowerCase());
        if (!cls) throw new Error(`ROW_${index + 2}_CLASS_NOT_FOUND`);
        if (!teacher) throw new Error(`ROW_${index + 2}_TEACHER_NOT_FOUND`);
        const shiftNumber = Number(cls.grade) <= 7 ? 2 : 1;
        const classSlot = `${cls.id}:${row.weekday}:${row.lessonNumber}`;
        const teacherSlot = `${teacher.id}:${row.weekday}:${shiftNumber}:${row.lessonNumber}`;
        if (occupiedClass.has(classSlot) || occupiedTeacher.has(teacherSlot)) throw new Error(`ROW_${index + 2}_CONFLICT`);
        occupiedClass.add(classSlot);
        occupiedTeacher.add(teacherSlot);
        importedHours.set(teacher.id, (importedHours.get(teacher.id) || 0) + 1);
        newRows.push({
          institutionId: x.institutionId, classId: cls.id, staffId: teacher.id,
          subject: row.subject, shiftNumber, weekday: row.weekday, lessonNumber: row.lessonNumber,
          room: row.room || null, academicYear: x.academicYear, createdBy: user.id,
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
    const rowMatch = /^ROW_(\d+)_(CLASS_NOT_FOUND|TEACHER_NOT_FOUND|CONFLICT)$/.exec(code);
    const message = error instanceof z.ZodError ? "Файли Excel ё маълумоти он нодуруст аст."
      : rowMatch?.[2] === "CLASS_NOT_FOUND" ? `Синфи сатри ${rowMatch[1]} дар муассиса ёфт нашуд.`
      : rowMatch?.[2] === "TEACHER_NOT_FOUND" ? `Омӯзгори сатри ${rowMatch[1]} дар рӯйхати кормандон ёфт нашуд.`
      : rowMatch?.[2] === "CONFLICT" ? `Дар сатри ${rowMatch[1]} ихтилофи вақт вуҷуд дорад. Ҷадвал ворид нашуд.`
      : code === "IMPORT_WORKLOAD_EXCEEDED" ? "Соатҳои воридшаванда аз сарбории тасдиқшудаи омӯзгор зиёд мешаванд."
      : code === "PLAN_LIMIT_REACHED" ? "Ҳадди амалиёти ройгони ҷадвали дарсӣ истифода шуд. Барои идома ба нақшаи PRO гузаред."
      : "Ворид кардани ҷадвал иҷро нашуд.";
    const status = code === "PLAN_LIMIT_REACHED" ? 402 : rowMatch?.[2] === "CONFLICT" ? 409 : 400;
    return new Response(superjson.stringify({ message, code: code || undefined }), { status, headers: { "Content-Type": "application/json" } });
  }
}
