-- Add tour_completed column to user_preferences
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS tour_completed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_preferences.tour_completed IS 'Tracks whether the user has completed the interactive tutorial tour';
