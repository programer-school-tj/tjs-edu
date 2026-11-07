import { getServerUserSession } from "../../helpers/getServerUserSession";
import { db } from "../../helpers/db";
import { z } from "zod";
import superjson from "superjson";

const schema = z.object({
  institutionId: z.string().uuid(),
  fullName: z.string().trim().min(3).max(180),
  personnelNumber: z.string().trim().max(40).optional().default(""),
  positionTitle: z.string().trim().min(2).max(120),
  employmentType: z.enum(["teacher","administrative","technical","medical","other"]),
  phone: z.string().trim().max(40).optional().default(""),
  email: z.string().trim().email().max(180).optional().or(z.literal("")),
  subject: z.string().trim().max(120).optional().default(""),
  workloadHours: z.number().min(0).max(60).optional(),
});

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const input = schema.parse(superjson.parse(await request.text()));
    const membership = user.role === "admin" ? true : await db.selectFrom("institutionMemberships")
      .innerJoin("institutions", "institutions.id", "institutionMemberships.institutionId")
      .select(["institutionMemberships.id"])
      .where("institutionMemberships.institutionId", "=", input.institutionId)
      .where("institutionMemberships.userId", "=", user.id)
      .where("institutionMemberships.isActive", "=", true)
      .where("institutionMemberships.role", "=", "director")
      .where("institutions.status", "=", "approved")
      .executeTakeFirst();
    if (!membership) return new Response(superjson.stringify({ message: "Танҳо директори муассисаи тасдиқшуда метавонад корманд илова кунад." }), { status: 403 });
    const created = await db.transaction().execute(async trx => {
      const row = await trx.insertInto("institutionStaff").values({
        institutionId: input.institutionId, fullName: input.fullName,
        personnelNumber: input.personnelNumber || null, positionTitle: input.positionTitle,
        employmentType: input.employmentType, phone: input.phone || null,
        email: input.email || null, subject: input.subject || null, workloadHours: input.workloadHours ?? null, createdBy: user.id,
      }).returning(["id","institutionId","fullName","personnelNumber","positionTitle","employmentType","phone","email","subject","workloadHours","isActive","createdAt"]).executeTakeFirstOrThrow();
      await trx.insertInto("institutionAuditLogs").values({
        institutionId: input.institutionId, actorUserId: user.id, action: "staff.created",
        entityType: "institution_staff", entityId: row.id,
        details: { fullName: row.fullName, positionTitle: row.positionTitle, employmentType: row.employmentType },
      }).execute();
      return row;
    });
    return new Response(superjson.stringify({ staff: created }), { status: 201, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Staff creation failed", error);
    const status = (error as { name?: string })?.name === "NotAuthenticatedError" ? 401 : error instanceof z.ZodError ? 400 : 409;
    const message = error instanceof z.ZodError ? "Маълумоти корманд нодуруст аст. Майдонҳоро санҷед." : "Сабти корманд иҷро нашуд. Рақами шахсӣ такрор нашуда бошад.";
    return new Response(superjson.stringify({ message }), { status, headers: { "Content-Type": "application/json" } });
  }
}
