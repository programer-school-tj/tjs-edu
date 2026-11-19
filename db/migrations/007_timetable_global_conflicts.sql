-- Enforce teacher and room conflicts across shifts at database level.
-- Refuse migration if legacy rows already violate the stronger constraints.
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM institution_timetable_entries
    GROUP BY institution_id, staff_id, weekday, lesson_number, academic_year
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add global teacher-slot constraint: duplicate teacher slots exist across shifts. Resolve timetable conflicts before applying migration 007.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM institution_timetable_entries
    WHERE room IS NOT NULL AND btrim(room) <> ''
    GROUP BY institution_id, lower(btrim(room)), weekday, lesson_number, academic_year
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add room-slot constraint: duplicate room slots exist across shifts. Resolve room conflicts before applying migration 007.';
  END IF;
END $$;

DROP INDEX IF EXISTS timetable_staff_shift_slot_uq;

CREATE UNIQUE INDEX IF NOT EXISTS timetable_staff_slot_uq
  ON institution_timetable_entries(institution_id, staff_id, weekday, lesson_number, academic_year);

CREATE UNIQUE INDEX IF NOT EXISTS timetable_room_slot_uq
  ON institution_timetable_entries(institution_id, lower(btrim(room)), weekday, lesson_number, academic_year)
  WHERE room IS NOT NULL AND btrim(room) <> '';

COMMENT ON INDEX timetable_staff_slot_uq IS
  'Prevents one teacher from being assigned to two classes at the same weekday and lesson, regardless of shift.';
COMMENT ON INDEX timetable_room_slot_uq IS
  'Prevents one room from being assigned to two classes at the same weekday and lesson, regardless of shift.';

COMMIT;
