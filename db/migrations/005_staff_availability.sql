BEGIN;

CREATE TABLE IF NOT EXISTS institution_staff_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL,
  academic_year TEXT NOT NULL,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 1 AND 6),
  lesson_number INTEGER NOT NULL CHECK (lesson_number BETWEEN 0 AND 6),
  created_by BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (institution_id, staff_id)
    REFERENCES institution_staff(institution_id, id) ON DELETE CASCADE,
  UNIQUE (institution_id, staff_id, academic_year, weekday, lesson_number)
);

CREATE INDEX IF NOT EXISTS staff_availability_lookup_idx
  ON institution_staff_availability(institution_id, academic_year, staff_id, weekday);

COMMENT ON COLUMN institution_staff_availability.lesson_number IS
  '0 means the teacher is unavailable for the entire weekday; 1-6 blocks one lesson slot.';

COMMIT;
