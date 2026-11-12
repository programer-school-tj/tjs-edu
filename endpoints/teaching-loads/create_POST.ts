import { getServerUserSession } from "../../helpers/getServerUserSession";
import { db } from "../../helpers/db";
import { z } from "zod";
import superjson from "superjson";

const schema = z.object({
  institutionId: z.string().uuid(),
  staffId: z.string().uuid(),
  classId: z.string().uuid(),
  subject: z.string().trim().min(2).max(120),
  weeklyHours: z.number().int().min(1).max(36),
  academicYear: z.string().regex(/^20[0-9]{2}-20[0-9]{2}$/),
});

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const x = schema.parse(superjson.parse(await request.text()));
    const access = await db.selectFrom("institutionMemberships")
      .innerJoin("institutions", "institutions.id", "institutionMemberships.institutionId")
      .select("institutionMemberships.id")
      .where("institutionMemberships.institutionId", "=", x.institutionId)
      .where("institutionMemberships.userId", "=", user.id)
      .where("institutionMemberships.isActive", "=", true)
      .where("institutionMemberships.role", "=", "director")
      .where("institutions.status", "=", "approved")
      .executeTakeFirst();
    if (user.role !== "admin" && !access) {
      return new Response(superjson.stringify({ message: "Танҳо роҳбари муассиса метавонад сарбории фанниро тағйир диҳад." }), { status: 403 });
    }
    const [teacher, cls] = await Promise.all([
      db.selectFrom("institutionStaff").select("id").where("id", "=", x.staffId).where("institutionId", "=", x.institutionId).where("isActive", "=", true).executeTakeFirst(),
      db.selectFrom("institutionClasses").select(["id", "grade"]).where("id", "=", x.classId).where("institutionId", "=", x.institutionId).where("academicYear", "=", x.academicYear).executeTakeFirst(),
    ]);
    if (!teacher || !cls) return new Response(superjson.stringify({ message: "Омӯзгор ё синфи интихобшуда ёфт нашуд." }), { status: 404 });
    const row = await db.insertInto("institutionTeachingLoads").values({
      institutionId: x.institutionId, staffId: x.staffId, classId: x.classId,
      subject: x.subject, weeklyHours: x.weeklyHours, academicYear: x.academicYear, createdBy: user.id,
    }).returningAll().executeTakeFirstOrThrow();
    return new Response(superjson.stringify({ load: row }), { status: 201, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    const message = error instanceof z.ZodError ? "Маълумоти сарборӣ нодуруст аст." : "Сарбории фаннӣ сабт нашуд. Эҳтимол ин сабт аллакай вуҷуд дорад.";
    const status = (error as { name?: string })?.name === "NotAuthenticatedError" ? 401 : error instanceof z.ZodError ? 400 : 409;
    return new Response(superjson.stringify({ message }), { status, headers: { "Content-Type": "application/json" } });
  }
}
