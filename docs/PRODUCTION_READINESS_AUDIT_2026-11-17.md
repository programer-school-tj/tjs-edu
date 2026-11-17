# TJS Edu production-readiness audit

Date: 2026-11-17
Audited ref: `work/production-readiness-phase-1`
Audited commit: `61d4137ba0435be8cd5ce30a1c103a9dae23f922`

## Scope and evidence

This is a source-level audit note, not a production certification. The repository files and the GitHub Actions run below were inspected through GitHub.

- Workflow run: https://github.com/programer-school-tj/tjs-edu/actions/runs/44035586828
- The run's single `build` job completed with conclusion `success`.
- Its listed successful steps include PostgreSQL migrations, API/PostgreSQL smoke test, unit tests, TypeScript check, production build, Docker image validation, and upload of both artifacts.
- Artifacts `tjs-edu-source` (412,439 bytes) and `tjs-edu-dist` (1,848,331 bytes) were present and not expired at inspection time.
- This run is tied to commit `61d4137`; it does not prove that later commits, if any, pass.

## Confirmed findings

### 1. Staff availability has no shift dimension

Files inspected:

- `db/migrations/005_staff_availability.sql`
- `endpoints/staff-availability/save_POST.ts`
- `endpoints/timetable/generate_POST.ts`
- `pages/timetable.tsx`

The availability table currently stores institution, staff member, academic year, weekday and lesson number, but no shift number. Its unique constraint also omits shift. The save endpoint accepts weekday and lesson number only; the timetable page submits those fields only; the generator reads availability without a shift and creates blocked-slot keys from staff, weekday and lesson number only.

Consequently, a blocked lesson number is applied to both shifts by the generator. The data model cannot express “unavailable in shift 1 but available in shift 2”.

### 2. Availability lesson-number range is inconsistent

Migration 005 constrains `lesson_number` to 0 through 6, where 0 represents an unavailable whole day. The save endpoint accepts values through 12, and timetable settings allow up to 12 lessons per day. A request for lesson 7–12 can pass request validation but fail the database constraint.

### 3. Shift-aware timetable uniqueness is intentional in migration 012

Migration `012_timetable_shift_aware_conflicts.sql` drops the global teacher/room slot indexes introduced earlier and creates indexes that include `shift_number`. Its comments explicitly define lesson numbers as local to a shift. Therefore, period 1 in shift 1 and period 1 in shift 2 are treated as separate slots by the database.

This corrects any earlier interpretation that migration 012 enforces teacher/room conflicts globally across shifts. The actual policy must be checked against real bell schedules before production: if shifts overlap in clock time, a shift-local unique index alone cannot detect a real simultaneous conflict.

## Recommended safe remediation

1. Design migration 013 to add a shift scope to staff availability. Preserve existing rows as “all shifts” (for example, a documented sentinel value) so old records do not silently become shift-1-only.
2. Replace the existing availability uniqueness constraint with one that includes the shift scope.
3. Validate the shift scope and lesson range consistently at the API and database layers.
4. Update the timetable page, availability client/helper, and generator to read and honor the selected shift. Keep legacy records applying to both shifts.
5. Add tests for legacy all-shift rows, shift-1-only and shift-2-only blocks, whole-day blocks, lesson 7–12, duplicate slots, and migration upgrade behavior.
6. Before adopting shift-local teacher/room conflict rules in production, verify actual start/end times for both shifts. If clock times overlap, model real time intervals or retain a cross-shift conflict check for overlapping periods.

## Not changed in this audit

No schema migration, application behavior, database connection, Supabase project, branch protection setting, or production deployment was changed as part of this audit note. No Supabase project was created or connected. The `main` branch was not targeted.
