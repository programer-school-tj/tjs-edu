-- Restore shift-aware teacher and room occupancy after migration 007.
-- A lesson number is local to a shift: period 1 in shift 1 is not simultaneous
-- with period 1 in shift 2. Classes remain protected by their existing class-slot
-- uniqueness constraint because each class belongs to exactly one shift.
BEGIN;

DROP INDEX IF EXISTS timetable_staff_slot_uq;
DROP INDEX IF EXISTS timetable_room_slot_uq;

CREATE UNIQUE INDEX IF NOT EXISTS timetable_staff_shift_slot_uq
  ON institution_timetable_entries(
    institution_id, staff_id, weekday, shift_number, lesson_number, academic_year
  );

CREATE UNIQUE INDEX IF NOT EXISTS timetable_room_shift_slot_uq
  ON institution_timetable_entries(
    institution_id, lower(btrim(room)), weekday, shift_number, lesson_number, academic_year
  )
  WHERE room IS NOT NULL AND btrim(room) <> '';

COMMENT ON INDEX timetable_staff_shift_slot_uq IS
  'Prevents one teacher from being assigned to two classes in the same shift, weekday and lesson.';
COMMENT ON INDEX timetable_room_shift_slot_uq IS
  'Prevents one room from being assigned to two classes in the same shift, weekday and lesson.';

COMMIT;
