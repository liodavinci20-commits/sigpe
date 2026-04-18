-- ============================================================
-- SIGPE — SCHÉMA COMPLET v2.0
-- ENS Yaoundé | Sans RLS | Sans confirmation email
-- ============================================================

-- 1. PROFILES
CREATE TABLE profiles (
  id                   UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role                 TEXT NOT NULL CHECK (role IN (
                         'admin','sub_admin','teacher_course',
                         'teacher_head','counselor','parent','student')),
  full_name            TEXT NOT NULL,
  avatar_url           TEXT,
  phone                TEXT,
  managed_scope        TEXT,
  onboarding_completed BOOLEAN DEFAULT false,
  created_at           TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at           TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. ACADEMIC_YEARS
CREATE TABLE academic_years (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  label       TEXT NOT NULL UNIQUE,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  is_current  BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX only_one_current_year
  ON academic_years (is_current) WHERE is_current = true;

-- 3. CLASSES
CREATE TABLE classes (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name             TEXT NOT NULL,
  level            TEXT NOT NULL,
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE NOT NULL,
  head_teacher_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  capacity         INTEGER DEFAULT 40,
  created_at       TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (name, academic_year_id)
);

-- 4. SUBJECTS
CREATE TABLE subjects (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name                TEXT NOT NULL UNIQUE,
  code                TEXT UNIQUE,
  default_coefficient INTEGER DEFAULT 1,
  category            TEXT
);

-- 5. CLASS_SUBJECTS
CREATE TABLE class_subjects (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id         UUID REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  subject_id       UUID REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
  teacher_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  coefficient      INTEGER DEFAULT 1,
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE NOT NULL,
  UNIQUE (class_id, subject_id, academic_year_id)
);

-- 6. STUDENTS
CREATE TABLE students (
  id               UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  matricule        TEXT UNIQUE NOT NULL,
  class_id         UUID REFERENCES classes(id) ON DELETE SET NULL,
  date_of_birth    DATE,
  gender           TEXT CHECK (gender IN ('M', 'F')),
  blood_type       TEXT,
  city             TEXT,
  parent_phone     TEXT,
  guardian_type    TEXT CHECK (guardian_type IN ('père','mère','tuteur','autre')),
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 7. STUDENT_PARENTS
CREATE TABLE student_parents (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id   UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  parent_id    UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  relationship TEXT NOT NULL CHECK (relationship IN ('père','mère','tuteur','autre')),
  is_primary   BOOLEAN DEFAULT false,
  UNIQUE (student_id, parent_id)
);

-- 8. SEQUENCES
CREATE TABLE sequences (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE NOT NULL,
  label            TEXT NOT NULL,
  number           INTEGER NOT NULL CHECK (number BETWEEN 1 AND 6),
  trimester        INTEGER NOT NULL CHECK (trimester IN (1, 2, 3)),
  start_date       DATE,
  end_date         DATE,
  is_active        BOOLEAN DEFAULT false,
  UNIQUE (academic_year_id, number)
);

-- 9. GRADES
CREATE TABLE grades (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id           UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  class_subject_id     UUID REFERENCES class_subjects(id) ON DELETE CASCADE NOT NULL,
  teacher_id           UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sequence_id          UUID REFERENCES sequences(id) ON DELETE CASCADE NOT NULL,
  evaluation_type      TEXT NOT NULL DEFAULT 'devoir1'
                         CHECK (evaluation_type IN ('devoir1','devoir2','composition')),
  note                 NUMERIC(4, 2) NOT NULL CHECK (note >= 0 AND note <= 20),
  coefficient_override INTEGER,
  comment              TEXT,
  created_at           TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at           TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (student_id, class_subject_id, sequence_id, evaluation_type)
);

-- 10. ATTENDANCE
CREATE TABLE attendance (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id    UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  class_id      UUID REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  date          DATE NOT NULL,
  period        TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('present','absent','late','excused')),
  recorded_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  justification TEXT,
  created_at    TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (student_id, date, period)
);

-- 11. SCHEDULE_SLOTS
CREATE TABLE schedule_slots (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  class_subject_id UUID REFERENCES class_subjects(id) ON DELETE CASCADE NOT NULL,
  day_of_week      INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 6),
  start_time       TIME NOT NULL,
  end_time         TIME NOT NULL,
  room             TEXT,
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE NOT NULL,
  CHECK (end_time > start_time)
);

-- 12. BULLETINS
CREATE TABLE bulletins (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id      UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  sequence_id     UUID REFERENCES sequences(id) ON DELETE CASCADE NOT NULL,
  generated_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  generated_at    TIMESTAMPTZ DEFAULT now(),
  status          TEXT DEFAULT 'draft' CHECK (status IN ('draft','final')),
  general_average NUMERIC(4, 2),
  rank            INTEGER,
  class_size      INTEGER,
  appreciation    TEXT,
  pdf_url         TEXT,
  UNIQUE (student_id, sequence_id)
);

-- 13. BULLETIN_LINES
CREATE TABLE bulletin_lines (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bulletin_id     UUID REFERENCES bulletins(id) ON DELETE CASCADE NOT NULL,
  subject_id      UUID REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
  note            NUMERIC(4, 2) NOT NULL,
  coefficient     INTEGER NOT NULL DEFAULT 1,
  rank_in_subject INTEGER,
  appreciation    TEXT
);

-- 14. NOTIFICATIONS
CREATE TABLE notifications (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  recipient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  target_group TEXT,
  title        TEXT NOT NULL,
  content      TEXT NOT NULL,
  type         TEXT DEFAULT 'info' CHECK (type IN ('info','warning','urgent')),
  is_read      BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 15. MESSAGES
CREATE TABLE messages (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id    UUID REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  recipient_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content      TEXT NOT NULL,
  is_read      BOOLEAN DEFAULT false,
  thread_id    UUID,
  created_at   TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================================
-- TRIGGER AUTO-CRÉATION PROFIL + ÉTUDIANT
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT := new.raw_user_meta_data->>'role';
  v_name TEXT := COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  v_year UUID;
BEGIN
  INSERT INTO public.profiles (id, role, full_name)
  VALUES (new.id, v_role, v_name);

  IF v_role = 'student' THEN
    SELECT id INTO v_year FROM public.academic_years WHERE is_current = true LIMIT 1;
    INSERT INTO public.students (id, matricule, academic_year_id)
    VALUES (
      new.id,
      'MAT-' || to_char(now(), 'YYYY') || '-' || upper(substring(new.id::text, 1, 6)),
      v_year
    );
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================
-- DONNÉES DE BASE (Année scolaire 2024-2025)
-- ============================================================
INSERT INTO academic_years (label, start_date, end_date, is_current)
VALUES ('2024-2025', '2024-09-01', '2025-07-31', true);

INSERT INTO sequences (academic_year_id, label, number, trimester)
SELECT id, 'Séquence 1', 1, 1 FROM academic_years WHERE label = '2024-2025'
UNION ALL
SELECT id, 'Séquence 2', 2, 1 FROM academic_years WHERE label = '2024-2025'
UNION ALL
SELECT id, 'Séquence 3', 3, 2 FROM academic_years WHERE label = '2024-2025'
UNION ALL
SELECT id, 'Séquence 4', 4, 2 FROM academic_years WHERE label = '2024-2025'
UNION ALL
SELECT id, 'Séquence 5', 5, 3 FROM academic_years WHERE label = '2024-2025'
UNION ALL
SELECT id, 'Séquence 6', 6, 3 FROM academic_years WHERE label = '2024-2025';
