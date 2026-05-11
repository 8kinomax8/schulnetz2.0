-- Fix persistence tables and Data API access for authenticated app users.

CREATE TABLE IF NOT EXISTS public.semester_grades (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  semester_number integer NOT NULL,
  grade numeric(3,2) NOT NULL CHECK (grade BETWEEN 1.00 AND 6.00),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.semester_plans (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  semester_number integer NOT NULL,
  planned_grade numeric(3,2) NOT NULL CHECK (planned_grade BETWEEN 1.00 AND 6.00),
  weight numeric(5,2) NOT NULL DEFAULT 1,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subject_goals (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  target_grade numeric(3,2) NOT NULL CHECK (target_grade BETWEEN 1.00 AND 6.00),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.exam_simulator (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  simulated_grade numeric(3,2) CHECK (simulated_grade BETWEEN 1.00 AND 6.00),
  final_grade numeric(3,2) CHECK (final_grade BETWEEN 1.00 AND 6.00),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.efz_modules
  ALTER COLUMN module_code TYPE varchar(16);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'semester_grades_pkey'
      AND conrelid = 'public.semester_grades'::regclass
  ) THEN
    ALTER TABLE public.semester_grades ADD CONSTRAINT semester_grades_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'semester_plans_pkey'
      AND conrelid = 'public.semester_plans'::regclass
  ) THEN
    ALTER TABLE public.semester_plans ADD CONSTRAINT semester_plans_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'subject_goals_pkey'
      AND conrelid = 'public.subject_goals'::regclass
  ) THEN
    ALTER TABLE public.subject_goals ADD CONSTRAINT subject_goals_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'exam_simulator_pkey'
      AND conrelid = 'public.exam_simulator'::regclass
  ) THEN
    ALTER TABLE public.exam_simulator ADD CONSTRAINT exam_simulator_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'semester_grades_user_id_fkey'
      AND conrelid = 'public.semester_grades'::regclass
  ) THEN
    ALTER TABLE public.semester_grades
      ADD CONSTRAINT semester_grades_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'semester_grades_subject_id_fkey'
      AND conrelid = 'public.semester_grades'::regclass
  ) THEN
    ALTER TABLE public.semester_grades
      ADD CONSTRAINT semester_grades_subject_id_fkey
      FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'semester_grades_user_id_subject_id_semester_number_key'
      AND conrelid = 'public.semester_grades'::regclass
  ) THEN
    ALTER TABLE public.semester_grades
      ADD CONSTRAINT semester_grades_user_id_subject_id_semester_number_key UNIQUE (user_id, subject_id, semester_number);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'semester_plans_user_id_fkey'
      AND conrelid = 'public.semester_plans'::regclass
  ) THEN
    ALTER TABLE public.semester_plans
      ADD CONSTRAINT semester_plans_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'semester_plans_subject_id_fkey'
      AND conrelid = 'public.semester_plans'::regclass
  ) THEN
    ALTER TABLE public.semester_plans
      ADD CONSTRAINT semester_plans_subject_id_fkey
      FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'subject_goals_user_id_fkey'
      AND conrelid = 'public.subject_goals'::regclass
  ) THEN
    ALTER TABLE public.subject_goals
      ADD CONSTRAINT subject_goals_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'subject_goals_subject_id_fkey'
      AND conrelid = 'public.subject_goals'::regclass
  ) THEN
    ALTER TABLE public.subject_goals
      ADD CONSTRAINT subject_goals_subject_id_fkey
      FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'subject_goals_user_id_subject_id_key'
      AND conrelid = 'public.subject_goals'::regclass
  ) THEN
    ALTER TABLE public.subject_goals
      ADD CONSTRAINT subject_goals_user_id_subject_id_key UNIQUE (user_id, subject_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'exam_simulator_user_id_fkey'
      AND conrelid = 'public.exam_simulator'::regclass
  ) THEN
    ALTER TABLE public.exam_simulator
      ADD CONSTRAINT exam_simulator_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'exam_simulator_subject_id_fkey'
      AND conrelid = 'public.exam_simulator'::regclass
  ) THEN
    ALTER TABLE public.exam_simulator
      ADD CONSTRAINT exam_simulator_subject_id_fkey
      FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'exam_simulator_user_id_subject_id_key'
      AND conrelid = 'public.exam_simulator'::regclass
  ) THEN
    ALTER TABLE public.exam_simulator
      ADD CONSTRAINT exam_simulator_user_id_subject_id_key UNIQUE (user_id, subject_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'efz_modules_user_id_module_code_key'
      AND conrelid = 'public.efz_modules'::regclass
  ) THEN
    ALTER TABLE public.efz_modules
      ADD CONSTRAINT efz_modules_user_id_module_code_key UNIQUE (user_id, module_code);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_semester_grades_user_subject
  ON public.semester_grades USING btree (user_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_semester_plans_user_subject
  ON public.semester_plans USING btree (user_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_subject_goals_user_subject
  ON public.subject_goals USING btree (user_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_exam_simulator_user_subject
  ON public.exam_simulator USING btree (user_id, subject_id);

DROP TRIGGER IF EXISTS set_user_id_semester_plans ON public.semester_plans;
CREATE TRIGGER set_user_id_semester_plans
BEFORE INSERT ON public.semester_plans
FOR EACH ROW
EXECUTE FUNCTION public.handle_user_id();

DROP TRIGGER IF EXISTS set_user_id_subject_goals ON public.subject_goals;
CREATE TRIGGER set_user_id_subject_goals
BEFORE INSERT ON public.subject_goals
FOR EACH ROW
EXECUTE FUNCTION public.handle_user_id();

DROP TRIGGER IF EXISTS set_user_id_exam_simulator ON public.exam_simulator;
CREATE TRIGGER set_user_id_exam_simulator
BEFORE INSERT ON public.exam_simulator
FOR EACH ROW
EXECUTE FUNCTION public.handle_user_id();

DROP TRIGGER IF EXISTS set_user_id_semester_grades ON public.semester_grades;
CREATE TRIGGER set_user_id_semester_grades
BEFORE INSERT ON public.semester_grades
FOR EACH ROW
EXECUTE FUNCTION public.handle_user_id();

ALTER TABLE public.semester_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semester_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_simulator ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "semester_grades select own" ON public.semester_grades;
DROP POLICY IF EXISTS "semester_grades insert own" ON public.semester_grades;
DROP POLICY IF EXISTS "semester_grades update own" ON public.semester_grades;
DROP POLICY IF EXISTS "semester_grades delete own" ON public.semester_grades;
DROP POLICY IF EXISTS "semester_plans select own" ON public.semester_plans;
DROP POLICY IF EXISTS "semester_plans insert own" ON public.semester_plans;
DROP POLICY IF EXISTS "semester_plans update own" ON public.semester_plans;
DROP POLICY IF EXISTS "semester_plans delete own" ON public.semester_plans;
DROP POLICY IF EXISTS "subject_goals select own" ON public.subject_goals;
DROP POLICY IF EXISTS "subject_goals insert own" ON public.subject_goals;
DROP POLICY IF EXISTS "subject_goals update own" ON public.subject_goals;
DROP POLICY IF EXISTS "subject_goals delete own" ON public.subject_goals;
DROP POLICY IF EXISTS "exam_simulator select own" ON public.exam_simulator;
DROP POLICY IF EXISTS "exam_simulator insert own" ON public.exam_simulator;
DROP POLICY IF EXISTS "exam_simulator update own" ON public.exam_simulator;
DROP POLICY IF EXISTS "exam_simulator delete own" ON public.exam_simulator;

CREATE POLICY "semester_grades select own" ON public.semester_grades FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "semester_grades insert own" ON public.semester_grades FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "semester_grades update own" ON public.semester_grades FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "semester_grades delete own" ON public.semester_grades FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "semester_plans select own" ON public.semester_plans FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "semester_plans insert own" ON public.semester_plans FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "semester_plans update own" ON public.semester_plans FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "semester_plans delete own" ON public.semester_plans FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "subject_goals select own" ON public.subject_goals FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "subject_goals insert own" ON public.subject_goals FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "subject_goals update own" ON public.subject_goals FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "subject_goals delete own" ON public.subject_goals FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "exam_simulator select own" ON public.exam_simulator FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "exam_simulator insert own" ON public.exam_simulator FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "exam_simulator update own" ON public.exam_simulator FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "exam_simulator delete own" ON public.exam_simulator FOR DELETE USING (user_id = auth.uid());

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.subjects,
  public.grades,
  public.semester_grades,
  public.user_preferences,
  public.semester_plans,
  public.subject_goals,
  public.exam_simulator,
  public.efz_modules,
  public.efz_module_grades,
  public.efz_uek_grades,
  public.efz_ipa
TO authenticated;
