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
    const slots = await db.selectFrom("institutionStaffAvailability")
      .innerJoin("institutionStaff", "institutionStaff.id", "institutionStaffAvailability.staffId")
      .select(["institutionStaffAvailability.id", "institutionStaffAvailability.staffId", "institutionStaffAvailability.weekday", "institutionStaffAvailability.lessonNumber", "institutionStaffAvailability.academicYear", "institutionStaff.fullName as teacherName"])
      .where("institutionStaffAvailability.institutionId", "=", institutionId)
      .where("institutionStaffAvailability.academicYear", "=", academicYear)
      .orderBy("institutionStaffAvailability.staffId")
      .orderBy("institutionStaffAvailability.weekday")
      .orderBy("institutionStaffAvailability.lessonNumber").execute();
    return new Response(superjson.stringify({ slots }), { headers: { "Content-Type": "application/json" } });
  } catch {
    return new Response(superjson.stringify({ message: "Қоидаҳои дастрасии омӯзгорон дастрас нестанд." }), { status: 400 });
  }
}
