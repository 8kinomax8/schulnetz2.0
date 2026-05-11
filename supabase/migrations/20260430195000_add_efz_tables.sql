-- Migration: Add EFZ / Berufsschule tables (modules, module_grades, uek_grades, ipa)
-- Generated: 2026-04-30

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- EFZ modules (module metadata per user)
CREATE TABLE IF NOT EXISTS public.efz_modules (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  module_code varchar(3) NOT NULL,
  name text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.efz_modules OWNER TO postgres;

-- Grades for modules (controls within a module)
CREATE TABLE IF NOT EXISTS public.efz_module_grades (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  module_id uuid NOT NULL,
  grade numeric NOT NULL,
  weight numeric DEFAULT 1,
  date date,
  control_name text,
  source text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.efz_module_grades OWNER TO postgres;

-- üK grades (one grade per üK entry)
CREATE TABLE IF NOT EXISTS public.efz_uek_grades (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  grade numeric NOT NULL,
  name text,
  date date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.efz_uek_grades OWNER TO postgres;

-- IPA (final project) - one record per user (but keep id to allow versioning)
CREATE TABLE IF NOT EXISTS public.efz_ipa (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  grade numeric NOT NULL,
  is_final boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.efz_ipa OWNER TO postgres;

-- Primary keys
ALTER TABLE ONLY public.efz_modules ADD CONSTRAINT efz_modules_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.efz_module_grades ADD CONSTRAINT efz_module_grades_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.efz_uek_grades ADD CONSTRAINT efz_uek_grades_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.efz_ipa ADD CONSTRAINT efz_ipa_pkey PRIMARY KEY (id);

-- Foreign keys
ALTER TABLE ONLY public.efz_modules
  ADD CONSTRAINT efz_modules_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.efz_module_grades
  ADD CONSTRAINT efz_module_grades_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.efz_modules(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.efz_module_grades
  ADD CONSTRAINT efz_module_grades_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.efz_uek_grades
  ADD CONSTRAINT efz_uek_grades_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.efz_ipa
  ADD CONSTRAINT efz_ipa_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Useful indexes
CREATE INDEX IF NOT EXISTS idx_efz_modules_user_code ON public.efz_modules USING btree (user_id, module_code);
CREATE INDEX IF NOT EXISTS idx_efz_module_grades_user_module ON public.efz_module_grades USING btree (user_id, module_id);
CREATE INDEX IF NOT EXISTS idx_efz_uek_user ON public.efz_uek_grades USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_efz_ipa_user ON public.efz_ipa USING btree (user_id);

-- Triggers to auto-set user_id using existing function handle_user_id
CREATE OR REPLACE TRIGGER set_user_id_efz_modules BEFORE INSERT ON public.efz_modules FOR EACH ROW EXECUTE FUNCTION public.handle_user_id();
CREATE OR REPLACE TRIGGER set_user_id_efz_module_grades BEFORE INSERT ON public.efz_module_grades FOR EACH ROW EXECUTE FUNCTION public.handle_user_id();
CREATE OR REPLACE TRIGGER set_user_id_efz_uek_grades BEFORE INSERT ON public.efz_uek_grades FOR EACH ROW EXECUTE FUNCTION public.handle_user_id();
CREATE OR REPLACE TRIGGER set_user_id_efz_ipa BEFORE INSERT ON public.efz_ipa FOR EACH ROW EXECUTE FUNCTION public.handle_user_id();

-- Enable RLS and create per-user policies (same pattern as existing tables)
ALTER TABLE public.efz_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.efz_module_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.efz_uek_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.efz_ipa ENABLE ROW LEVEL SECURITY;

-- efz_modules policies
CREATE POLICY "efz_modules select own" ON public.efz_modules FOR SELECT USING ((user_id = auth.uid()));
CREATE POLICY "efz_modules insert own" ON public.efz_modules FOR INSERT WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "efz_modules update own" ON public.efz_modules FOR UPDATE USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "efz_modules delete own" ON public.efz_modules FOR DELETE USING ((user_id = auth.uid()));

-- efz_module_grades policies
CREATE POLICY "efz_module_grades select own" ON public.efz_module_grades FOR SELECT USING ((user_id = auth.uid()));
CREATE POLICY "efz_module_grades insert own" ON public.efz_module_grades FOR INSERT WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "efz_module_grades update own" ON public.efz_module_grades FOR UPDATE USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "efz_module_grades delete own" ON public.efz_module_grades FOR DELETE USING ((user_id = auth.uid()));

-- efz_uek_grades policies
CREATE POLICY "efz_uek_grades select own" ON public.efz_uek_grades FOR SELECT USING ((user_id = auth.uid()));
CREATE POLICY "efz_uek_grades insert own" ON public.efz_uek_grades FOR INSERT WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "efz_uek_grades update own" ON public.efz_uek_grades FOR UPDATE USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "efz_uek_grades delete own" ON public.efz_uek_grades FOR DELETE USING ((user_id = auth.uid()));

-- efz_ipa policies
CREATE POLICY "efz_ipa select own" ON public.efz_ipa FOR SELECT USING ((user_id = auth.uid()));
CREATE POLICY "efz_ipa insert own" ON public.efz_ipa FOR INSERT WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "efz_ipa update own" ON public.efz_ipa FOR UPDATE USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "efz_ipa delete own" ON public.efz_ipa FOR DELETE USING ((user_id = auth.uid()));

-- Grant usage on public schema if not already granted (keeps consistent with existing migration)
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Notes: Keep service_role and other server-only keys out of the frontend. RLS policies ensure only the owning user can read/modify their records.
