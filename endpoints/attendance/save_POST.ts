import { createHash } from "node:crypto";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { db } from "../../helpers/db";
import { sql } from "kysely";
import { z } from "zod";
import superjson from "superjson";
import { isValidIsoDate } from "../../helpers/attendanceDate";

const schema = z.object({ institutionId: z.string().uuid(), classId: z.string().uuid(), date: z.string().refine(isValidIsoDate, "Сана нодуруст аст."), records: z.array(z.object({ studentId: z.string().uuid(), status: z.enum(["present","absent","late","excused"]), note: z.string().max(300).optional().default("") })).min(1).max(100) }).refine(input => new Set(input.records.map(record => record.studentId)).size === input.records.length, "Рӯйхат хонандаи такрорӣ дорад.");

function jsonResponse(body: unknown, status: number) {
  return new Response(superjson.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const expectedUserId = request.headers.get("X-Expected-User-ID");
    if (expectedUserId && Number(expectedUserId) !== Number(user.id)) {
      return jsonResponse({ message: "Ҳисоби корбар иваз шудааст. Навбати офлайнро бо ҳисоби соҳиби он ҳамоҳанг кунед." }, 409);
    }
    const input = schema.parse(superjson.parse(await request.text()));
    const rawKey = request.headers.get("Idempotency-Key");
    const idempotencyKey = rawKey?.trim() || null;
    if (idempotencyKey && (idempotencyKey.length > 200 || /[\u0000-\u001f\u007f]/.test(idempotencyKey))) {
      return jsonResponse({ message: "Калиди амалиёт нодуруст аст." }, 400);
    }
    const requestHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    const scope = "attendance.save";

    const access = await db.selectFrom("institutionMemberships").innerJoin("institutions", "institutions.id", "institutionMemberships.institutionId").select("institutionMemberships.id").where("institutionMemberships.institutionId", "=", input.institutionId).where("institutionMemberships.userId", "=", user.id).where("institutionMemberships.isActive", "=", true).where("institutionMemberships.role", "=", "director").where("institutions.status", "=", "approved").executeTakeFirst();
    if (user.role !== "admin" && !access) return jsonResponse({ message: "Танҳо директори муассисаи тасдиқшуда метавонад давомотро сабт кунад." }, 403);
    const valid = await db.selectFrom("institutionStudents").select("id").where("institutionId", "=", input.institutionId).where("classId", "=", input.classId).where("id", "in", input.records.map(r => r.studentId)).execute();
    if (valid.length !== input.records.length) return jsonResponse({ message: "Баъзе хонандагон ба синфи интихобшуда тааллуқ надоранд." }, 400);

    const result = await db.transaction().execute(async trx => {
      if (idempotencyKey) {
        const inserted = await sql<{ idempotencyKey: string }>`
          INSERT INTO api_idempotency_keys
            (scope, user_id, idempotency_key, request_hash)
          VALUES (${scope}, ${user.id}, ${idempotencyKey}, ${requestHash})
          ON CONFLICT (scope, user_id, idempotency_key) DO NOTHING
          RETURNING idempotency_key AS "idempotencyKey"
        `.execute(trx);

        if (inserted.rows.length === 0) {
          const previous = await sql<{
            userId: number;
            scope: string;
            requestHash: string;
            responseBody: { saved: number } | null;
            responseStatus: number | null;
          }>`
            SELECT user_id AS "userId", scope, request_hash AS "requestHash",
                   response_body AS "responseBody", response_status AS "responseStatus"
            FROM api_idempotency_keys
            WHERE scope = ${scope} AND user_id = ${user.id}
              AND idempotency_key = ${idempotencyKey}
              AND expires_at > now()
            FOR UPDATE
          `.execute(trx);
          const saved = previous.rows[0];
          if (!saved || Number(saved.userId) !== Number(user.id) || saved.scope !== scope || saved.requestHash !== requestHash) {
            return { kind: "conflict" as const };
          }
          if (!saved.responseBody || !saved.responseStatus) return { kind: "pending" as const };
          return { kind: "replay" as const, body: saved.responseBody, status: saved.responseStatus };
        }
      }

      for (const record of input.records) {
        await trx.insertInto("institutionAttendance").values({ institutionId: input.institutionId, classId: input.classId, studentId: record.studentId, attendanceDate: new Date(`${input.date}T00:00:00.000Z`), status: record.status, note: record.note || null, createdBy: user.id }).onConflict(oc => oc.columns(["institutionId","studentId","attendanceDate"]).doUpdateSet({ status: record.status, note: record.note || null, updatedAt: new Date() })).execute();
      }
      await trx.insertInto("institutionAuditLogs").values({ institutionId: input.institutionId, actorUserId: user.id, action: "attendance.saved", entityType: "institution_attendance", entityId: input.classId, details: { date: input.date, count: input.records.length } }).execute();

      const body = { saved: input.records.length };
      if (idempotencyKey) {
        await sql`
          UPDATE api_idempotency_keys
          SET response_body = ${JSON.stringify(body)}::jsonb,
              response_status = 200
          WHERE scope = ${scope} AND user_id = ${user.id}
            AND idempotency_key = ${idempotencyKey}
        `.execute(trx);
      }
      return { kind: "saved" as const, body, status: 200 };
    });

    if (result.kind === "conflict") return jsonResponse({ message: "Ин калиди амалиёт аллакай барои дархости дигар истифода шудааст." }, 409);
    if (result.kind === "pending") return jsonResponse({ message: "Амалиёт ҳоло анҷом наёфтааст. Бо ҳамон калид такроран кӯшиш кунед." }, 409);
    return jsonResponse(result.kind === "replay" ? result.body : result.body, result.status);
  } catch (error) {
    const status = (error as { name?: string })?.name === "NotAuthenticatedError" ? 401 : error instanceof z.ZodError ? 400 : 409;
    return jsonResponse({ message: error instanceof z.ZodError ? "Маълумоти давомот нодуруст аст." : "Сабти давомот иҷро нашуд." }, status);
  }
}
