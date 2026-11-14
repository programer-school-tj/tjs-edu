import test from "node:test";
import assert from "node:assert/strict";
import { evaluateFinanceFormula } from "../helpers/financeFormula";

const cells: Record<string, number | string> = {
  A1: 2000, A2: 18, B1: 25, B2: 100, C1: 150, C2: 250,
};
const read = (address: string) => cells[address] ?? 0;

test("evaluates Excel-style arithmetic and cell references", () => {
  assert.equal(evaluateFinanceFormula("=A1*1.25", read), 2500);
  assert.equal(evaluateFinanceFormula("=(A1/A2)*20", read), 2222.2222);
  assert.equal(evaluateFinanceFormula("=A1+B1*2", read), 2050);
});

test("evaluates percentages and common spreadsheet functions", () => {
  assert.equal(evaluateFinanceFormula("=A1*(1+25%)", read), 2500);
  assert.equal(evaluateFinanceFormula("=ROUND(A1*1.125, 2)", read), 2250);
  assert.equal(evaluateFinanceFormula("=SUM(B2:C2)", read), 350);
  assert.equal(evaluateFinanceFormula("=MAX(B2:C2)", read), 250);
  assert.equal(evaluateFinanceFormula("=MIN(B2:C2)", read), 100);
  assert.equal(evaluateFinanceFormula("=AVERAGE(B2:C2)", read), 175);
  assert.equal(evaluateFinanceFormula("=ABS(-25)", read), 25);
});

test("evaluates IF with a comparison", () => {
  assert.equal(evaluateFinanceFormula("=IF(A1>1000,A1*1.1,A1)", read), 2200);
});

test("rejects unsupported code, divide-by-zero and invalid formulas", () => {
  assert.throws(() => evaluateFinanceFormula("=A1/0", read));
  assert.throws(() => evaluateFinanceFormula("=alert(1)", read));
  assert.throws(() => evaluateFinanceFormula("=A1+unknown", read));
  assert.throws(() => evaluateFinanceFormula("=A1+", read));
});
