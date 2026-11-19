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
      const existing = await trx.selectFrom("institutions")
        .select(["id", "status"])
        .where("id", "=", input.institutionId)
        .executeTakeFirst();

      if (!existing || !["pending", "approved", "suspended"].includes(existing.status)) {
        throw new Error("INSTITUTION_NOT_FOUND_OR_NOT_REVIEWABLE");
      }

      const now = new Date();
      const updated = await trx.updateTable("institutions")
        .set({
          status: input.status,
          updatedAt: now,
          ...(input.status === "approved"
            ? { approvedBy: user.id, reviewedAt: now, reviewNote: input.note || null }
            : { reviewNote: input.note || null }),
        })
        .where("id", "=", input.institutionId)
        .returning(["id", "name", "status"])
        .executeTakeFirstOrThrow();

      const action = input.status === "suspended"
        ? "institution.suspended"
        : existing.status === "pending"
          ? "institution.approved"
          : existing.status === "suspended"
            ? "institution.reactivated"
            : "institution.approval_confirmed";

      await trx.insertInto("institutionAuditLogs").values({
        institutionId: updated.id,
        actorUserId: user.id,
        action,
        entityType: "institution",
        entityId: updated.id,
        details: { note: input.note, previousStatus: existing.status, newStatus: input.status },
      }).execute();

      return updated;
    });

    const message = input.status === "suspended"
      ? "Муассиса боздошта шуд."
      : "Муассиса тасдиқ ё фаъол карда шуд.";
    return new Response(superjson.stringify({ institution, message }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const status = (error as { name?: string })?.name === "NotAuthenticatedError" ? 401
      : error instanceof z.ZodError ? 400
      : error instanceof Error && error.message === "INSTITUTION_NOT_FOUND_OR_NOT_REVIEWABLE" ? 404
      : 500;
    const message = error instanceof z.ZodError
      ? "Маълумоти дархост нодуруст аст."
      : error instanceof Error && error.message === "INSTITUTION_NOT_FOUND_OR_NOT_REVIEWABLE"
        ? "Муассиса ёфт нашуд ё ҳолати он барои ин амал иҷозат нест."
        : "Ҳолати муассиса тағйир дода нашуд.";
    return new Response(superjson.stringify({ message }), { status, headers: { "Content-Type": "application/json" } });
  }
}
