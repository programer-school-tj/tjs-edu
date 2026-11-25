import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { SignJWT } from "jose";
import superjson from "superjson";

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

test("pending institutions cannot create school data until an admin approves them", {
  skip: !databaseUrl ? "Set TEST_DATABASE_URL or DATABASE_URL to run API integration tests" : false,
}, async () => {
  process.env.DATABASE_URL = databaseUrl!;
  const sql = postgres(databaseUrl!, { max: 1, prepare: false });
  const secret = process.env.SESSION_SECRET || process.env.JWT_SECRET;
  assert.ok(secret && secret.length >= 32, "SESSION_SECRET must contain at least 32 characters");

  const suffix = randomUUID();
  const directorSessionId = randomUUID();
  const adminSessionId = randomUUID();
  let directorId: number | undefined;
  let adminId: number | undefined;
  let institutionId: string | undefined;

  const makeToken = (sessionId: string) => new SignJWT({
    id: sessionId,
    createdAt: Date.now(),
    lastAccessed: Date.now(),
  }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("10m")
    .sign(new TextEncoder().encode(secret));

  const post = (path: string, token: string, payload: unknown) => new Request(
    `http://localhost/_api/${path}`,
    {
      method: "POST",
      headers: { cookie: `tjs_edu_session=${token}`, "content-type": "application/json" },
      body: superjson.stringify(payload),
    },
  );

  try {
    const [director] = await sql`
      INSERT INTO users (email, display_name, role)
      VALUES (${`approval-director-${suffix}@example.test`}, 'Approval Director', 'user')
      RETURNING id
    `;
    directorId = Number(director.id);

    const [admin] = await sql`
      INSERT INTO users (email, display_name, role)
      VALUES (${`approval-admin-${suffix}@example.test`}, 'Approval Admin', 'admin')
      RETURNING id
    `;
    adminId = Number(admin.id);

    const [institution] = await sql`
      INSERT INTO institutions (name, institution_type, region, director_name, created_by, status)
      VALUES (${`Pending Approval School ${suffix}`}, 'school', 'Khatlon', 'Approval Director', ${directorId}, 'pending')
      RETURNING id
    `;
    institutionId = institution.id;

    await sql`
      INSERT INTO institution_memberships (institution_id, user_id, role, is_active)
      VALUES (${institutionId}, ${directorId}, 'director', true)
    `;
    await sql`
      INSERT INTO sessions (id, user_id, expires_at)
      VALUES
        (${directorSessionId}, ${directorId}, now() + interval '10 minutes'),
        (${adminSessionId}, ${adminId}, now() + interval '10 minutes')
    `;

    const directorToken = await makeToken(directorSessionId);
    const adminToken = await makeToken(adminSessionId);
    const { handle: createClass } = await import("../endpoints/classes/create_POST");
    const { handle: reviewInstitution } = await import("../endpoints/institutions/review_POST");

    const classPayload = {
      institutionId,
      grade: 5,
      section: "A",
      academicYear: "2026-2027",
    };

    const blockedClass = await createClass(post("classes/create", directorToken, classPayload));
    assert.equal(blockedClass.status, 403, "a pending institution must not create classes");

    const forbiddenReview = await reviewInstitution(post("institutions/review", directorToken, {
      institutionId,
      decision: "approved",
      reviewNote: "Attempt by director",
    }));
    assert.equal(forbiddenReview.status, 403, "a director must not approve their own institution");

    const approved = await reviewInstitution(post("institutions/review", adminToken, {
      institutionId,
      decision: "approved",
      reviewNote: "Verified in integration test",
    }));
    assert.equal(approved.status, 200, "an admin should approve a pending institution");

    const [storedInstitution] = await sql`
      SELECT status, approved_by FROM institutions WHERE id = ${institutionId}
    `;
    assert.equal(storedInstitution.status, "approved");
    assert.equal(Number(storedInstitution.approved_by), adminId);

    const createdClass = await createClass(post("classes/create", directorToken, classPayload));
    assert.equal(createdClass.status, 201, "the director should create classes after approval");
  } finally {
    if (institutionId) await sql`DELETE FROM institutions WHERE id = ${institutionId}`.catch(() => undefined);
    if (directorSessionId) await sql`DELETE FROM sessions WHERE id = ${directorSessionId}`.catch(() => undefined);
    if (adminSessionId) await sql`DELETE FROM sessions WHERE id = ${adminSessionId}`.catch(() => undefined);
    if (directorId) await sql`DELETE FROM users WHERE id = ${directorId}`.catch(() => undefined);
    if (adminId) await sql`DELETE FROM users WHERE id = ${adminId}`.catch(() => undefined);
    await sql.end({ timeout: 5 });
  }
});
