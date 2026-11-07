import { getServerUserSession } from "../../helpers/getServerUserSession";
import { db } from "../../helpers/db";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    let query = db.selectFrom("institutions").select([
      "institutions.id", "institutions.name", "institutions.institutionType", "institutions.region", "institutions.district", "institutions.phone", "institutions.directorName", "institutions.status", "institutions.createdAt", "institutions.plan", "institutions.planExpiresAt"
    ]);
    if (user.role !== "admin") {
      query = query.innerJoin("institutionMemberships", "institutionMemberships.institutionId", "institutions.id")
        .where("institutionMemberships.userId", "=", user.id)
        .where("institutionMemberships.isActive", "=", true)
        .select([
          "institutions.id", "institutions.name", "institutions.institutionType", "institutions.region", "institutions.district", "institutions.phone", "institutions.directorName", "institutions.status", "institutions.createdAt", "institutions.plan", "institutions.planExpiresAt"
        ]);
    }
    const rows = await query.orderBy("institutions.createdAt", "desc").execute();
    return new Response(superjson.stringify({ institutions: rows }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    const status = (error as { name?: string })?.name === "NotAuthenticatedError" ? 401 : 400;
    return new Response(superjson.stringify({ message: "Барои дидани муассисаҳо ворид шавед." }), { status, headers: { "Content-Type": "application/json" } });
  }
}
