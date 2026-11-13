export type FinanceTemplateStaff = {
  id: string;
  fullName: string;
  positionTitle: string;
  subject?: string | null;
};

export type FinanceTemplateTariff = {
  staffId?: string | null;
  positionTitle: string;
  educationLevel?: string | null;
  qualificationCategory?: string | null;
  monthlyBase: number | string;
  academicYear: string;
  effectiveFrom: string | Date;
  effectiveTo?: string | Date | null;
};

export type FinanceTemplatePayrollEntry = {
  staffId: string;
  baseAmount: number | string;
};

function normalized(value: unknown) {
  return String(value ?? "").trim().toLocaleLowerCase();
}

function asDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function findTariff(staff: FinanceTemplateStaff, tariffs: FinanceTemplateTariff[], academicYear: string, asOf: Date, asOfEnd = asOf) {
  const matching = tariffs.filter((tariff) => {
    if (tariff.academicYear !== academicYear) return false;
    if (normalized(tariff.positionTitle) !== normalized(staff.positionTitle)) return false;
    if (tariff.staffId && tariff.staffId !== staff.id) return false;
    const from = asDate(tariff.effectiveFrom);
    const to = asDate(tariff.effectiveTo);
    return Boolean(from && from <= asOf && (!to || to >= asOfEnd));
  });
  const personal = matching.filter((tariff) => tariff.staffId === staff.id);
  const candidates = personal.length ? personal : matching.filter((tariff) => !tariff.staffId);
  return candidates.sort((a, b) => (asDate(b.effectiveFrom)?.getTime() || 0) - (asDate(a.effectiveFrom)?.getTime() || 0))[0];
}

function addCell(cells: Record<string, string>, column: string, row: number, value: unknown) {
  if (value === null || value === undefined || value === "") return;
  cells[`${column}${row}`] = String(value);
}

export function buildTariffTemplateCells(
  staff: FinanceTemplateStaff[],
  tariffs: FinanceTemplateTariff[],
  academicYear: string,
  asOf = new Date(),
) {
  const cells: Record<string, string> = {};
  staff.slice(0, 69).forEach((person, index) => {
    const row = 5 + index * 2;
    const tariff = findTariff(person, tariffs, academicYear, asOf);
    addCell(cells, "A", row, index + 1);
    addCell(cells, "B", row, person.fullName);
    addCell(cells, "C", row, person.positionTitle);
    addCell(cells, "D", row, tariff?.educationLevel);
    addCell(cells, "E", row, tariff?.qualificationCategory);
    addCell(cells, "H", row, person.subject);
    addCell(cells, "J", row, tariff?.monthlyBase);
  });
  return cells;
}

export function buildPayrollTemplateCells(
  staff: FinanceTemplateStaff[],
  tariffs: FinanceTemplateTariff[],
  payrollEntries: FinanceTemplatePayrollEntry[],
  academicYear: string,
  payrollMonth: string,
) {
  const validMonth = /^20[0-9]{2}-(0[1-9]|1[0-2])$/.test(payrollMonth);
  const monthDate = validMonth ? new Date(`${payrollMonth}-01T00:00:00.000Z`) : new Date();
  const monthEnd = validMonth
    ? new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0))
    : monthDate;
  const cells: Record<string, string> = {};
  staff.slice(0, 69).forEach((person, index) => {
    const row = 5 + index * 2;
    const tariff = findTariff(person, tariffs, academicYear, monthDate, monthEnd);
    const payroll = payrollEntries.find((entry) => entry.staffId === person.id);
    addCell(cells, "B", row, person.fullName);
    addCell(cells, "C", row, person.positionTitle);
    addCell(cells, "D", row, tariff?.educationLevel);
    addCell(cells, "E", row, tariff?.qualificationCategory);
    addCell(cells, "F", row, person.subject);
    addCell(cells, "G", row, payroll?.baseAmount ?? tariff?.monthlyBase);
  });
  return cells;
}
