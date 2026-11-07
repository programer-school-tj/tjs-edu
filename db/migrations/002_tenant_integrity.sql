-- Enforce tenant ownership at the database layer.
-- Requires PostgreSQL 15+ and the initial schema migration.
BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS institution_classes_tenant_id_uq
  ON institution_classes(institution_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS institution_staff_tenant_id_uq
  ON institution_staff(institution_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS institution_students_tenant_id_uq
  ON institution_students(institution_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS institution_tariffs_tenant_id_uq
  ON institution_tariffs(institution_id, id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'classes_teacher_same_institution_fk') THEN
    ALTER TABLE institution_classes
      ADD CONSTRAINT classes_teacher_same_institution_fk
      FOREIGN KEY (institution_id, class_teacher_staff_id)
      REFERENCES institution_staff(institution_id, id)
      ON DELETE SET NULL (class_teacher_staff_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_class_same_institution_fk') THEN
    ALTER TABLE institution_students
      ADD CONSTRAINT students_class_same_institution_fk
      FOREIGN KEY (institution_id, class_id)
      REFERENCES institution_classes(institution_id, id)
      ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_staff_same_institution_fk') THEN
    ALTER TABLE institution_payroll_entries
      ADD CONSTRAINT payroll_staff_same_institution_fk
      FOREIGN KEY (institution_id, staff_id)
      REFERENCES institution_staff(institution_id, id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_tariff_same_institution_fk') THEN
    ALTER TABLE institution_payroll_entries
      ADD CONSTRAINT payroll_tariff_same_institution_fk
      FOREIGN KEY (institution_id, tariff_id)
      REFERENCES institution_tariffs(institution_id, id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_class_same_institution_fk') THEN
    ALTER TABLE institution_attendance
      ADD CONSTRAINT attendance_class_same_institution_fk
      FOREIGN KEY (institution_id, class_id)
      REFERENCES institution_classes(institution_id, id)
      ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_student_same_institution_fk') THEN
    ALTER TABLE institution_attendance
      ADD CONSTRAINT attendance_student_same_institution_fk
      FOREIGN KEY (institution_id, student_id)
      REFERENCES institution_students(institution_id, id)
      ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'timetable_class_same_institution_fk') THEN
    ALTER TABLE institution_timetable_entries
      ADD CONSTRAINT timetable_class_same_institution_fk
      FOREIGN KEY (institution_id, class_id)
      REFERENCES institution_classes(institution_id, id)
      ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'timetable_staff_same_institution_fk') THEN
    ALTER TABLE institution_timetable_entries
      ADD CONSTRAINT timetable_staff_same_institution_fk
      FOREIGN KEY (institution_id, staff_id)
      REFERENCES institution_staff(institution_id, id);
  END IF;
END $$;

COMMIT;
