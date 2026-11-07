import { getServerUserSession } from "../../helpers/getServerUserSession";
import { db } from "../../helpers/db";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const p = new URL(request.url).searchParams;
    const institutionId = p.get("institutionId") || "";
    const classId = p.get("classId") || "";
    const date = p.get("date") || "";
    if (!institutionId || !classId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return new Response(superjson.stringify({ message: "Муассиса, синф ва санаи дурустро интихоб кунед." }), { status: 400 });
    const access = await db.selectFrom("institutionMemberships").innerJoin("institutions", "institutions.id", "institutionMemberships.institutionId").select("institutionMemberships.id").where("institutionMemberships.institutionId", "=", institutionId).where("institutionMemberships.userId", "=", user.id).where("institutionMemberships.isActive", "=", true).where("institutionMemberships.role", "=", "director").where("institutions.status", "=", "approved").executeTakeFirst();
    if (user.role !== "admin" && !access) return new Response(superjson.stringify({ message: "Барои дидани давомоти ин муассиса иҷозат надоред." }), { status: 403 });
    const students = await db.selectFrom("institutionStudents as s").leftJoin("institutionAttendance as a", join => join.onRef("a.studentId", "=", "s.id").on("a.attendanceDate", "=", new Date(`${date}T00:00:00.000Z`))).select(["s.id as studentId","s.fullName","s.studentNumber","a.status as status","a.note as note"]).where("s.institutionId", "=", institutionId).where("s.classId", "=", classId).where("s.enrollmentStatus", "=", "active").orderBy("s.fullName").execute();
    return new Response(superjson.stringify({ students }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    const status = (error as { name?: string })?.name === "NotAuthenticatedError" ? 401 : 400;
    return new Response(superjson.stringify({ message: "Гирифтани давомот иҷро нашуд." }), { status, headers: { "Content-Type": "application/json" } });
  }
}
