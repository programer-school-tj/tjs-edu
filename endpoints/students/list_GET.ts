import { getServerUserSession } from "../../helpers/getServerUserSession";
import { db } from "../../helpers/db";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const params = new URL(request.url).searchParams;
    const institutionId = params.get("institutionId");
    const classId = params.get("classId");
    if (!institutionId) return new Response(superjson.stringify({ message: "Муассисаро интихоб кунед." }), { status: 400 });
    const access = await db.selectFrom("institutionMemberships").innerJoin("institutions", "institutions.id", "institutionMemberships.institutionId").select("institutionMemberships.id").where("institutionMemberships.institutionId", "=", institutionId).where("institutionMemberships.userId", "=", user.id).where("institutionMemberships.isActive", "=", true).where("institutionMemberships.role", "=", "director").where("institutions.status", "=", "approved").executeTakeFirst();
    if (user.role !== "admin" && !access) return new Response(superjson.stringify({ message: "Барои дидани хонандагони ин муассиса иҷозат надоред." }), { status: 403 });
    let query = db.selectFrom("institutionStudents").innerJoin("institutionClasses", "institutionClasses.id", "institutionStudents.classId").select(["institutionStudents.id","institutionStudents.institutionId","institutionStudents.classId","institutionStudents.fullName","institutionStudents.birthDate","institutionStudents.gender","institutionStudents.studentNumber","institutionStudents.guardianName","institutionStudents.guardianPhone","institutionStudents.enrollmentStatus","institutionClasses.grade","institutionClasses.section","institutionClasses.academicYear"]).where("institutionStudents.institutionId", "=", institutionId);
    if (classId) query = query.where("institutionStudents.classId", "=", classId);
    const students = await query.orderBy("institutionStudents.fullName").execute();
    return new Response(superjson.stringify({ students }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    const status = (error as { name?: string })?.name === "NotAuthenticatedError" ? 401 : 400;
    return new Response(superjson.stringify({ message: "Гирифтани рӯйхати хонандагон иҷро нашуд." }), { status, headers: { "Content-Type": "application/json" } });
  }
}
