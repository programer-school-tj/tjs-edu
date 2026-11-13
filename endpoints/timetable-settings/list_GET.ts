import { getServerUserSession } from "../../helpers/getServerUserSession";
import { db } from "../../helpers/db";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const params = new URL(request.url).searchParams;
    const institutionId = params.get("institutionId");
    const academicYear = params.get("academicYear") || "2026-2027";
    if (!institutionId) return new Response(superjson.stringify({ message: "Муассисаро интихоб кунед." }), { status: 400 });
    const access = await db.selectFrom("institutionMemberships")
      .innerJoin("institutions", "institutions.id", "institutionMemberships.institutionId")
      .select("institutionMemberships.id")
      .where("institutionMemberships.institutionId", "=", institutionId)
      .where("institutionMemberships.userId", "=", user.id)
      .where("institutionMemberships.isActive", "=", true)
      .where("institutionMemberships.role", "=", "director")
      .where("institutions.status", "=", "approved").executeTakeFirst();
    if (user.role !== "admin" && !access) return new Response(superjson.stringify({ message: "Барои дидани танзимоти ҷадвал иҷозат надоред." }), { status: 403 });
    const saved = await db.selectFrom("institutionTimetableSettings")
      .selectAll()
      .where("institutionId", "=", institutionId)
      .where("academicYear", "=", academicYear)
      .executeTakeFirst();
    const settings = saved || {
      institutionId, academicYear, schoolDays: 6, maxLessonsPerDay: 6,
      teacherDailyLimit: 6, classDailyLimit: 6, shiftSplitGrade: 7,
      teacherDailyLimits: {}, classDailyLimits: {},
    };
    return new Response(superjson.stringify({ settings }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    const status = (error as { name?: string })?.name === "NotAuthenticatedError" ? 401 : 400;
    return new Response(superjson.stringify({ message: "Гирифтани танзимоти ҷадвал иҷро нашуд." }), { status });
  }
}
