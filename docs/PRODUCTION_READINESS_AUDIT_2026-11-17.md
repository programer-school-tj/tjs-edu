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

## Follow-up implementation on the work branch

The following remediation was committed after the source-level audit, still only on `work/production-readiness-phase-1`:

- Added `db/migrations/013_staff_availability_shift_scope.sql`. Existing rows default to shift scope `0` (both shifts); new rules support `1` and `2`. The database lesson range is aligned to 0–12, and the availability uniqueness key now includes shift scope.
- Updated availability save/list endpoints, the Kysely schema type, and the client payload to carry `shiftNumber`. Validation rejects overlapping rules and supports up to 144 per-teacher rules.
- Added three UI choices, with “both shifts” selected by default. Narrowing an existing both-shifts restriction to one shift preserves the opposite shift's restriction.
- Updated automatic generation, Excel import, and manual lesson entry to apply availability to the correct shift.
- Added translations for the shift options in Tajik, Russian, English, Uzbek and Persian.
- Added `tests/staffAvailability.test.ts` for both-shift rules, shift-specific whole-day rules, and shift/day/teacher-scoped lesson rules.

### Verification status

The latest implementation commit `7d406a3f048dd4a247ca47566c9af32c7e5262f0` was verified by GitHub Actions run [#412](https://github.com/programer-school-tj/tjs-edu/actions/runs/44043892562), which completed with conclusion `success`. The successful job ran dependency installation, all PostgreSQL migrations against its ephemeral PostgreSQL 16 service, API/database smoke test, `npm test`, `npm run typecheck`, `npm run build`, and Docker image validation. The job also uploaded `tjs-edu-source` (417,285 bytes) and `tjs-edu-dist` (1,849,718 bytes) artifacts.

This confirms migration 013 and the full CI test/build sequence work in the temporary CI database/environment. It does **not** mean migration 013 has been applied to a persistent staging or production database. The artifacts are retained by GitHub Actions for 7 days from 2026-11-17. No Supabase project was created or connected, no production deployment was made, and the `main` branch was not targeted.

## Remaining production checks

1. Run the complete test suite, TypeScript check and production build against the latest branch commit.
2. Apply migration 013 to a staging database and verify upgrade behavior with existing availability rows.
3. Confirm real bell start/end times for both shifts. Shift-local timetable slots are only safe if the relevant periods do not overlap in clock time.


## Re-audit: 2026-11-18

Audited branch head: `814e503070bd7a7ab194a70f696d2e13bb578d06`.

### Confirmed since the previous audit

- GitHub Actions run [#424](https://github.com/programer-school-tj/tjs-edu/actions/runs/44222443277) completed successfully on the branch. This is CI evidence only, not a live deployment or production acceptance test.
- The timetable generator now uses `timetableLessonsOverlap` when checking teacher assignments, including assignments across shifts.
- The manual timetable and Excel-import paths were updated to use the same bell-time overlap check in commit `814e503`.
- Bell schedule remains internal logic only. The helper explicitly states that bell times must not be displayed in timetable or print templates.
- The current service worker still caches the application shell and static same-origin assets only. It does not implement durable offline form writes, an IndexedDB outbox, retry handling, or background synchronization.
- The three Excel form pages currently point to their previously configured static template URLs. A verified, self-hosted copy of the supplied workbook has not yet been added to this branch.

### Production blockers still open

1. Offline data-entry queue and conflict-aware synchronization are not implemented.
2. The supplied Excel workbook must be safely added as a valid binary asset in the repository, then checked for worksheet names, layout, formulas and print output.
3. The original timetable form has no time column. Bell-time intervals are for internal conflict validation only. The source timetable template has fewer class slots than the 21 classes currently configured for МТМУ №14; decide whether to use continuation pages or an approved expanded print form before changing the original layout.
4. Production hosting, HTTPS, persistent PostgreSQL, automated backups, rate limiting and institution-isolation acceptance tests remain to be configured and verified.
5. Android packaging and release process remain outstanding.

Do not interpret a successful CI run as proof that the app is deployed, that offline writes work, or that all institution workflows have passed end-to-end acceptance testing.
