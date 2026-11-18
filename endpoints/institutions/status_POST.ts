import { getServerUserSession } from "../../helpers/getServerUserSession";
import { db } from "../../helpers/db";
import { z } from "zod";
import superjson from "superjson";

const schema = z.object({
  institutionId: z.string().uuid(),
  status: z.enum(["approved", "suspended"]),
  note: z.string().trim().max(500).optional().default(""),
});

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") {
      return new Response(superjson.stringify({ message: "Танҳо Super Admin метавонад ҳолати муассисаро тағйир диҳад." }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const input = schema.parse(superjson.parse(await request.text()));
    const institution = await db.transaction().execute(async (trx) => {
      const updated = await trx.updateTable("institutions")
        .set({ status: input.status, updatedAt: new Date() })
        .where("id", "=", input.institutionId)
        .where("status", "in", ["approved", "suspended"])
        .returning(["id", "name", "status"])
        .executeTakeFirst();

      if (!updated) throw new Error("INSTITUTION_NOT_FOUND_OR_NOT_REVIEWED");

      await trx.insertInto("institutionAuditLogs").values({
        institutionId: updated.id,
        actorUserId: user.id,
        action: input.status === "suspended" ? "institution.suspended" : "institution.reactivated",
        entityType: "institution",
        entityId: updated.id,
        details: { note: input.note },
      }).execute();

      return updated;
    });

    return new Response(superjson.stringify({ institution, message: input.status === "suspended" ? "Муассиса боздошта шуд." : "Муассиса дубора фаъол гардид." }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const status = (error as { name?: string })?.name === "NotAuthenticatedError" ? 401
      : error instanceof z.ZodError ? 400
      : 400;
    const message = error instanceof z.ZodError
      ? "Маълумоти дархост нодуруст аст."
      : error instanceof Error && error.message === "INSTITUTION_NOT_FOUND_OR_NOT_REVIEWED"
        ? "Муассиса ёфт нашуд ё ҳанӯз тасдиқ нашудааст."
        : "Ҳолати муассиса тағйир дода нашуд.";
    return new Response(superjson.stringify({ message }), { status, headers: { "Content-Type": "application/json" } });
  }
}
