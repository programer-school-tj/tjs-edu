import { getServerUserSession } from "../../helpers/getServerUserSession";
import { db } from "../../helpers/db";
import { z } from "zod";
import superjson from "superjson";

const schema = z.object({
  name: z.string().trim().min(3).max(180),
  institutionType: z.enum(["school", "lyceum", "gymnasium", "college", "university"]),
  region: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(40).optional().default(""),
  directorName: z.string().trim().min(3).max(160),
});

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const input = schema.parse(superjson.parse(await request.text()));
    const created = await db.transaction().execute(async (trx) => {
      const institution = await trx.insertInto("institutions").values({
        name: input.name, institutionType: input.institutionType, region: input.region,
        phone: input.phone || null, directorName: input.directorName,
        createdBy: user.id, status: "pending",
      }).returning(["id", "name", "institutionType", "region", "phone", "directorName", "status", "createdAt"]).executeTakeFirstOrThrow();
      await trx.insertInto("institutionMemberships").values({ institutionId: institution.id, userId: user.id, role: "director", isActive: true }).execute();
      await trx.insertInto("institutionAuditLogs").values({
        institutionId: institution.id, actorUserId: user.id, action: "institution.created",
        entityType: "institution", entityId: institution.id,
        details: { status: "pending", submittedBy: user.email },
      }).execute();
      return institution;
    });
    return new Response(superjson.stringify({ institution: created }), { status: 201, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Institution registration failed", error);
    const status = (error as { name?: string })?.name === "NotAuthenticatedError" ? 401 : 400;
    const message = error instanceof z.ZodError ? "Маълумоти воридшуда нодуруст аст. Ҳамаи майдонҳои ҳатмиро санҷед." : "Сабти муассиса иҷро нашуд. Баъдтар такрор кунед.";
    return new Response(superjson.stringify({ message }), { status, headers: { "Content-Type": "application/json" } });
  }
}
