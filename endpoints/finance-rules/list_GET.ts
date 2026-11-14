import { getServerUserSession } from "../../helpers/getServerUserSession";
import { db } from "../../helpers/db";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") {
      return new Response(superjson.stringify({ message: "Танҳо маъмури асосии платформа метавонад қоидаҳои молиявиро бинад." }), { status: 403 });
    }
    const rules = await db.selectFrom("financeRules")
      .selectAll()
      .orderBy("ruleKey", "asc")
      .orderBy("effectiveFrom", "desc")
      .execute();
    return new Response(superjson.stringify({ rules }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(superjson.stringify({ message: "Қоидаҳои молиявӣ бор карда нашуданд." }), { status: 500 });
  }
}
