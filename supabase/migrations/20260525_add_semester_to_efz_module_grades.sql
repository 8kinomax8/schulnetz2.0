-- Migration: Add semester field to EFZ module grades
-- Purpose: Track which semester each grade/control belongs to
-- This allows filtering grades by semester (current vs. previous)

ALTER TABLE public.efz_module_grades
ADD COLUMN IF NOT EXISTS semester integer DEFAULT 1;

-- Create index for faster filtering by semester
CREATE INDEX IF NOT EXISTS idx_efz_module_grades_user_semester ON public.efz_module_grades USING btree (user_id, semester);
