import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregateFinanceRuleValues,
  calculateFinanceRuleValue,
  matchesFinanceRule,
  type FinanceRuleInput,
} from "../helpers/financeRuleCalculation";

const context = {
  baseAmount: 2000,
  grossAmount: 2500,
  allowances: 500,
  weeklyHours: 18,
  workRate: 1,
  workingDays: 22,
};

const rule = (overrides: Partial<FinanceRuleInput> = {}): FinanceRuleInput => ({
  id: "rule-1",
  ruleKey: "income_tax",
  title: "Андоз",
  category: "deduction",
  calculationType: "percentage",
  numericValue: 13,
  formula: null,
  appliesTo: { target: "incomeTaxDeduction", base: "grossAmount" },
  effectiveFrom: "2026-09-01",
  effectiveTo: null,
  sourceTitle: "Санади санҷишӣ",
  sourceReference: null,
  ...overrides,
});

test("calculates a percentage against its selected payroll base", () => {
  assert.equal(calculateFinanceRuleValue(rule(), context), 325);
});

test("calculates fixed and Excel-style formula rules", () => {
  assert.equal(calculateFinanceRuleValue(rule({ calculationType: "fixed", numericValue: 75 }), context), 75);
  assert.equal(calculateFinanceRuleValue(rule({ calculationType: "formula", numericValue: null, formula: "=ROUND(A2*13%,2)" }), context), 325);
});

test("filters rules by institution, position and qualification", () => {
  const candidate = rule({ appliesTo: { target: "incomeTaxDeduction", institutionType: "school", positionTitle: "Омӯзгор", qualificationCategory: "олӣ" } });
  assert.equal(matchesFinanceRule(candidate, { institutionType: "school", positionTitle: "Омӯзгор", qualificationCategory: "олӣ" }), true);
  assert.equal(matchesFinanceRule(candidate, { institutionType: "college", positionTitle: "Омӯзгор", qualificationCategory: "олӣ" }), false);
  assert.equal(matchesFinanceRule(candidate, { institutionType: "school", positionTitle: "Муҳосиб", qualificationCategory: "олӣ" }), false);
});

test("aggregates separate rule results and records an immutable audit snapshot", () => {
  const rules = [
    rule({ id: "tax-1", numericValue: 10 }),
    rule({ id: "tax-2", numericValue: 3 }),
  ];
  const result = aggregateFinanceRuleValues(rules, context);
  assert.equal(result.totals.incomeTaxDeduction, 325);
  assert.equal(result.snapshots.length, 2);
  assert.equal(result.snapshots[0].appliedAmount, 250);
  assert.equal(result.snapshots[0].sourceTitle, "Санади санҷишӣ");
  assert.equal(result.snapshots[0].effectiveFrom, "2026-09-01");
});

test("rejects a rule with an invalid target amount", () => {
  assert.throws(() => calculateFinanceRuleValue(rule({ calculationType: "fixed", numericValue: 1000001 }), context));
});
