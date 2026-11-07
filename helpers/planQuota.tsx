import type { Transaction } from "kysely";
import { db } from "./db";
import type { DB } from "./schema";

export type LimitedModule = "timetable" | "tariffs" | "payroll";

/** Executes a create operation and consumes its FREE allowance in the same transaction. */
export async function withPlanQuota<T>(
  institutionId: string,
  moduleKey: LimitedModule,
  operation: (trx: Transaction<DB>) => Promise<T>,
): Promise<{ result: T; operationCount: number; plan: "free" | "pro" }> {
  return db.transaction().execute(async (trx) => {
    const institution = await trx.selectFrom("institutions")
      .select(["plan", "planExpiresAt"])
      .where("id", "=", institutionId)
      .forUpdate()
      .executeTakeFirst();
    if (!institution) throw new Error("INSTITUTION_NOT_FOUND");
    const isPro = institution.plan === "pro" && (!institution.planExpiresAt || institution.planExpiresAt.getTime() > Date.now());
    const effectivePlan = isPro ? "pro" : "free";

    const usage = await trx.selectFrom("institutionPlanUsage")
      .select("operationCount")
      .where("institutionId", "=", institutionId)
      .where("moduleKey", "=", moduleKey)
      .executeTakeFirst();
    const currentCount = usage?.operationCount ?? 0;
    if (!isPro && currentCount >= 5) throw new Error("PLAN_LIMIT_REACHED");

    const nextCount = currentCount + 1;
    if (usage) {
      await trx.updateTable("institutionPlanUsage")
        .set({ operationCount: nextCount, updatedAt: new Date() })
        .where("institutionId", "=", institutionId)
        .where("moduleKey", "=", moduleKey)
        .execute();
    } else {
      await trx.insertInto("institutionPlanUsage")
        .values({ institutionId, moduleKey, operationCount: 1 })
        .execute();
    }

    const result = await operation(trx);
    return { result, operationCount: nextCount, plan: effectivePlan };
  });
}
