import { getServerUserSession } from "../../helpers/getServerUserSession";
import { db } from "../../helpers/db";
import superjson from "superjson";
import { getUrl } from "@floot/storage";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const params = new URL(request.url).searchParams;
    const institutionId = params.get("institutionId");
    const grade = params.get("grade");
    if (!institutionId) return new Response(superjson.stringify({ message: "Муассисаро интихоб кунед." }), { status: 400 });
    const access = await db.selectFrom("institutionMemberships")
      .innerJoin("institutions", "institutions.id", "institutionMemberships.institutionId")
      .select(["institutionMemberships.id", "institutionMemberships.role"])
      .where("institutionMemberships.institutionId", "=", institutionId)
      .where("institutionMemberships.userId", "=", user.id)
      .where("institutionMemberships.isActive", "=", true)
      .where("institutions.status", "=", "approved")
      .executeTakeFirst();
    if (user.role !== "admin" && !access) return new Response(superjson.stringify({ message: "Шумо ба маводи ин муассиса дастрасӣ надоред." }), { status: 403 });
    let query = db.selectFrom("institutionLearningMaterials").select([
      "id", "institutionId", "title", "description", "subject", "grade", "materialType", "resourceUrl", "academicYear", "isPublished", "createdAt"
    ]).where("institutionId", "=", institutionId);
    if (user.role !== "admin" && access?.role !== "director") query = query.where("isPublished", "=", true);
    if (grade && grade !== "all") query = query.where("grade", "=", Number(grade));
    const rows = await query.orderBy("createdAt", "desc").execute();
    const materials = await Promise.all(rows.map(async (item) => {
      if (!item.resourceUrl.startsWith("storage://")) return item;
      const filename = item.resourceUrl.slice("storage://".length);
      if (!filename.startsWith(`institutions/${institutionId}/materials/`)) return { ...item, resourceUrl: "" };
      const result = await getUrl({ visibility: "private", filename, expiresInSeconds: 3600 });
      return { ...item, resourceUrl: result.ok ? result.url : "" };
    }));
    return new Response(superjson.stringify({ materials }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    const status = (error as { name?: string })?.name === "NotAuthenticatedError" ? 401 : 400;
    return new Response(superjson.stringify({ message: "Гирифтани маводи таълимӣ иҷро нашуд." }), { status, headers: { "Content-Type": "application/json" } });
  }
}
