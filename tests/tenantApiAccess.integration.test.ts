import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { SignJWT } from "jose";
import superjson from "superjson";

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

test("institution directors cannot read another institution data or create its staff records", {
  skip: !databaseUrl ? "Set TEST_DATABASE_URL or DATABASE_URL to run API integration tests" : false,
}, async () => {
  process.env.DATABASE_URL = databaseUrl!;
  const sql = postgres(databaseUrl!, { max: 1, prepare: false });
  const secret = process.env.SESSION_SECRET || process.env.JWT_SECRET;
  assert.ok(secret && secret.length >= 32, "SESSION_SECRET must contain at least 32 characters");

  const suffix = randomUUID();
  let userId: number | undefined;
  let institutionA: string | undefined;
  let institutionB: string | undefined;
  const sessionId = randomUUID();

  try {
    const [user] = await sql`
      INSERT INTO users (email, display_name, role)
      VALUES (${`tenant-api-${suffix}@example.test`}, 'Tenant API Test', 'user')
      RETURNING id
    `;
    userId = Number(user.id);

    const [schoolA] = await sql`
      INSERT INTO institutions (name, institution_type, region, director_name, created_by, status)
      VALUES (${`Tenant API A ${suffix}`}, 'school', 'Khatlon', 'Director A', ${userId!}, 'approved')
      RETURNING id
    `;
    institutionA = schoolA.id;

    const [schoolB] = await sql`
      INSERT INTO institutions (name, institution_type, region, director_name, created_by, status)
      VALUES (${`Tenant API B ${suffix}`}, 'school', 'Khatlon', 'Director B', ${userId!}, 'approved')
      RETURNING id
    `;
    institutionB = schoolB.id;

    await sql`
      INSERT INTO institution_memberships (institution_id, user_id, role, is_active)
      VALUES (${institutionA!}, ${userId!}, 'director', true)
    `;
    await sql`
      INSERT INTO sessions (id, user_id, expires_at)
      VALUES (${sessionId}, ${userId!}, now() + interval '10 minutes')
    `;

    const token = await new SignJWT({
      id: sessionId,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
    }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("10m").sign(new TextEncoder().encode(secret));

    const readEndpoints = [
      ["staff", (await import("../endpoints/staff/list_GET")).handle],
      ["classes", (await import("../endpoints/classes/list_GET")).handle],
      ["students", (await import("../endpoints/students/list_GET")).handle],
      ["tariffs", (await import("../endpoints/tariffs/list_GET")).handle],
      ["payroll", (await import("../endpoints/payroll/list_GET")).handle],
      ["timetable", (await import("../endpoints/timetable/list_GET")).handle],
    ] as const;

    for (const [name, handle] of readEndpoints) {
      const ownResponse = await handle(new Request(
        `http://localhost/_api/${name}/list?institutionId=${institutionA!}`,
        { headers: { cookie: `tjs_edu_session=${token}` } },
      ));
      assert.equal(ownResponse.status, 200, `director should read own institution's ${name}`);

      const foreignResponse = await handle(new Request(
        `http://localhost/_api/${name}/list?institutionId=${institutionB!}`,
        { headers: { cookie: `tjs_edu_session=${token}` } },
      ));
      assert.equal(foreignResponse.status, 403, `director must not read another institution's ${name}`);
    }

    const { handle: listAttendance } = await import("../endpoints/attendance/list_GET");
    const attendanceClassId = randomUUID();
    for (const institutionId of [institutionA!, institutionB!]) {
      const response = await listAttendance(new Request(
        `http://localhost/_api/attendance/list?institutionId=${institutionId}&classId=${attendanceClassId}&date=2026-11-19`,
        { headers: { cookie: `tjs_edu_session=${token}` } },
      ));
      assert.equal(
        response.status,
        institutionId === institutionA ? 200 : 403,
        "attendance API must enforce institution membership",
      );
    }

    const { handle: loadForm } = await import("../endpoints/forms/load_GET");
    for (const institutionId of [institutionA!, institutionB!]) {
      const response = await loadForm(new Request(
        `http://localhost/_api/forms/load?institutionId=${institutionId}&documentType=payroll&academicYear=2026-2027&periodKey=2026-11`,
        { headers: { cookie: `tjs_edu_session=${token}` } },
      ));
      assert.equal(
        response.status,
        institutionId === institutionA ? 200 : 403,
        "saved form API must enforce institution membership",
      );
    }

    const { handle: createStaff } = await import("../endpoints/staff/create_POST");

    const createResponse = await createStaff(new Request("http://localhost/_api/staff/create", {
      method: "POST",
      headers: {
        cookie: `tjs_edu_session=${token}`,
        "content-type": "application/json",
      },
      body: superjson.stringify({
        institutionId: institutionB!,
        fullName: "Unauthorized Test Employee",
        positionTitle: "Teacher",
        employmentType: "teacher",
      }),
    }));
    assert.equal(createResponse.status, 403, "director must not create staff in another institution");
  } finally {
    if (sessionId) await sql`DELETE FROM sessions WHERE id = ${sessionId}`.catch(() => undefined);
    if (institutionA) await sql`DELETE FROM institutions WHERE id = ${institutionA!}`.catch(() => undefined);
    if (institutionB) await sql`DELETE FROM institutions WHERE id = ${institutionB!}`.catch(() => undefined);
    if (userId) await sql`DELETE FROM users WHERE id = ${userId!}`.catch(() => undefined);
    await sql.end({ timeout: 5 });
  }
});
