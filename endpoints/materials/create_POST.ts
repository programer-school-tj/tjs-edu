import { getServerUserSession } from "../../helpers/getServerUserSession";
import { db } from "../../helpers/db";
import { z } from "zod";
import superjson from "superjson";
import { getInfo } from "@floot/storage";

const schema = z.object({
  institutionId: z.string().uuid(),
  title: z.string().trim().min(3).max(180),
  description: z.string().trim().max(2000).optional().default(""),
  subject: z.string().trim().max(120).optional().default(""),
  grade: z.number().int().min(1).max(11).nullable().optional(),
  materialType: z.enum(["lesson", "pdf", "book", "video", "link"]),
  resourceUrl: z.string().min(8).max(2048),
  academicYear: z.string().regex(/^20[0-9]{2}-20[0-9]{2}$/).default("2026-2027"),
});

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const input = schema.parse(superjson.parse(await request.text()));
    if (input.resourceUrl.startsWith("storage://")) {
      const filename = input.resourceUrl.slice("storage://".length);
      if (!filename.startsWith(`institutions/${input.institutionId}/materials/`)) return new Response(superjson.stringify({ message: "Файл ба ин муассиса тааллуқ надорад." }), { status: 403 });
      const info = await getInfo({ visibility: "private", filename });
      if (!info.ok || !info.exists) return new Response(superjson.stringify({ message: "Файл ёфт нашуд. Лутфан онро аз нав бор кунед." }), { status: 400 });
    } else {
      const url = new URL(input.resourceUrl);
      if (url.protocol !== "https:" && url.protocol !== "http:") return new Response(superjson.stringify({ message: "Танҳо пайванди HTTP ё HTTPS иҷозат аст." }), { status: 400 });
    }
    const access = await db.selectFrom("institutionMemberships")
      .innerJoin("institutions", "institutions.id", "institutionMemberships.institutionId")
      .select("institutionMemberships.id")
      .where("institutionMemberships.institutionId", "=", input.institutionId)
      .where("institutionMemberships.userId", "=", user.id)
      .where("institutionMemberships.isActive", "=", true)
      .where("institutionMemberships.role", "=", "director")
      .where("institutions.status", "=", "approved")
      .executeTakeFirst();
    if (user.role !== "admin" && !access) return new Response(superjson.stringify({ message: "Танҳо директори муассисаи тасдиқшуда метавонад маводи нав илова кунад." }), { status: 403 });
    const created = await db.transaction().execute(async (trx) => {
      const material = await trx.insertInto("institutionLearningMaterials").values({
        institutionId: input.institutionId,
        title: input.title,
        description: input.description || null,
        subject: input.subject || null,
        grade: input.grade ?? null,
        materialType: input.materialType,
        resourceUrl: input.resourceUrl,
        academicYear: input.academicYear,
        createdBy: user.id,
      }).returning(["id", "title", "materialType", "resourceUrl", "grade", "subject", "createdAt"]).executeTakeFirstOrThrow();
      await trx.insertInto("institutionAuditLogs").values({
        institutionId: input.institutionId, actorUserId: user.id, action: "learning_material.created",
        entityType: "institution_learning_materials", entityId: material.id,
        details: { title: material.title, materialType: material.materialType },
      }).execute();
      return material;
    });
    return new Response(superjson.stringify({ material: created }), { status: 201, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Learning material creation failed", error);
    const status = (error as { name?: string })?.name === "NotAuthenticatedError" ? 401 : error instanceof z.ZodError ? 400 : 409;
    const message = error instanceof z.ZodError ? "Маълумоти мавод нодуруст аст. Майдонҳоро санҷед." : "Сабти маводи таълимӣ иҷро нашуд.";
    return new Response(superjson.stringify({ message }), { status, headers: { "Content-Type": "application/json" } });
  }
}
