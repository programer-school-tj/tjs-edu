-- Preserve the exact finance-rule versions and computed values used for each payroll entry.
BEGIN;
ALTER TABLE institution_payroll_entries
  ADD COLUMN IF NOT EXISTS finance_rule_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb;
COMMENT ON COLUMN institution_payroll_entries.finance_rule_snapshot IS 'Immutable snapshot of central finance rules and computed amounts used when this payroll entry was created.';
COMMIT;
