-- Add persistent user preferences and support both simulated and final BM exam grades

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;

CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id uuid PRIMARY KEY,
  current_semester smallint NOT NULL DEFAULT 1 CHECK (current_semester BETWEEN 1 AND 8),
  bm_type text NOT NULL DEFAULT 'TAL' CHECK (bm_type IN ('TAL', 'DL')),
  maturanote_goal numeric(2,1) NOT NULL DEFAULT 5.0 CHECK (maturanote_goal BETWEEN 1.0 AND 6.0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE public.user_preferences OWNER TO postgres;

DROP TRIGGER IF EXISTS set_user_id_user_preferences ON public.user_preferences;
CREATE TRIGGER set_user_id_user_preferences
BEFORE INSERT ON public.user_preferences
FOR EACH ROW
EXECUTE FUNCTION public.handle_user_id();

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_preferences select own" ON public.user_preferences;
DROP POLICY IF EXISTS "user_preferences insert own" ON public.user_preferences;
DROP POLICY IF EXISTS "user_preferences update own" ON public.user_preferences;
DROP POLICY IF EXISTS "user_preferences delete own" ON public.user_preferences;

CREATE POLICY "user_preferences select own"
  ON public.user_preferences
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "user_preferences insert own"
  ON public.user_preferences
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_preferences update own"
  ON public.user_preferences
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_preferences delete own"
  ON public.user_preferences
  FOR DELETE
  USING (user_id = auth.uid());

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'exam_simulator'
  ) THEN
    EXECUTE 'ALTER TABLE public.exam_simulator ADD COLUMN IF NOT EXISTS final_grade numeric(3,2) CHECK (final_grade BETWEEN 1.00 AND 6.00)';
    EXECUTE 'COMMENT ON COLUMN public.exam_simulator.simulated_grade IS ''Simulated BM exam grade used for planning.''';
    EXECUTE 'COMMENT ON COLUMN public.exam_simulator.final_grade IS ''Definitive BM exam grade entered after the final result is known.''';
  END IF;
END $$;

COMMENT ON TABLE public.user_preferences IS 'Persistent per-user settings for BM semester, BM type, and goal grade.';