import { evaluateFinanceFormula } from "./financeFormula";

export type FinanceRuleTarget =
  | "baseAmount" | "weeklyHours"
  | "classHeadAllowance" | "notebookCheckingAllowance"
  | "methodicalAssociationHeadAllowance" | "otherAllowances"
  | "incomeTaxDeduction" | "partyDuesDeduction"
  | "tradeUnionDuesDeduction" | "newspaperDeduction" | "otherDeductions";

export type FinanceRuleInput = {
  id: string;
  ruleKey: string;
  title: string;
  category: string;
  calculationType: string;
  numericValue: number | string | null;
  formula: string | null;
  appliesTo: Record<string, unknown>;
  effectiveFrom: Date | string;
  effectiveTo: Date | string | null;
  sourceTitle: string;
  sourceReference: string | null;
};

export type FinanceCalculationContext = {
  baseAmount: number;
  grossAmount: number;
  allowances: number;
  weeklyHours: number;
  workRate: number;
  workingDays: number;
};

const TARGETS = new Set<FinanceRuleTarget>([
  "baseAmount", "weeklyHours", "classHeadAllowance", "notebookCheckingAllowance",
  "methodicalAssociationHeadAllowance", "otherAllowances", "incomeTaxDeduction",
  "partyDuesDeduction", "tradeUnionDuesDeduction", "newspaperDeduction", "otherDeductions",
]);

const BASES = new Set<keyof FinanceCalculationContext>([
  "baseAmount", "grossAmount", "allowances", "weeklyHours", "workRate", "workingDays",
]);

export function getFinanceRuleTarget(rule: FinanceRuleInput): FinanceRuleTarget | null {
  const target = rule.appliesTo?.target;
  return typeof target === "string" && TARGETS.has(target as FinanceRuleTarget)
    ? target as FinanceRuleTarget : null;
}

export function matchesFinanceRule(
  rule: FinanceRuleInput,
  context: { institutionType: string; positionTitle: string; qualificationCategory?: string | null; educationLevel?: string | null },
) {
  const filters: Array<[string, string | null | undefined]> = [
    ["institutionType", context.institutionType],
    ["positionTitle", context.positionTitle],
    ["qualificationCategory", context.qualificationCategory],
    ["educationLevel", context.educationLevel],
  ];
  return filters.every(([key, actual]) => {
    const expected = rule.appliesTo?.[key];
    return expected === undefined || expected === null || expected === ""
      || (actual ?? "").trim().toLocaleLowerCase() === String(expected).trim().toLocaleLowerCase();
  });
}

export function calculateFinanceRuleValue(
  rule: FinanceRuleInput,
  context: FinanceCalculationContext,
) {
  const rawBase = rule.appliesTo?.base;
  const baseKey = typeof rawBase === "string" && BASES.has(rawBase as keyof FinanceCalculationContext)
    ? rawBase as keyof FinanceCalculationContext : "baseAmount";
  const base = context[baseKey];
  let result: number;
  if (rule.calculationType === "fixed") {
    result = Number(rule.numericValue);
  } else if (rule.calculationType === "percentage") {
    result = base * Number(rule.numericValue) / 100;
  } else if (rule.calculationType === "formula" && rule.formula) {
    const cells: Record<string, number> = {
      A1: context.baseAmount,
      A2: context.grossAmount,
      A3: context.weeklyHours,
      A4: context.workRate,
      A5: context.allowances,
      A6: context.workingDays,
    };
    result = evaluateFinanceFormula(rule.formula, (address) => cells[address] ?? 0);
  } else {
    throw new Error(`Қоидаи ${rule.ruleKey} навъи ҳисобкунии дуруст надорад.`);
  }
  if (!Number.isFinite(result) || result < 0 || result > 1000000) {
    throw new Error(`Натиҷаи қоидаи «${rule.title}» аз ҳудуди иҷозатшуда берун аст.`);
  }
  return Math.round((result + Number.EPSILON) * 100) / 100;
}

export function aggregateFinanceRuleValues(rules: FinanceRuleInput[], context: FinanceCalculationContext) {
  const totals: Partial<Record<FinanceRuleTarget, number>> = {};
  const snapshots: Array<{ id: string; ruleKey: string; title: string; target: FinanceRuleTarget; calculationType: string; numericValue: number | string | null; formula: string | null; appliesTo: Record<string, unknown>; effectiveFrom: Date | string; effectiveTo: Date | string | null; sourceTitle: string; sourceReference: string | null; appliedAmount: number }> = [];
  for (const rule of rules) {
    const target = getFinanceRuleTarget(rule);
    if (!target) continue;
    const appliedAmount = calculateFinanceRuleValue(rule, context);
    totals[target] = Math.round(((totals[target] ?? 0) + appliedAmount + Number.EPSILON) * 100) / 100;
    snapshots.push({ id: rule.id, ruleKey: rule.ruleKey, title: rule.title, target, calculationType: rule.calculationType, numericValue: rule.numericValue, formula: rule.formula, appliesTo: rule.appliesTo, effectiveFrom: rule.effectiveFrom, effectiveTo: rule.effectiveTo, sourceTitle: rule.sourceTitle, sourceReference: rule.sourceReference, appliedAmount });
  }
  return { totals, snapshots };
}
