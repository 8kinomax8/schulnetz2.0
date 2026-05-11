-- Migration: Optimize DB schema following Supabase best practices
-- Date: 2026-04-30
-- Goals:
--   1. Create ENUM types for data consistency
--   2. Fix numeric precision (grades should be 3,2)
--   3. Add proper constraints and indexes
--   4. Normalize EFZ and BM structure

-- Create ENUM type for source tracking (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'source_type' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.source_type AS ENUM ('manual', 'simulated', 'import', 'computed');
  END IF;
END $$;

-- ============================================================================
-- OPTIMIZE BM GRADES TABLE
-- ============================================================================

-- Step 1: Drop old constraints that we'll recreate
ALTER TABLE IF EXISTS public.semester_grades DROP CONSTRAINT IF EXISTS semester_grades_subject_id_fkey;
ALTER TABLE IF EXISTS public.semester_grades DROP CONSTRAINT IF EXISTS semester_grades_user_id_fkey;
DROP TRIGGER IF EXISTS set_user_id_semester_grades ON public.semester_grades;
DROP TABLE IF EXISTS public.semester_grades;

-- Step 2: Fix grades table data types and add constraints
ALTER TABLE public.grades DROP CONSTRAINT IF EXISTS grades_pkey CASCADE;
ALTER TABLE public.grades DROP CONSTRAINT IF EXISTS grades_user_id_subject_id_date_control_name_key;
ALTER TABLE public.grades DROP CONSTRAINT IF EXISTS grades_user_id_fkey CASCADE;
ALTER TABLE public.grades DROP CONSTRAINT IF EXISTS grades_subject_id_fkey;

-- Migrate numeric types to proper precision
ALTER TABLE public.grades
  ALTER COLUMN grade SET DATA TYPE numeric(3,2),
  ALTER COLUMN weight SET DATA TYPE numeric(5,2);

-- Migrate source to ENUM (backfill unknowns to 'manual')
UPDATE public.grades 
SET source = 'manual' 
WHERE source IS NULL OR source NOT IN ('manual', 'simulated', 'import', 'computed');

ALTER TABLE public.grades
  ALTER COLUMN source SET DATA TYPE public.source_type USING source::public.source_type;

-- Re-add constraints
ALTER TABLE ONLY public.grades
  ADD CONSTRAINT grades_pkey PRIMARY KEY (id);

-- Partial unique index to avoid duplicate controls when date/control_name is provided
CREATE UNIQUE INDEX IF NOT EXISTS idx_grades_user_subject_date_control_unique
  ON public.grades (user_id, subject_id, date, control_name)
  WHERE date IS NOT NULL AND control_name IS NOT NULL;

ALTER TABLE ONLY public.grades
  ADD CONSTRAINT grades_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.grades
  ADD CONSTRAINT grades_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;

-- Step 3: Optimize indexes
DROP INDEX IF EXISTS public.grades_user_subject_sem_idx;
CREATE INDEX idx_grades_user_subject ON public.grades USING btree (user_id, subject_id);
CREATE INDEX idx_grades_user_date ON public.grades USING btree (user_id, date DESC);
CREATE INDEX idx_grades_source ON public.grades USING btree (source);

-- ============================================================================
-- OPTIMIZE EFZ TABLES
-- ============================================================================

-- Step 1: Drop old foreign keys
ALTER TABLE public.efz_module_grades DROP CONSTRAINT IF EXISTS efz_module_grades_module_id_fkey;
ALTER TABLE public.efz_module_grades DROP CONSTRAINT IF EXISTS efz_module_grades_user_id_fkey;
ALTER TABLE public.efz_uek_grades DROP CONSTRAINT IF EXISTS efz_uek_grades_user_id_fkey;
ALTER TABLE public.efz_ipa DROP CONSTRAINT IF EXISTS efz_ipa_user_id_fkey;

-- Step 2: Fix numeric precision in EFZ module_grades
ALTER TABLE public.efz_module_grades
  ALTER COLUMN grade SET DATA TYPE numeric(3,2),
  ALTER COLUMN weight SET DATA TYPE numeric(5,2);

-- Migrate source to ENUM (backfill)
UPDATE public.efz_module_grades 
SET source = 'manual' 
WHERE source IS NULL OR source NOT IN ('manual', 'simulated', 'import', 'computed');

ALTER TABLE public.efz_module_grades
  ALTER COLUMN source SET DATA TYPE public.source_type USING source::public.source_type;

-- Step 3: Fix numeric precision in üK grades
ALTER TABLE public.efz_uek_grades
  ALTER COLUMN grade SET DATA TYPE numeric(3,2);

-- Step 4: Fix numeric precision in IPA
ALTER TABLE public.efz_ipa
  ALTER COLUMN grade SET DATA TYPE numeric(3,2);

-- Step 5: Re-add foreign keys
ALTER TABLE ONLY public.efz_module_grades
  ADD CONSTRAINT efz_module_grades_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.efz_module_grades
  ADD CONSTRAINT efz_module_grades_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.efz_modules(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.efz_uek_grades
  ADD CONSTRAINT efz_uek_grades_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.efz_ipa
  ADD CONSTRAINT efz_ipa_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 6: Add constraint for unique final IPA per user
-- Ensure only one final IPA grade per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_efz_ipa_user_final_unique
  ON public.efz_ipa (user_id)
  WHERE is_final = true;

-- Step 7: Optimize EFZ indexes
DROP INDEX IF EXISTS public.idx_efz_modules_user_code;
DROP INDEX IF EXISTS public.idx_efz_module_grades_user_module;
DROP INDEX IF EXISTS public.idx_efz_uek_user;
DROP INDEX IF EXISTS public.idx_efz_ipa_user;

CREATE INDEX idx_efz_modules_user_code ON public.efz_modules USING btree (user_id, module_code);
CREATE INDEX idx_efz_module_grades_user_module ON public.efz_module_grades USING btree (user_id, module_id);
CREATE INDEX idx_efz_module_grades_date ON public.efz_module_grades USING btree (date DESC);
CREATE INDEX idx_efz_module_grades_source ON public.efz_module_grades USING btree (source);
CREATE INDEX idx_efz_uek_user_date ON public.efz_uek_grades USING btree (user_id, date DESC);
CREATE INDEX idx_efz_ipa_user_final ON public.efz_ipa USING btree (user_id, is_final);

-- ============================================================================
-- ENSURE RLS AND PERMISSIONS
-- ============================================================================

ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.efz_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.efz_module_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.efz_uek_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.efz_ipa ENABLE ROW LEVEL SECURITY;

-- Grant enum usage to authenticated users
GRANT USAGE ON TYPE public.source_type TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- ============================================================================
-- DATABASE DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.grades IS 'BM individual control grades. Linked to subjects via subject_id, semester computed from date.';
COMMENT ON COLUMN public.grades.grade IS 'Swiss grade scale: 1.0 (fail) to 6.0 (excellent), stored as numeric(3,2).';
COMMENT ON COLUMN public.grades.weight IS 'Multiplier for weighted average calculation (default 1.0).';
COMMENT ON COLUMN public.grades.source IS 'Data source: manual entry, simulation, import, or computed.';

COMMENT ON TABLE public.efz_modules IS 'EFZ apprenticeship modules (e.g., IM1, IM2, IM3, IM4).';
COMMENT ON TABLE public.efz_module_grades IS 'Individual control grades for each module.';
COMMENT ON TABLE public.efz_uek_grades IS 'Überbetriebliche Kurse (inter-company courses) grades.';
COMMENT ON TABLE public.efz_ipa IS 'Individuelle praktische Arbeit (final apprenticeship project) grade.';

COMMENT ON TYPE public.source_type IS 'Source type for grades: manual, simulated, import, or computed.';
