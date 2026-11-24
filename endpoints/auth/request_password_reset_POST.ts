import { db } from "../../helpers/db";
import { sql } from "kysely";
import { createHash, randomInt } from "crypto";
import superjson from "superjson";
import { schema } from "./request_password_reset_POST.schema";

const CODE_TTL_MINUTES = 15;
const MAX_CODES_PER_HOUR = 3;
const RESEND_ENDPOINT = "https://api.resend.com/emails";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function hashResetCode(userId: number, code: string): string {
  return createHash("sha256").update(`${userId}:${code}`).digest("hex");
}

async function sendResetEmail(to: string, code: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();
  if (!apiKey || !from) {
    console.error("Password reset email is not configured: set RESEND_API_KEY and RESEND_FROM.");
    return false;
  }

  const text = `Your TJS Edu password reset code is ${code}\n\nIt expires in ${CODE_TTL_MINUTES} minutes. If you did not ask to reset your password, ignore this email.`;
  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "TJS Edu — password reset code",
      text,
      html: `<p>Your TJS Edu password reset code is:</p><p style="font-size:28px;font-weight:600;letter-spacing:4px;font-family:monospace">${code}</p><p>It expires in ${CODE_TTL_MINUTES} minutes. If you did not ask to reset your password, ignore this email.</p>`,
    }),
  });

  if (!response.ok) {
    console.error("Password reset email provider returned HTTP", response.status);
    return false;
  }
  return true;
}

export async function handle(request: Request) {
  try {
    const json = superjson.parse(await request.text());
    const { email } = schema.parse(json);
    const normalizedEmail = email.trim().toLowerCase();
    const now = new Date();

    const user = await db
      .selectFrom("users")
      .select(["id", "email"])
      .where(sql`LOWER(users.email)`, "=", normalizedEmail)
      .orderBy("id")
      .executeTakeFirst();

    if (user) {
      const recent = await db
        .selectFrom("passwordResetCodes")
        .select(db.fn.countAll<number>().as("count"))
        .where("userId", "=", user.id)
        .where("createdAt", ">=", new Date(now.getTime() - 60 * 60 * 1000))
        .executeTakeFirst();

      if (Number(recent?.count ?? 0) < MAX_CODES_PER_HOUR) {
        const code = randomInt(0, 100_000_000).toString().padStart(8, "0");
        const codeHash = hashResetCode(user.id, code);

        await db.transaction().execute(async (trx) => {
          await trx
            .updateTable("passwordResetCodes")
            .set({ usedAt: now })
            .where("userId", "=", user.id)
            .where("usedAt", "is", null)
            .execute();
          await trx
            .insertInto("passwordResetCodes")
            .values({
              userId: user.id,
              codeHash,
              expiresAt: new Date(now.getTime() + CODE_TTL_MINUTES * 60 * 1000),
            })
            .execute();
        });

        const sent = await sendResetEmail(user.email, code);
        if (!sent) {
          await db.updateTable("passwordResetCodes")
            .set({ usedAt: new Date() })
            .where("userId", "=", user.id)
            .where("codeHash", "=", codeHash)
            .where("usedAt", "is", null)
            .execute();
        }
      }
    }

    // Keep the same response whether or not the account exists.
    return new Response(superjson.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Password reset request error:", error);
    return new Response(
      superjson.stringify({ message: "Could not send a reset code" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}
