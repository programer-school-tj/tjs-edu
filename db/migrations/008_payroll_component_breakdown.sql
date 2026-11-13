-- Itemize common education-sector payroll allowances and deductions.
-- Existing aggregate fields remain supported for backward compatibility.
BEGIN;

ALTER TABLE institution_payroll_entries
  ADD COLUMN IF NOT EXISTS class_head_allowance NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (class_head_allowance >= 0),
  ADD COLUMN IF NOT EXISTS notebook_checking_allowance NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (notebook_checking_allowance >= 0),
  ADD COLUMN IF NOT EXISTS methodical_association_head_allowance NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (methodical_association_head_allowance >= 0),
  ADD COLUMN IF NOT EXISTS other_allowances NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (other_allowances >= 0),
  ADD COLUMN IF NOT EXISTS income_tax_deduction NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (income_tax_deduction >= 0),
  ADD COLUMN IF NOT EXISTS party_dues_deduction NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (party_dues_deduction >= 0),
  ADD COLUMN IF NOT EXISTS trade_union_dues_deduction NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (trade_union_dues_deduction >= 0),
  ADD COLUMN IF NOT EXISTS newspaper_deduction NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (newspaper_deduction >= 0),
  ADD COLUMN IF NOT EXISTS other_deductions NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (other_deductions >= 0);

-- Preserve legacy aggregate amounts in the corresponding "other" component.
UPDATE institution_payroll_entries
SET other_allowances = allowances
WHERE other_allowances = 0 AND allowances <> 0;

UPDATE institution_payroll_entries
SET other_deductions = deductions
WHERE other_deductions = 0 AND deductions <> 0;

COMMENT ON COLUMN institution_payroll_entries.class_head_allowance IS 'Allowance for class leadership duties.';
COMMENT ON COLUMN institution_payroll_entries.notebook_checking_allowance IS 'Allowance for checking student notebooks.';
COMMENT ON COLUMN institution_payroll_entries.methodical_association_head_allowance IS 'Allowance for leading a subject/methodical association.';
COMMENT ON COLUMN institution_payroll_entries.income_tax_deduction IS 'Income tax withheld, entered as an amount; no rate is assumed.';
COMMENT ON COLUMN institution_payroll_entries.party_dues_deduction IS 'Party dues withheld, entered as an amount.';
COMMENT ON COLUMN institution_payroll_entries.trade_union_dues_deduction IS 'Trade union dues withheld, entered as an amount.';
COMMENT ON COLUMN institution_payroll_entries.newspaper_deduction IS 'Newspaper subscription/payment withheld, entered as an amount.';

COMMIT;
