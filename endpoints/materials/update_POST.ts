import { getServerUserSession } from "../../helpers/getServerUserSession";
import { db } from "../../helpers/db";
import { z } from "zod";
import superjson from "superjson";

const schema = z.object({
  institutionId: z.string().uuid(),
  materialId: z.string().uuid(),
  title: z.string().trim().min(3).max(180),
  description: z.string().trim().max(2000).optional().default(""),
  subject: z.string().trim().max(120).optional().default(""),
  grade: z.number().int().min(1).max(11).nullable().optional(),
  materialType: z.enum(["lesson", "pdf", "book", "video", "link"]),
  academicYear: z.string().regex(/^20[0-9]{2}-20[0-9]{2}$/),
  isPublished: z.boolean(),
});

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const input = schema.parse(superjson.parse(await request.text()));
    const membership = user.role === "admin" ? true : await db.selectFrom("institutionMemberships")
      .innerJoin("institutions", "institutions.id", "institutionMemberships.institutionId")
      .select("institutionMemberships.id")
      .where("institutionMemberships.institutionId", "=", input.institutionId)
      .where("institutionMemberships.userId", "=", user.id)
      .where("institutionMemberships.isActive", "=", true)
      .where("institutionMemberships.role", "=", "director")
      .where("institutions.status", "=", "approved")
      .executeTakeFirst();
    if (!membership) return new Response(superjson.stringify({ message: "Танҳо директори муассиса метавонад маводро таҳрир ё нашр кунад." }), { status: 403 });

    const updated = await db.transaction().execute(async (trx) => {
      const row = await trx.updateTable("institutionLearningMaterials").set({
        title: input.title,
        description: input.description || null,
        subject: input.subject || null,
        grade: input.grade ?? null,
        materialType: input.materialType,
        academicYear: input.academicYear,
        isPublished: input.isPublished,
        updatedAt: new Date(),
      }).where("id", "=", input.materialId).where("institutionId", "=", input.institutionId)
        .returning(["id", "title", "isPublished", "updatedAt"]).executeTakeFirst();
      if (!row) throw new Error("Мавод ёфт нашуд.");
      await trx.insertInto("institutionAuditLogs").values({
        institutionId: input.institutionId,
        actorUserId: user.id,
        action: input.isPublished ? "learning_material.updated_published" : "learning_material.updated",
        entityType: "institution_learning_materials",
        entityId: row.id,
        details: { title: row.title, isPublished: row.isPublished },
      }).execute();
      return row;
    });
    return new Response(superjson.stringify({ material: updated }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    const status = (error as { name?: string })?.name === "NotAuthenticatedError" ? 401 : error instanceof z.ZodError ? 400 : 404;
    return new Response(superjson.stringify({ message: error instanceof z.ZodError ? "Маълумоти таҳрир нодуруст аст." : error instanceof Error ? error.message : "Таҳрири мавод иҷро нашуд." }), { status, headers: { "Content-Type": "application/json" } });
  }
}
