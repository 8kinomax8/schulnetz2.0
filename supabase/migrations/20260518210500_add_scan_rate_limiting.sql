-- Rate limiting table for API scan endpoint
-- Tracks scan requests per user with timestamps

CREATE TABLE IF NOT EXISTS public.scan_rate_limits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  scan_type text NOT NULL,
  status text DEFAULT 'success'
);

-- Index for efficient rate limit queries
CREATE INDEX idx_scan_rate_limits_user_time 
  ON public.scan_rate_limits(user_id, scanned_at DESC);

-- Row Level Security
ALTER TABLE public.scan_rate_limits ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read their own scan logs
CREATE POLICY "Users can read their own scan logs"
  ON public.scan_rate_limits
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow service role to insert (from API)
CREATE POLICY "Service role can insert scan logs"
  ON public.scan_rate_limits
  FOR INSERT
  WITH CHECK (true);

-- Clean up old logs (older than 24 hours) every hour
CREATE OR REPLACE FUNCTION cleanup_old_scan_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM public.scan_rate_limits
  WHERE scanned_at < now() - interval '24 hours';
END;
$$ LANGUAGE plpgsql;
