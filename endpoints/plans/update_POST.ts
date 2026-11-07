import { getServerUserSession } from "../../helpers/getServerUserSession";
import { db } from "../../helpers/db";
import { z } from "zod";
import superjson from "superjson";

const schema = z.object({
  institutionId: z.string().uuid(),
  plan: z.enum(["free", "pro"]),
  planExpiresAt: z.string().datetime().nullable().optional(),
});

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") {
      return new Response(superjson.stringify({ message: "Танҳо Super Admin метавонад нақшаи обунаро тағйир диҳад." }), { status: 403 });
    }
    const input = schema.parse(superjson.parse(await request.text()));
    const result = await db.transaction().execute(async (trx) => {
      const institution = await trx.updateTable("institutions")
        .set({ plan: input.plan, planExpiresAt: input.plan === "pro" && input.planExpiresAt ? new Date(input.planExpiresAt) : null, updatedAt: new Date() })
        .where("id", "=", input.institutionId)
        .returning(["id", "name", "plan", "planExpiresAt"])
        .executeTakeFirst();
      if (!institution) throw new Error("INSTITUTION_NOT_FOUND");
      await trx.insertInto("institutionAuditLogs").values({
        institutionId: institution.id, actorUserId: user.id,
        action: "institution.plan_changed", entityType: "institution", entityId: institution.id,
        details: { plan: input.plan, planExpiresAt: input.planExpiresAt ?? null },
      }).execute();
      return institution;
    });
    return new Response(superjson.stringify({ institution: result, message: "Нақшаи обуна нав карда шуд." }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    const status = (error as { name?: string })?.name === "NotAuthenticatedError" ? 401 : 400;
    const message = error instanceof z.ZodError ? "Маълумоти нақша нодуруст аст." : error instanceof Error && error.message === "INSTITUTION_NOT_FOUND" ? "Муассиса ёфт нашуд." : "Тағйири нақша иҷро нашуд.";
    return new Response(superjson.stringify({ message }), { status, headers: { "Content-Type": "application/json" } });
  }
}
