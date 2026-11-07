import { getServerUserSession } from "../../helpers/getServerUserSession";
import { db } from "../../helpers/db";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const institutionId = new URL(request.url).searchParams.get("institutionId");
    if (!institutionId) return new Response(superjson.stringify({ message: "Муассисаро интихоб кунед." }), { status: 400 });
    let access = db.selectFrom("institutionMemberships")
      .innerJoin("institutions", "institutions.id", "institutionMemberships.institutionId")
      .select(["institutionMemberships.id"])
      .where("institutionMemberships.institutionId", "=", institutionId)
      .where("institutionMemberships.userId", "=", user.id)
      .where("institutionMemberships.isActive", "=", true)
      .where("institutionMemberships.role", "=", "director")
      .where("institutions.status", "=", "approved");
    const membership = user.role === "admin" ? true : await access.executeTakeFirst();
    if (!membership) return new Response(superjson.stringify({ message: "Шумо барои идоракунии кормандони ин муассиса иҷозат надоред." }), { status: 403 });
    const staff = await db.selectFrom("institutionStaff").select([
      "id","institutionId","fullName","personnelNumber","positionTitle","employmentType","phone","email","subject","isActive","createdAt"
    ]).where("institutionId","=",institutionId).orderBy("fullName","asc").execute();
    return new Response(superjson.stringify({ staff }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    const status = (error as { name?: string })?.name === "NotAuthenticatedError" ? 401 : 400;
    return new Response(superjson.stringify({ message: "Гирифтани рӯйхати кормандон иҷро нашуд." }), { status, headers: { "Content-Type": "application/json" } });
  }
}
