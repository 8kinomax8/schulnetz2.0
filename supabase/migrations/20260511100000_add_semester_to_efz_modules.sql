-- Migration: Add semester field to EFZ modules
-- Purpose: Track which semester each module was added to

ALTER TABLE public.efz_modules
ADD COLUMN IF NOT EXISTS semester integer DEFAULT 1;

-- Create index for faster filtering by semester
CREATE INDEX IF NOT EXISTS idx_efz_modules_user_semester ON public.efz_modules USING btree (user_id, semester);

-- Update RLS policies if needed (handled in existing policies)
