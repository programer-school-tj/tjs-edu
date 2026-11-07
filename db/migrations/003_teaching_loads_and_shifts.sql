-- Teaching allocations and shift-aware timetable slots.
BEGIN;

ALTER TABLE institution_timetable_entries
  ADD COLUMN IF NOT EXISTS shift_number INTEGER NOT NULL DEFAULT 1
  CHECK (shift_number IN (1, 2));

UPDATE institution_timetable_entries e
SET shift_number = CASE WHEN c.grade BETWEEN 1 AND 7 THEN 2 ELSE 1 END
FROM institution_classes c
WHERE c.id = e.class_id;

DROP INDEX IF EXISTS timetable_staff_slot_uq;
CREATE UNIQUE INDEX timetable_staff_shift_slot_uq
  ON institution_timetable_entries(institution_id, staff_id, weekday, shift_number, lesson_number, academic_year);

CREATE TABLE IF NOT EXISTS institution_teaching_loads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL,
  class_id UUID NOT NULL,
  subject TEXT NOT NULL CHECK (length(trim(subject)) BETWEEN 2 AND 120),
  weekly_hours NUMERIC(5,2) NOT NULL CHECK (weekly_hours > 0 AND weekly_hours <= 36),
  academic_year TEXT NOT NULL,
  created_by BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (institution_id, staff_id) REFERENCES institution_staff(institution_id, id) ON DELETE CASCADE,
  FOREIGN KEY (institution_id, class_id) REFERENCES institution_classes(institution_id, id) ON DELETE CASCADE,
  UNIQUE (institution_id, staff_id, class_id, subject, academic_year)
);
CREATE INDEX IF NOT EXISTS teaching_loads_class_year_idx
  ON institution_teaching_loads(institution_id, class_id, academic_year);
CREATE INDEX IF NOT EXISTS teaching_loads_staff_year_idx
  ON institution_teaching_loads(institution_id, staff_id, academic_year);

COMMIT;
