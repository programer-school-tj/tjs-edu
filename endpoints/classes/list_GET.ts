import { getServerUserSession } from "../../helpers/getServerUserSession";
import { db } from "../../helpers/db";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const params = new URL(request.url).searchParams;
    const institutionId = params.get("institutionId");
    if (!institutionId) return new Response(superjson.stringify({ message: "Муассисаро интихоб кунед." }), { status: 400 });
    const access = await db.selectFrom("institutionMemberships").innerJoin("institutions", "institutions.id", "institutionMemberships.institutionId").select("institutionMemberships.id").where("institutionMemberships.institutionId", "=", institutionId).where("institutionMemberships.userId", "=", user.id).where("institutionMemberships.isActive", "=", true).where("institutionMemberships.role", "=", "director").where("institutions.status", "=", "approved").executeTakeFirst();
    if (user.role !== "admin" && !access) return new Response(superjson.stringify({ message: "Барои дидани синфҳои ин муассиса иҷозат надоред." }), { status: 403 });
    const classes = await db.selectFrom("institutionClasses").leftJoin("institutionStaff", "institutionStaff.id", "institutionClasses.classTeacherStaffId").select(["institutionClasses.id","institutionClasses.institutionId","institutionClasses.grade","institutionClasses.section","institutionClasses.academicYear","institutionClasses.classTeacherStaffId","institutionStaff.fullName as classTeacherName"]).where("institutionClasses.institutionId", "=", institutionId).orderBy("institutionClasses.academicYear", "desc").orderBy("institutionClasses.grade").orderBy("institutionClasses.section").execute();
    return new Response(superjson.stringify({ classes }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    const status = (error as { name?: string })?.name === "NotAuthenticatedError" ? 401 : 400;
    return new Response(superjson.stringify({ message: "Гирифтани рӯйхати синфҳо иҷро нашуд." }), { status, headers: { "Content-Type": "application/json" } });
  }
}
