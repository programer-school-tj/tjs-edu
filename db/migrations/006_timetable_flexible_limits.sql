BEGIN;

CREATE TABLE IF NOT EXISTS institution_timetable_settings (
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  academic_year TEXT NOT NULL,
  school_days INTEGER NOT NULL DEFAULT 6 CHECK (school_days BETWEEN 1 AND 6),
  max_lessons_per_day INTEGER NOT NULL DEFAULT 6 CHECK (max_lessons_per_day BETWEEN 1 AND 12),
  teacher_daily_limit INTEGER NOT NULL DEFAULT 6 CHECK (teacher_daily_limit BETWEEN 1 AND 12),
  class_daily_limit INTEGER NOT NULL DEFAULT 6 CHECK (class_daily_limit BETWEEN 1 AND 12),
  shift_split_grade INTEGER NOT NULL DEFAULT 7 CHECK (shift_split_grade BETWEEN 1 AND 10),
  teacher_daily_limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  class_daily_limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by BIGINT REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (institution_id, academic_year),
  CHECK (jsonb_typeof(teacher_daily_limits) = 'object'),
  CHECK (jsonb_typeof(class_daily_limits) = 'object')
);

COMMENT ON TABLE institution_timetable_settings IS
  'Per-institution, per-academic-year limits for automatic timetable generation. Individual teacher/class limits override defaults.';

COMMIT;
