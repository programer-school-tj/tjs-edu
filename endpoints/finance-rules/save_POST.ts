import { getServerUserSession } from "../../helpers/getServerUserSession";
import { db } from "../../helpers/db";
import { z } from "zod";
import superjson from "superjson";
import { evaluateFinanceFormula } from "../../helpers/financeFormula";
import type { JsonObject } from "../../helpers/schema";

const schema = z.object({
  ruleKey: z.string().trim().min(2).max(80).regex(/^[a-zA-Z0-9_.-]+$/),
  title: z.string().trim().min(2).max(180),
  category: z.enum(["base_salary", "allowance", "deduction", "work_hours", "other"]),
  calculationType: z.enum(["fixed", "percentage", "formula"]),
  numericValue: z.number().min(-1000000).max(1000000000).optional(),
  formula: z.string().trim().max(500).optional(),
  appliesTo: z.object({
    target: z.enum(["baseAmount", "weeklyHours", "classHeadAllowance", "notebookCheckingAllowance", "methodicalAssociationHeadAllowance", "otherAllowances", "incomeTaxDeduction", "partyDuesDeduction", "tradeUnionDuesDeduction", "newspaperDeduction", "otherDeductions"]),
    base: z.enum(["baseAmount", "grossAmount", "allowances", "weeklyHours", "workRate", "workingDays"]).optional(),
    institutionType: z.string().max(40).optional(),
    positionTitle: z.string().max(180).optional(),
    qualificationCategory: z.string().max(80).optional(),
    educationLevel: z.string().max(80).optional(),
  }),
  effectiveFrom: z.string().date(),
  sourceTitle: z.string().trim().min(3).max(240),
  sourceReference: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
}).superRefine((value, ctx) => {
  const target = value.appliesTo.target;
  const allowanceTargets = ["classHeadAllowance", "notebookCheckingAllowance", "methodicalAssociationHeadAllowance", "otherAllowances"];
  const deductionTargets = ["incomeTaxDeduction", "partyDuesDeduction", "tradeUnionDuesDeduction", "newspaperDeduction", "otherDeductions"];
  const targetMatchesCategory = value.category === "other"
    || (value.category === "base_salary" && target === "baseAmount")
    || (value.category === "work_hours" && target === "weeklyHours")
    || (value.category === "allowance" && allowanceTargets.includes(target))
    || (value.category === "deduction" && deductionTargets.includes(target));
  if (!targetMatchesCategory) {
    ctx.addIssue({ code: "custom", path: ["appliesTo", "target"], message: "Қисми маош ба гурӯҳи интихобшуда мувофиқат намекунад." });
  }
  if (value.calculationType === "formula") {
    if (!value.formula?.startsWith("=")) {
      ctx.addIssue({ code: "custom", path: ["formula"], message: "Формула бояд бо аломати = оғоз шавад." });
    } else {
      try { evaluateFinanceFormula(value.formula, () => 0); }
      catch (error) {
        ctx.addIssue({ code: "custom", path: ["formula"], message: error instanceof Error ? error.message : "Формула нодуруст аст." });
      }
    }
    if (value.numericValue !== undefined) ctx.addIssue({ code: "custom", path: ["numericValue"], message: "Барои формула маблағи рақамӣ ворид намешавад." });
  } else if (value.numericValue === undefined || value.formula !== undefined) {
    ctx.addIssue({ code: "custom", path: ["numericValue"], message: "Барои қоидаи собит ё фоиз арзиши рақамӣ лозим аст." });
  }
  if (value.calculationType === "percentage" && (value.numericValue! <= -100 || value.numericValue! > 1000)) {
    ctx.addIssue({ code: "custom", path: ["numericValue"], message: "Фоиз бояд аз -100 зиёд ва аз 1000 зиёд набошад." });
  }
});

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") {
      return new Response(superjson.stringify({ message: "Танҳо маъмури асосии платформа метавонад қоидаҳоро тағйир диҳад." }), { status: 403 });
    }
    const input = schema.parse(superjson.parse(await request.text()));
    const effectiveFrom = new Date(`${input.effectiveFrom}T00:00:00.000Z`);
    const dayBefore = new Date(effectiveFrom.getTime() - 86400000);

    const rule = await db.transaction().execute(async (trx) => {
      const versions = await trx.selectFrom("financeRules")
        .select(["id", "effectiveFrom", "effectiveTo"])
        .where("ruleKey", "=", input.ruleKey)
        .where("isActive", "=", true)
        .execute();
      if (versions.some((item) => item.effectiveFrom.getTime() === effectiveFrom.getTime())) {
        throw new Error("RULE_VERSION_EXISTS");
      }
      const overlappingFuture = versions.some((item) =>
        item.effectiveFrom.getTime() > effectiveFrom.getTime()
        && (!item.effectiveTo || item.effectiveTo.getTime() >= effectiveFrom.getTime())
      );
      if (overlappingFuture) throw new Error("RULE_FUTURE_VERSION_EXISTS");

      for (const previous of versions) {
        const end = previous.effectiveTo?.getTime() ?? Number.POSITIVE_INFINITY;
        if (previous.effectiveFrom.getTime() < effectiveFrom.getTime() && end >= effectiveFrom.getTime()) {
          await trx.updateTable("financeRules")
            .set({ effectiveTo: dayBefore, updatedAt: new Date() })
            .where("id", "=", previous.id)
            .execute();
        }
      }

      const created = await trx.insertInto("financeRules").values({
        ruleKey: input.ruleKey,
        title: input.title,
        category: input.category,
        calculationType: input.calculationType,
        numericValue: input.numericValue ?? null,
        formula: input.formula ?? null,
        appliesTo: input.appliesTo as JsonObject,
        effectiveFrom,
        effectiveTo: null,
        sourceTitle: input.sourceTitle,
        sourceReference: input.sourceReference || null,
        notes: input.notes || null,
        isActive: true,
        createdBy: user.id,
      }).returningAll().executeTakeFirstOrThrow();

      await trx.insertInto("institutionAuditLogs").values({
        action: "finance_rule.created",
        actorUserId: user.id,
        details: {
          ruleKey: input.ruleKey,
          title: input.title,
          category: input.category,
          calculationType: input.calculationType,
          effectiveFrom: input.effectiveFrom,
          sourceTitle: input.sourceTitle,
        },
        entityId: created.id,
        entityType: "finance_rule",
        institutionId: null,
      }).execute();
      return created;
    });

    return new Response(superjson.stringify({ rule }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "RULE_VERSION_EXISTS") {
      return new Response(superjson.stringify({ message: "Барои ин қоида дар ҳамин сана версия аллакай вуҷуд дорад." }), { status: 409 });
    }
    if (code === "RULE_FUTURE_VERSION_EXISTS") {
      return new Response(superjson.stringify({ message: "Версияи ояндаи ин қоида мавҷуд аст. Аввал санаи онро санҷед." }), { status: 409 });
    }
    if (error instanceof z.ZodError) {
      return new Response(superjson.stringify({ message: error.issues[0]?.message || "Маълумоти қоида нодуруст аст." }), { status: 400 });
    }
    return new Response(superjson.stringify({ message: "Қоидаи молиявӣ сабт нашуд." }), { status: 500 });
  }
}
