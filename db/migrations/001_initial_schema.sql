-- TJS Edu initial PostgreSQL schema
-- Run against a NEW, dedicated database. Do not use ProgramerTJ credentials.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN CREATE TYPE user_role AS ENUM ('admin','user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE institution_type AS ENUM ('college','gymnasium','lyceum','school','university');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE institution_status AS ENUM ('approved','pending','rejected','suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE institution_member_role AS ENUM ('director','staff','teacher');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_uq ON users (lower(email));

CREATE TABLE IF NOT EXISTS user_passwords (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS user_passwords_user_uq ON user_passwords(user_id);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  last_accessed TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS login_attempts (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  attempted_at TIMESTAMPTZ DEFAULT now(),
  success BOOLEAN DEFAULT false
);
CREATE INDEX IF NOT EXISTS login_attempts_email_time_idx ON login_attempts(lower(email), attempted_at DESC);

CREATE TABLE IF NOT EXISTS password_reset_codes (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS password_reset_user_idx ON password_reset_codes(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  institution_type institution_type NOT NULL,
  region TEXT NOT NULL,
  district TEXT,
  address TEXT,
  director_name TEXT NOT NULL,
  contact_email TEXT,
  phone TEXT,
  created_by BIGINT NOT NULL REFERENCES users(id),
  approved_by BIGINT REFERENCES users(id),
  status institution_status NOT NULL DEFAULT 'pending',
  plan TEXT NOT NULL DEFAULT 'free',
  plan_expires_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS institutions_status_idx ON institutions(status);
CREATE INDEX IF NOT EXISTS institutions_creator_idx ON institutions(created_by);

CREATE TABLE IF NOT EXISTS institution_memberships (
  id BIGSERIAL PRIMARY KEY,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role institution_member_role NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(institution_id, user_id)
);
CREATE INDEX IF NOT EXISTS memberships_user_idx ON institution_memberships(user_id, is_active);

CREATE TABLE IF NOT EXISTS institution_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  grade INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 11),
  section TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  class_teacher_staff_id UUID,
  created_by BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(institution_id, grade, section, academic_year)
);

CREATE TABLE IF NOT EXISTS institution_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  position_title TEXT NOT NULL,
  subject TEXT,
  personnel_number TEXT,
  email TEXT,
  phone TEXT,
  employment_type TEXT NOT NULL DEFAULT 'main',
  workload_hours NUMERIC(8,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS staff_institution_idx ON institution_staff(institution_id, is_active);

ALTER TABLE institution_classes
  DROP CONSTRAINT IF EXISTS institution_classes_class_teacher_staff_id_fkey;
ALTER TABLE institution_classes
  ADD CONSTRAINT institution_classes_class_teacher_staff_id_fkey
  FOREIGN KEY (class_teacher_staff_id) REFERENCES institution_staff(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS institution_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES institution_classes(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  birth_date TIMESTAMPTZ,
  gender TEXT,
  student_number TEXT,
  guardian_name TEXT,
  guardian_phone TEXT,
  enrollment_status TEXT NOT NULL DEFAULT 'active',
  created_by BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS students_class_idx ON institution_students(institution_id, class_id);

CREATE TABLE IF NOT EXISTS institution_tariffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  position_title TEXT NOT NULL,
  qualification_category TEXT,
  education_level TEXT,
  weekly_hours NUMERIC(8,2),
  monthly_base NUMERIC(14,2) NOT NULL DEFAULT 0,
  academic_year TEXT NOT NULL,
  effective_from TIMESTAMPTZ NOT NULL,
  effective_to TIMESTAMPTZ,
  source_title TEXT,
  source_reference TEXT,
  notes TEXT,
  created_by BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tariffs_institution_year_idx ON institution_tariffs(institution_id, academic_year);

CREATE TABLE IF NOT EXISTS institution_payroll_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES institution_staff(id),
  tariff_id UUID REFERENCES institution_tariffs(id) ON DELETE SET NULL,
  payroll_month TIMESTAMPTZ NOT NULL,
  base_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  allowances NUMERIC(14,2) NOT NULL DEFAULT 0,
  deductions NUMERIC(14,2) NOT NULL DEFAULT 0,
  gross_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payroll_institution_month_idx ON institution_payroll_entries(institution_id, payroll_month);
CREATE UNIQUE INDEX IF NOT EXISTS payroll_staff_month_uq
  ON institution_payroll_entries(institution_id, staff_id, payroll_month);

CREATE TABLE IF NOT EXISTS institution_timetable_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES institution_classes(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES institution_staff(id),
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 1 AND 6),
  lesson_number INTEGER NOT NULL CHECK (lesson_number BETWEEN 1 AND 12),
  subject TEXT NOT NULL,
  room TEXT,
  academic_year TEXT NOT NULL,
  created_by BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(institution_id, class_id, weekday, lesson_number, academic_year)
);
CREATE INDEX IF NOT EXISTS timetable_staff_slot_idx ON institution_timetable_entries(institution_id, staff_id, weekday, lesson_number);
-- Enforce conflict prevention at database level, including concurrent requests.
CREATE UNIQUE INDEX IF NOT EXISTS timetable_class_slot_uq
  ON institution_timetable_entries(institution_id, class_id, weekday, lesson_number, academic_year);
CREATE UNIQUE INDEX IF NOT EXISTS timetable_staff_slot_uq
  ON institution_timetable_entries(institution_id, staff_id, weekday, lesson_number, academic_year);

CREATE TABLE IF NOT EXISTS institution_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES institution_classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES institution_students(id) ON DELETE CASCADE,
  attendance_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL,
  note TEXT,
  created_by BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(institution_id, student_id, attendance_date)
);
CREATE INDEX IF NOT EXISTS attendance_class_date_idx ON institution_attendance(institution_id, class_id, attendance_date);

CREATE TABLE IF NOT EXISTS institution_form_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  period_key TEXT NOT NULL DEFAULT '',
  academic_year TEXT NOT NULL DEFAULT '2026-2027',
  template_version TEXT NOT NULL DEFAULT '1',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS form_documents_lookup_idx ON institution_form_documents(institution_id, document_type, period_key);

CREATE TABLE IF NOT EXISTS institution_learning_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  subject TEXT,
  grade INTEGER CHECK (grade BETWEEN 1 AND 11),
  material_type TEXT NOT NULL DEFAULT 'lesson',
  resource_url TEXT NOT NULL,
  academic_year TEXT NOT NULL DEFAULT '2026-2027',
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_by BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS materials_institution_idx ON institution_learning_materials(institution_id, is_published);

CREATE TABLE IF NOT EXISTS institution_plan_usage (
  id BIGSERIAL PRIMARY KEY,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  operation_count INTEGER NOT NULL DEFAULT 0,
  last_prompt_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(institution_id, module_key)
);

CREATE TABLE IF NOT EXISTS institution_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL,
  actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_institution_time_idx ON institution_audit_logs(institution_id, created_at DESC);

COMMIT;
