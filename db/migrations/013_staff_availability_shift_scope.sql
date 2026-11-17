BEGIN;
-- Existing rows default to both shifts to preserve their previous meaning.
ALTER TABLE institution_staff_availability
  ADD COLUMN IF NOT EXISTS shift_number INTEGER NOT NULL DEFAULT 0
  CHECK (shift_number BETWEEN 0 AND 2);
-- Align the database limit with the API and timetable settings (up to 12 lessons).
ALTER TABLE institution_staff_availability
  DROP CONSTRAINT IF EXISTS institution_staff_availability_lesson_number_check;
ALTER TABLE institution_staff_availability
  ADD CONSTRAINT institution_staff_availability_lesson_number_check CHECK (lesson_number BETWEEN 0 AND 12);
ALTER TABLE institution_staff_availability
  DROP CONSTRAINT IF EXISTS institution_staff_availability_institution_id_staff_id_academic_year_weekday_lesson_number_key;
ALTER TABLE institution_staff_availability
  ADD CONSTRAINT institution_staff_availability_shift_slot_key
  UNIQUE (institution_id, staff_id, academic_year, weekday, shift_number, lesson_number);
COMMENT ON COLUMN institution_staff_availability.shift_number IS
  '0 applies to both shifts; 1 or 2 applies only to the selected shift.';
COMMENT ON COLUMN institution_staff_availability.lesson_number IS
  '0 means unavailable for the entire weekday in the selected shift scope; 1-12 blocks one lesson slot.';
COMMIT;
