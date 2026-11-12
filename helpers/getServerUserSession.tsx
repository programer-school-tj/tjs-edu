import { db } from "./db";
import { User } from "./User";

import {
  CleanupProbability,
  getServerSessionOrThrow,
  NotAuthenticatedError,
} from "./getSetServerSession";

export async function getServerUserSession(request: Request) {
  const session = await getServerSessionOrThrow(request);
  const now = new Date();

  // Occasionally remove sessions whose server-side expiry has passed.
  if (Math.random() < CleanupProbability) {
    try {
      await db
        .deleteFrom("sessions")
        .where("expiresAt", "<", now)
        .execute();
    } catch (cleanupError) {
      // Log but don't fail the request if cleanup fails
      console.error("Session cleanup error:", cleanupError);
    }
  }

  // The database is the source of truth for revocation and expiry.
  // A valid JWT alone must never revive an expired or deleted session.
  const results = await db
    .selectFrom("sessions")
    .innerJoin("users", "sessions.userId", "users.id")
    .select([
      "sessions.id as sessionId",
      "sessions.createdAt as sessionCreatedAt",
      "sessions.lastAccessed as sessionLastAccessed",
      "users.id",
      "users.email",
      "users.displayName",
      "users.role",
      "users.avatarUrl",
    ])
    .where("sessions.id", "=", session.id)
    .where("sessions.expiresAt", ">", now)
    .limit(1)
    .execute();

  if (results.length === 0) {
    throw new NotAuthenticatedError();
  }

  const result = results[0];
  const user = {
    id: result.id,
    email: result.email,
    displayName: result.displayName,
    avatarUrl: result.avatarUrl,
    role: result.role,
  };

  // Update activity time only. The server-side expiresAt remains the
  // absolute expiry established when the session was created.
  await db
    .updateTable("sessions")
    .set({ lastAccessed: now })
    .where("id", "=", session.id)
    .where("expiresAt", ">", now)
    .execute();

  return {
    user: user satisfies User,
    // Keep the cookie's activity metadata aligned with the database.
    session: {
      ...session,
      lastAccessed: now,
    },
  };
}
