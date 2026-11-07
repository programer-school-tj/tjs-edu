import { getServerUserSession } from "../../helpers/getServerUserSession";
import { db } from "../../helpers/db";
import { z } from "zod";
import superjson from "superjson";

const schema = z.object({
  institutionId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  reviewNote: z.string().trim().max(500).optional().default(""),
});

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") {
      return new Response(superjson.stringify({ message: "Шумо ҳуқуқи баррасии дархостҳоро надоред." }), { status: 403, headers: { "Content-Type": "application/json" } });
    }
    const input = schema.parse(superjson.parse(await request.text()));
    const result = await db.transaction().execute(async (trx) => {
      const institution = await trx.updateTable("institutions").set({
        status: input.decision,
        approvedBy: input.decision === "approved" ? user.id : null,
        reviewedAt: new Date(),
        reviewNote: input.reviewNote || null,
        updatedAt: new Date(),
      }).where("id", "=", input.institutionId).where("status", "=", "pending")
        .returning(["id", "name", "status", "reviewedAt", "reviewNote"]).executeTakeFirst();
      if (!institution) throw new Error("REQUEST_NOT_PENDING");
      await trx.insertInto("institutionAuditLogs").values({
        institutionId: institution.id, actorUserId: user.id,
        action: `institution.${input.decision}`, entityType: "institution",
        entityId: institution.id,
        details: { reviewNote: input.reviewNote || "" },
      }).execute();
      return institution;
    });
    return new Response(superjson.stringify({ institution: result }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    const message = error instanceof z.ZodError ? "Маълумоти дархост нодуруст аст." : error instanceof Error && error.message === "REQUEST_NOT_PENDING" ? "Ин дархост аллакай баррасӣ шудааст ё вуҷуд надорад." : "Амалиёт иҷро нашуд. Баъдтар такрор кунед.";
    const status = (error as { name?: string })?.name === "NotAuthenticatedError" ? 401 : 400;
    return new Response(superjson.stringify({ message }), { status, headers: { "Content-Type": "application/json" } });
  }
}
