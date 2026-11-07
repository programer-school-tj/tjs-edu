import { getServerUserSession } from "../../helpers/getServerUserSession";
import { db } from "../../helpers/db";
import { upload } from "@floot/storage";
import { nanoid } from "nanoid";
import superjson from "superjson";
import { z } from "zod";

const schema = z.object({
  institutionId: z.string().uuid(),
  fileName: z.string().min(1).max(180),
  contentType: z.string().min(3).max(120),
  sizeBytes: z.number().int().positive().max(30 * 1024 * 1024),
});
const allowed = new Map([
  ["pdf", ["application/pdf"]],
  ["doc", ["application/msword", "application/octet-stream"]],
  ["docx", ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/octet-stream"]],
  ["ppt", ["application/vnd.ms-powerpoint", "application/octet-stream"]],
  ["pptx", ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/octet-stream"]],
]);

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const input = schema.parse(superjson.parse(await request.text()));
    const extension = input.fileName.split(".").pop()?.toLowerCase() || "";
    if (!allowed.get(extension)?.includes(input.contentType)) {
      return new Response(superjson.stringify({ message: "Танҳо файлҳои PDF, DOC, DOCX, PPT ва PPTX иҷозатанд." }), { status: 400 });
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
    if (user.role !== "admin" && !access) {
      return new Response(superjson.stringify({ message: "Танҳо директори муассиса метавонад файл бор кунад." }), { status: 403 });
    }
    const safeName = input.fileName.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-90);
    const filename = `institutions/${input.institutionId}/materials/${nanoid(18)}-${safeName}`;
    const result = await upload({ visibility: "private", filename, contentType: input.contentType, sizeBytes: input.sizeBytes, ifAbsent: true });
    if (!result.ok) return new Response(superjson.stringify({ message: result.error.message || "Омода кардани боркунии файл иҷро нашуд." }), { status: 400 });
    return new Response(superjson.stringify({ filename, presignedUrl: result.presignedUrl, headers: result.headers }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    const status = (error as { name?: string })?.name === "NotAuthenticatedError" ? 401 : error instanceof z.ZodError ? 400 : 500;
    return new Response(superjson.stringify({ message: error instanceof z.ZodError ? "Маълумоти файл нодуруст аст." : "Омода кардани боркунии файл иҷро нашуд." }), { status, headers: { "Content-Type": "application/json" } });
  }
}
