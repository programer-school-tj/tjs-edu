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
    if (user.role !== "admin" && !access) return new Response(superjson.stringify({ message: "Иҷозат надоред." }), { status: 403 });
    const loads = await db.selectFrom("institutionTeachingLoads")
      .innerJoin("institutionStaff", "institutionStaff.id", "institutionTeachingLoads.staffId")
      .innerJoin("institutionClasses", "institutionClasses.id", "institutionTeachingLoads.classId")
      .select(["institutionTeachingLoads.id", "institutionTeachingLoads.staffId", "institutionTeachingLoads.classId",
        "institutionTeachingLoads.subject", "institutionTeachingLoads.weeklyHours", "institutionTeachingLoads.academicYear",
        "institutionStaff.fullName as teacherName", "institutionClasses.grade", "institutionClasses.section"])
      .where("institutionTeachingLoads.institutionId", "=", institutionId)
      .where("institutionTeachingLoads.academicYear", "=", academicYear)
      .orderBy("institutionClasses.grade").orderBy("institutionClasses.section").orderBy("institutionStaff.fullName").execute();
    return new Response(superjson.stringify({ loads }), { headers: { "Content-Type": "application/json" } });
  } catch {
    return new Response(superjson.stringify({ message: "Сарбории фаннӣ дастрас нест." }), { status: 400 });
  }
}
