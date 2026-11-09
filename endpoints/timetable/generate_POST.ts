import { getServerUserSession } from "../../helpers/getServerUserSession";
import { db } from "../../helpers/db";
import { withPlanQuota } from "../../helpers/planQuota";
import { z } from "zod";
import superjson from "superjson";

const schema = z.object({
  institutionId: z.string().uuid(),
  academicYear: z.string().regex(/^20[0-9]{2}-20[0-9]{2}$/),
});

type Slot = { weekday: number; lessonNumber: number; shiftNumber: number };
type Task = { loadId: string; classId: string; staffId: string; subject: string; shiftNumber: number; grade: number; weeklyHours: number };

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

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
    if (user.role !== "admin" && !access) return new Response(superjson.stringify({ message: "Танҳо роҳбари муассиса метавонад ҷадвал созад." }), { status: 403 });

    const result = await withPlanQuota(x.institutionId, "timetable", async (trx) => {
      const [loads, staff, existing, availability] = await Promise.all([
        trx.selectFrom("institutionTeachingLoads").innerJoin("institutionClasses", "institutionClasses.id", "institutionTeachingLoads.classId")
          .select(["institutionTeachingLoads.id", "institutionTeachingLoads.classId", "institutionTeachingLoads.staffId", "institutionTeachingLoads.subject", "institutionTeachingLoads.weeklyHours", "institutionClasses.grade"])
          .where("institutionTeachingLoads.institutionId", "=", x.institutionId).where("institutionTeachingLoads.academicYear", "=", x.academicYear).execute(),
        trx.selectFrom("institutionStaff").select(["id", "workloadHours"]).where("institutionId", "=", x.institutionId).where("isActive", "=", true).execute(),
        trx.selectFrom("institutionTimetableEntries").select(["id", "classId", "staffId", "subject", "weekday", "lessonNumber", "shiftNumber"])
          .where("institutionId", "=", x.institutionId).where("academicYear", "=", x.academicYear).execute(),
        trx.selectFrom("institutionStaffAvailability").select(["staffId", "weekday", "lessonNumber"])
          .where("institutionId", "=", x.institutionId).where("academicYear", "=", x.academicYear).execute(),
      ]);
      if (!loads.length) throw new Error("NO_TEACHING_LOADS");
      const staffMap = new Map(staff.map((row) => [row.id, row]));
      const loadHours = new Map<string, number>();
      const remainingLoadCapacity = new Map<string, number>();
      for (const load of loads) {
        const hours = Number(load.weeklyHours);
        if (!Number.isInteger(hours)) throw new Error("FRACTIONAL_LOAD");
        loadHours.set(load.staffId, (loadHours.get(load.staffId) || 0) + hours);
        const key = load.classId + ":" + load.staffId + ":" + load.subject.trim().toLocaleLowerCase();
        remainingLoadCapacity.set(key, (remainingLoadCapacity.get(key) || 0) + hours);
      }

      // Existing entries outside defined teaching loads also consume approved workload.
      const extraExistingHours = new Map<string, number>();
      for (const entry of existing) {
        const key = entry.classId + ":" + entry.staffId + ":" + entry.subject.trim().toLocaleLowerCase();
        const capacity = remainingLoadCapacity.get(key) || 0;
        if (capacity > 0) remainingLoadCapacity.set(key, capacity - 1);
        else extraExistingHours.set(entry.staffId, (extraExistingHours.get(entry.staffId) || 0) + 1);
      }
      for (const staffId of new Set([...loadHours.keys(), ...extraExistingHours.keys()])) {
        const planned = (loadHours.get(staffId) || 0) + (extraExistingHours.get(staffId) || 0);
        const approved = staffMap.get(staffId)?.workloadHours;
        if (approved !== null && approved !== undefined && planned > Number(approved)) throw new Error("LOAD_EXCEEDS_APPROVED");
      }
      const tasks: Task[] = [];
      for (const load of loads) {
        const weeklyHours = Number(load.weeklyHours);
        const already = existing.filter((entry) => entry.classId === load.classId && entry.staffId === load.staffId && entry.subject.trim().toLocaleLowerCase() === load.subject.trim().toLocaleLowerCase()).length;
        for (let i = already; i < weeklyHours; i++) {
          tasks.push({ loadId: load.id, classId: load.classId, staffId: load.staffId, subject: load.subject, shiftNumber: Number(load.grade) <= 7 ? 2 : 1, grade: Number(load.grade), weeklyHours });
        }
      }
      if (!tasks.length) return { created: 0, unplaced: [] as string[] };

      const blockedTeacherSlots = new Set(availability.map((slot) => `${slot.staffId}:${slot.weekday}:${slot.lessonNumber}`));
      const classSlots = new Set(existing.map((e) => `${e.classId}:${e.weekday}:${e.lessonNumber}`));
      const teacherSlots = new Set(existing.map((e) => `${e.staffId}:${e.weekday}:${e.shiftNumber}:${e.lessonNumber}`));
      const classDayCounts = new Map<string, number>();
      const teacherDayCounts = new Map<string, number>();
      for (const e of existing) {
        const ck = `${e.classId}:${e.weekday}`;
        classDayCounts.set(ck, (classDayCounts.get(ck) || 0) + 1);
        const tk = `${e.staffId}:${e.weekday}`;
        teacherDayCounts.set(tk, (teacherDayCounts.get(tk) || 0) + 1);
      }

      let best: Slot[] | null = null;
      let bestTasks: Task[] = [];
      const slotList: Slot[] = [];
      for (let weekday = 1; weekday <= 6; weekday++) for (let lessonNumber = 1; lessonNumber <= 6; lessonNumber++) slotList.push({ weekday, lessonNumber, shiftNumber: 1 }, { weekday, lessonNumber, shiftNumber: 2 });

      for (let attempt = 0; attempt < 80 && !best; attempt++) {
        const occupiedClass = new Set(classSlots);
        const occupiedTeacher = new Set(teacherSlots);
        const dayClasses = new Map(classDayCounts);
        const dayTeachers = new Map(teacherDayCounts);
        const remaining = shuffle(tasks);
        const placed: Array<Slot | null> = new Array(remaining.length).fill(null);
        let success = true;

        for (let i = 0; i < remaining.length; i++) {
          const task = remaining[i];
          const candidates = slotList.filter((slot) =>
            slot.shiftNumber === task.shiftNumber &&
            !occupiedClass.has(`${task.classId}:${slot.weekday}:${slot.lessonNumber}`) &&
            !occupiedTeacher.has(`${task.staffId}:${slot.weekday}:${slot.shiftNumber}:${slot.lessonNumber}`) &&
            !blockedTeacherSlots.has(`${task.staffId}:${slot.weekday}:0`) &&
            !blockedTeacherSlots.has(`${task.staffId}:${slot.weekday}:${slot.lessonNumber}`) &&
            (dayClasses.get(`${task.classId}:${slot.weekday}`) || 0) < 6
          );
          if (!candidates.length) { success = false; break; }
          const rankedCandidates = candidates.map((slot) => ({
            slot,
            score:
              (dayClasses.get(`${task.classId}:${slot.weekday}`) || 0) * 10 +
              (dayTeachers.get(`${task.staffId}:${slot.weekday}`) || 0) * 4 +
              slot.lessonNumber * 0.01 + Math.random() * 0.2,
          }));
          rankedCandidates.sort((a, b) => a.score - b.score);
          const chosen = rankedCandidates[0].slot;
          placed[i] = chosen;
          occupiedClass.add(`${task.classId}:${chosen.weekday}:${chosen.lessonNumber}`);
          occupiedTeacher.add(`${task.staffId}:${chosen.weekday}:${chosen.shiftNumber}:${chosen.lessonNumber}`);
          const ck = `${task.classId}:${chosen.weekday}`;
          dayClasses.set(ck, (dayClasses.get(ck) || 0) + 1);
          const tk = `${task.staffId}:${chosen.weekday}`;
          dayTeachers.set(tk, (dayTeachers.get(tk) || 0) + 1);
        }
        if (success) { best = placed as Slot[]; bestTasks = remaining; }
      }

      if (!best) throw new Error("SCHEDULE_NOT_FIT");
      const rows = bestTasks.map((task, index) => ({
        institutionId: x.institutionId, classId: task.classId, staffId: task.staffId, subject: task.subject,
        shiftNumber: best![index].shiftNumber, weekday: best![index].weekday, lessonNumber: best![index].lessonNumber,
        room: null, academicYear: x.academicYear, createdBy: user.id,
      }));
      await trx.insertInto("institutionTimetableEntries").values(rows).execute();
      return { created: rows.length, unplaced: [] as string[] };
    });
    return new Response(superjson.stringify({ ...result.result, operationCount: result.operationCount, plan: result.plan }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const message = code === "NO_TEACHING_LOADS" ? "Аввал сарбории омӯзгоронро ворид кунед."
      : code === "FRACTIONAL_LOAD" ? "Барои ҷадвали дарсӣ соатҳои ҳарҳафтаина бояд адади бутун бошанд."
      : code === "LOAD_EXCEEDS_APPROVED" ? "Ҷамъи сарбории фаннӣ аз сарбории тасдиқшудаи омӯзгор зиёд аст."
      : code === "SCHEDULE_NOT_FIT" ? "Бо маҳдудиятҳои ҷорӣ ҳамаи дарсҳо ҷой нагирифтанд. Сарборӣ ё маҳдудиятҳоро аз нав санҷед."
      : "Тартиб додани ҷадвали худкор иҷро нашуд.";
    return new Response(superjson.stringify({ message, code: code || undefined }), { status: code === "SCHEDULE_NOT_FIT" ? 409 : 400, headers: { "Content-Type": "application/json" } });
  }
}
