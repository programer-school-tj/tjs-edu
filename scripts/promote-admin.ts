import postgres from "postgres";

const email = process.argv[2]?.trim().toLowerCase();
const databaseUrl = process.env.DATABASE_URL;

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Истифода: npm run admin:promote -- admin@example.com");
  process.exit(1);
}
if (!databaseUrl) {
  console.error("DATABASE_URL дар муҳити сервер муайян нашудааст.");
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1, prepare: false });

try {
  const result = await sql.begin(async (tx) => {
    const users = await tx`SELECT id, email, role FROM users WHERE lower(email) = ${email} FOR UPDATE`;
    if (users.length === 0) throw new Error("USER_NOT_FOUND");
    const user = users[0];
    await tx`UPDATE users SET role = 'admin', updated_at = now() WHERE id = ${user.id}`;
    await tx`DELETE FROM sessions WHERE user_id = ${user.id}`;
    return { id: user.id, email: user.email, previousRole: user.role };
  });
  console.log(`Super Admin фаъол шуд: ${result.email} (нақши пешина: ${result.previousRole}).`);
  console.log("Сессияҳои пешина бекор карда шуданд. Аз нав ворид шавед.");
} catch (error) {
  if (error instanceof Error && error.message === "USER_NOT_FOUND") {
    console.error("Ин почтаи электронӣ дар TJS Edu сабт нашудааст. Аввал ҳисоб созед.");
  } else {
    console.error("Фаъолсозии Super Admin иҷро нашуд:", error);
  }
  process.exitCode = 1;
} finally {
  await sql.end();
}
