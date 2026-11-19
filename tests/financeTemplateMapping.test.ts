import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPayrollTemplateCells,
  buildTariffTemplateCells,
  type FinanceTemplateStaff,
  type FinanceTemplateTariff,
} from "../helpers/financeTemplateMapping";

const staff: FinanceTemplateStaff[] = [{
  id: "staff-1",
  fullName: "Омӯзгор Санҷишӣ",
  positionTitle: "Омӯзгор",
  subject: "Информатика",
}];

const tariff = (overrides: Partial<FinanceTemplateTariff> = {}): FinanceTemplateTariff => ({
  positionTitle: "Омӯзгор",
  educationLevel: "Маълумоти олӣ",
  qualificationCategory: "Бе категория",
  monthlyBase: 2500,
  weeklyHours: 18,
  academicYear: "2026-2027",
  effectiveFrom: "2026-09-01",
  ...overrides,
});

test("tariff template uses the personal active tariff before a generic tariff", () => {
  const cells = buildTariffTemplateCells(
    staff,
    [
      tariff({ monthlyBase: 2000 }),
      tariff({ staffId: "staff-1", monthlyBase: 2750, qualificationCategory: "Категорияи якум" }),
    ],
    "2026-2027",
    new Date("2026-10-01T00:00:00.000Z"),
  );

  assert.equal(cells.A5, "1");
  assert.equal(cells.B5, "Омӯзгор Санҷишӣ");
  assert.equal(cells.H5, "Информатика");
  assert.equal(cells.J5, "2750");
  assert.equal(cells.E5, "Категорияи якум");
});

test("tariff template ignores tariffs outside the academic year or effective period", () => {
  const cells = buildTariffTemplateCells(
    staff,
    [
      tariff({ monthlyBase: 1900, effectiveTo: "2026-09-30" }),
      tariff({ monthlyBase: 2100, academicYear: "2025-2026" }),
    ],
    "2026-2027",
    new Date("2026-10-01T00:00:00.000Z"),
  );

  assert.equal(cells.J5, undefined);
});

test("payroll template writes only confirmed columns and preserves exact values", () => {
  const cells = buildPayrollTemplateCells(
    staff,
    [tariff()],
    [{
      staffId: "staff-1",
      baseAmount: 2500,
      grossAmount: 3125.5,
      workingDays: 22,
      notebookCheckingAllowance: 125,
      classHeadAllowance: 250,
      methodicalAssociationHeadAllowance: 250,
    }],
    "2026-2027",
    "2026-10",
  );

  assert.equal(cells.G5, "2500");
  assert.equal(cells.Q5, "125");
  assert.equal(cells.R5, "250");
  assert.equal(cells.S5, "250");
  assert.equal(cells.V5, "3125.5");
  assert.equal(cells.W5, "22");
  for (const column of ["H", "I", "J", "K", "L", "M", "N", "O", "P", "T", "U", "X", "Y", "Z", "AA", "AB", "AC", "AD"]) {
    assert.equal(cells[column + "5"], undefined, `Unexpected value in ${column}5`);
  }
});

test("template mapping is capped at the 69 employee rows", () => {
  const manyStaff = Array.from({ length: 75 }, (_, index) => ({
    id: `staff-${index + 1}`,
    fullName: `Корманд ${index + 1}`,
    positionTitle: "Омӯзгор",
  }));
  const cells = buildTariffTemplateCells(manyStaff, [tariff()], "2026-2027", new Date("2026-10-01T00:00:00.000Z"));

  assert.equal(cells.A141, "69");
  assert.equal(cells.A143, undefined);
});
