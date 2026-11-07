import { getServerUserSession } from "../../helpers/getServerUserSession";
import { db } from "../../helpers/db";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const params = new URL(request.url).searchParams;
    const institutionId = params.get("institutionId");
    const documentType = params.get("documentType");
    const academicYear = params.get("academicYear") || "2026-2027";
    const periodKey = params.get("periodKey") || "";
    if (!institutionId || !["tariffing", "payroll", "timetable"].includes(documentType || "")) {
      return new Response(superjson.stringify({ message: "Муассиса ва навъи бланкаро интихоб кунед." }), { status: 400 });
    }
    const access = await db.selectFrom("institutionMemberships")
      .innerJoin("institutions", "institutions.id", "institutionMemberships.institutionId")
      .select("institutionMemberships.id")
      .where("institutionMemberships.institutionId", "=", institutionId)
      .where("institutionMemberships.userId", "=", user.id)
      .where("institutionMemberships.isActive", "=", true)
      .where("institutionMemberships.role", "=", "director")
      .where("institutions.status", "=", "approved")
      .executeTakeFirst();
    if (user.role !== "admin" && !access) return new Response(superjson.stringify({ message: "Иҷозат надоред." }), { status: 403 });
    const document = await db.selectFrom("institutionFormDocuments").selectAll()
      .where("institutionId", "=", institutionId)
      .where("documentType", "=", documentType as string)
      .where("academicYear", "=", academicYear)
      .where("periodKey", "=", periodKey)
      .executeTakeFirst();
    return new Response(superjson.stringify({ document: document || null }), { headers: { "Content-Type": "application/json" } });
  } catch {
    return new Response(superjson.stringify({ message: "Бланка дастрас нест." }), { status: 400 });
  }
}
