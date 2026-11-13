-- Store the working-rate snapshot and actual work schedule for each monthly payroll row.
BEGIN;

ALTER TABLE institution_payroll_entries
  ADD COLUMN IF NOT EXISTS work_rate NUMERIC(5,2) NOT NULL DEFAULT 1 CHECK (work_rate > 0 AND work_rate <= 5),
  ADD COLUMN IF NOT EXISTS weekly_hours NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (weekly_hours >= 0 AND weekly_hours <= 60),
  ADD COLUMN IF NOT EXISTS working_days SMALLINT NOT NULL DEFAULT 0 CHECK (working_days >= 0 AND working_days <= 31);

COMMENT ON COLUMN institution_payroll_entries.work_rate IS 'Employment rate snapshot for the payroll month; informational and not multiplied into tariff base amount.';
COMMENT ON COLUMN institution_payroll_entries.weekly_hours IS 'Weekly teaching/work hours snapshot from the selected tariff or entered manually.';
COMMENT ON COLUMN institution_payroll_entries.working_days IS 'Actual number of working days recorded for the payroll month.';

COMMIT;
