-- Central, effective-dated finance rules managed by platform administrators.
BEGIN;

CREATE TABLE IF NOT EXISTS finance_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key VARCHAR(80) NOT NULL,
  title VARCHAR(180) NOT NULL,
  category VARCHAR(32) NOT NULL CHECK (category IN ('base_salary','allowance','deduction','work_hours','other')),
  calculation_type VARCHAR(16) NOT NULL CHECK (calculation_type IN ('fixed','percentage','formula')),
  numeric_value NUMERIC(12,4),
  formula TEXT,
  applies_to JSONB NOT NULL DEFAULT '{}'::jsonb,
  effective_from DATE NOT NULL,
  effective_to DATE,
  source_title VARCHAR(240) NOT NULL,
  source_reference VARCHAR(500),
  notes VARCHAR(1000),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT finance_rules_date_range CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CONSTRAINT finance_rules_value_shape CHECK (
    (calculation_type = 'formula' AND formula IS NOT NULL AND length(trim(formula)) > 0)
    OR (calculation_type IN ('fixed','percentage') AND numeric_value IS NOT NULL AND formula IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS finance_rules_key_dates_idx
  ON finance_rules (rule_key, effective_from DESC, effective_to);

CREATE INDEX IF NOT EXISTS finance_rules_active_dates_idx
  ON finance_rules (is_active, effective_from, effective_to);

COMMENT ON TABLE finance_rules IS 'Global government and platform finance rules with effective dates; historical versions are retained.';
COMMENT ON COLUMN finance_rules.applies_to IS 'Optional JSON criteria such as institution type, position, qualification category, or education level.';

COMMIT;
