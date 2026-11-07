import { getServerUserSession } from "../../helpers/getServerUserSession";
import { db } from "../../helpers/db";
import { z } from "zod";
import superjson from "superjson";

const schema = z.object({
  institutionId: z.string().uuid(),
  staffId: z.string().uuid(),
  academicYear: z.string().regex(/^20[0-9]{2}-20[0-9]{2}$/),
  slots: z.array(z.object({
    weekday: z.number().int().min(1).max(6),
    lessonNumber: z.number().int().min(0).max(6),
  })).max(42).refine((items) => new Set(items.map((item) => item.weekday + ":" + item.lessonNumber)).size === items.length, "Қоидаи такрорӣ вуҷуд дорад.")
    .refine((items) => items.every((item) => item.lessonNumber === 0 || !items.some((other) => other.weekday === item.weekday && other.lessonNumber === 0)), "Рӯзи истироҳатро бо соати банд якҷоя интихоб кардан мумкин нест.")
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
      .where("institutions.status", "=", "approved").executeTakeFirst();
    if (user.role !== "admin" && !access) return new Response(superjson.stringify({ message: "Танҳо роҳбари муассиса метавонад дастрасии омӯзгорро тағйир диҳад." }), { status: 403 });

    await db.transaction().execute(async (trx) => {
      const staff = await trx.selectFrom("institutionStaff").select("id")
        .where("id", "=", x.staffId).where("institutionId", "=", x.institutionId)
        .where("isActive", "=", true).executeTakeFirst();
      if (!staff) throw new Error("STAFF_NOT_FOUND");
      await trx.deleteFrom("institutionStaffAvailability")
        .where("institutionId", "=", x.institutionId)
        .where("staffId", "=", x.staffId)
        .where("academicYear", "=", x.academicYear).execute();
      if (x.slots.length) {
        await trx.insertInto("institutionStaffAvailability").values(x.slots.map((slot) => ({
          institutionId: x.institutionId, staffId: x.staffId, academicYear: x.academicYear,
          weekday: slot.weekday, lessonNumber: slot.lessonNumber, createdBy: user.id,
        }))).execute();
      }
    });
    return new Response(superjson.stringify({ saved: x.slots.length }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return new Response(superjson.stringify({
      message: error instanceof z.ZodError ? "Маълумоти дастрасии омӯзгор нодуруст аст."
        : code === "STAFF_NOT_FOUND" ? "Омӯзгори интихобшуда дар муассиса ёфт нашуд."
        : "Қоидаҳои дастрасии омӯзгор сабт нашуданд.",
    }), { status: code === "STAFF_NOT_FOUND" ? 404 : 400, headers: { "Content-Type": "application/json" } });
  }
}
