BEGIN;
ALTER TABLE institution_tariffs
  ADD COLUMN IF NOT EXISTS staff_id UUID;
CREATE INDEX IF NOT EXISTS tariffs_staff_year_idx
  ON institution_tariffs(institution_id, staff_id, academic_year);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tariffs_staff_same_institution_fk') THEN
    ALTER TABLE institution_tariffs
      ADD CONSTRAINT tariffs_staff_same_institution_fk
      FOREIGN KEY (institution_id, staff_id)
      REFERENCES institution_staff(institution_id, id)
      ON DELETE SET NULL (staff_id);
  END IF;
END $$;
COMMIT;
