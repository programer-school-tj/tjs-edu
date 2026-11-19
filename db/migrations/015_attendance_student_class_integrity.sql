-- Ensure an attendance row references a student enrolled in that exact class.
-- The existing tenant-level foreign keys remain in place; this adds class-level integrity.
BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS institution_students_tenant_class_id_uq
  ON institution_students(institution_id, class_id, id);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'attendance_student_class_same_class_fk'
      AND conrelid = 'institution_attendance'::regclass
  ) THEN
    ALTER TABLE institution_attendance
      ADD CONSTRAINT attendance_student_class_same_class_fk
      FOREIGN KEY (institution_id, class_id, student_id)
      REFERENCES institution_students(institution_id, class_id, id)
      ON DELETE CASCADE;
  END IF;
END $$;

COMMIT;
