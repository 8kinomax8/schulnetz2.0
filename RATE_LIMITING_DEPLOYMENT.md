# Rate Limiting Deployment Guide

## Overview
Implemented rate limiting for the `/api/scan` endpoint with per-user limits:
- **3 scans per 15 minutes**
- **6 scans per 24 hours**

## What's Included

### Backend Changes
1. **Migration file**: `supabase/migrations/20260518_add_scan_rate_limiting.sql`
   - Creates `scan_rate_limits` table for logging scans
   - Adds indexes for query performance
   - Sets up Row Level Security (RLS) policies
   - Includes cleanup function for logs older than 24 hours

2. **API Endpoint**: `api/scan.js`
   - Checks rate limits before processing scan requests
   - Returns 429 (Too Many Requests) when limits exceeded
   - Includes `Retry-After` header with seconds to wait
   - Logs all scans to database for tracking

### Frontend Changes
1. **Service**: `src/services/apiService.js`
   - Captures rate limit headers from API responses
   - Exposes rate limit state via `getRateLimitState()`
   - Handles 429 errors with retry information

2. **Hook**: `src/hooks/useRateLimit.js` (NEW)
   - `useRateLimit()` - Main hook for rate limit state management
   - `RateLimitBadge` - UI component showing current usage (15m & 24h windows)
   - `RateLimitError` - UI component showing error with retry countdown

3. **Updated**: `src/hooks/index.js`
   - Exports new rate limit hook and components

## Deployment Steps

### 1. Apply Database Migration
Run this SQL in your Supabase dashboard (SQL Editor):

```sql
-- Rate limiting table for API scan endpoint
CREATE TABLE IF NOT EXISTS public.scan_rate_limits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  scan_type text NOT NULL,
  status text DEFAULT 'success'
);

-- Index for efficient rate limit queries
CREATE INDEX IF NOT EXISTS idx_scan_rate_limits_user_time 
  ON public.scan_rate_limits(user_id, scanned_at DESC);

-- Row Level Security
ALTER TABLE public.scan_rate_limits ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read their own scan logs
CREATE POLICY "Users can read their own scan logs"
  ON public.scan_rate_limits
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow service role to insert scan logs
CREATE POLICY "Service role can insert scan logs"
  ON public.scan_rate_limits
  FOR INSERT
  WITH CHECK (true);
```

### 2. Deploy Frontend and API
- Commit all changes to git
- Push to your repository
- Vercel will automatically deploy the updated `api/scan.js` and frontend changes

### 3. Test Rate Limiting

#### Option A: Manual Testing
```bash
# Get your session token (from browser console after login)
TOKEN="your_jwt_token_here"

# Make 4 scans quickly (4th should fail)
for i in {1..4}; do
  curl -X POST https://your-app.vercel.app/api/scan \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"image": "data:image/png;base64,iVBORw0...", "scanType": "SAL"}'
  echo "Request $i completed"
  sleep 1
done
```

Expected: 4th request returns 429 status with rate limit error.

#### Option B: UI Testing
1. Log into your application
2. Upload/scan documents until you see the rate limit message
3. Check that retry countdown is displayed
4. Verify you can scan again after retry time has passed

### 4. Monitor Rate Limiting

Check user scan logs in Supabase:
```sql
-- View all scans by a user
SELECT * FROM public.scan_rate_limits 
WHERE user_id = 'user-uuid' 
ORDER BY scanned_at DESC;

-- Count scans in last 15 minutes
SELECT COUNT(*) FROM public.scan_rate_limits 
WHERE user_id = 'user-uuid' 
AND scanned_at > now() - interval '15 minutes';
```

## API Response Examples

### Success Response (with rate limit headers)
```
HTTP 200 OK
X-RateLimit-Limit-15m: 3
X-RateLimit-Limit-24h: 6
X-RateLimit-Remaining-15m: 2
X-RateLimit-Remaining-24h: 5

{
  "content": [...],
  "usage": {...}
}
```

### Rate Limit Exceeded Response
```
HTTP 429 Too Many Requests
X-RateLimit-Limit-15m: 3
X-RateLimit-Limit-24h: 6
X-RateLimit-Remaining-15m: 0
X-RateLimit-Remaining-24h: 1
Retry-After: 300

{
  "error": "Rate limit exceeded: 3 scans per 15 minutes",
  "retryAfter": 300,
  "limit15m": 3,
  "limit24h": 6
}
```

## Error Handling in Components

```jsx
import { useRateLimit, RateLimitError, RateLimitBadge } from '../hooks';

export function ScanForm() {
  const { error, handleRateLimitError, clearError, rateLimitState } = useRateLimit();
  
  const handleScan = async () => {
    try {
      const result = await analyzeBulletin(file);
      // process result...
    } catch (err) {
      handleRateLimitError(err);
    }
  };

  return (
    <div>
      <RateLimitBadge rateLimitState={rateLimitState} />
      <RateLimitError error={error} onDismiss={clearError} />
      <button onClick={handleScan}>Scan Document</button>
    </div>
  );
}
```

## Features

### Rate Limit Badge
Shows current usage in 15-minute and 24-hour windows:
- Displays as a compact badge or full card
- Updates in real-time
- Shows remaining scans out of total limit

### Rate Limit Error
Displays when rate limit is exceeded:
- Shows error message
- Displays retry time
- Auto-dismisses after retry window expires
- Shows remaining scans in both windows

### Database Logging
All scans are logged with:
- User ID
- Timestamp
- Scan type (SAL, BULLETIN, EFZ_SAL)
- Status (success, error, etc.)

### Auto-Cleanup
Old scan logs (>24 hours) are automatically deleted to maintain database performance.

## Verification Checklist

- [ ] Migration applied successfully in Supabase
- [ ] Files deployed to Vercel
- [ ] Authentication still works
- [ ] Rate limit headers returned in API responses
- [ ] 429 error returned after 3 scans in 15 minutes
- [ ] Retry-After header contains correct seconds
- [ ] UI components display rate limit information
- [ ] Rate limit errors show proper message and retry time
- [ ] Database contains scan logs

## Troubleshooting

### Issue: Migration fails to apply
- Check Supabase connection status
- Verify you have proper permissions in the project
- Run SQL manually in Supabase dashboard

### Issue: Rate limit not working
- Check that `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are set in Vercel
- Verify `scan_rate_limits` table exists in Supabase
- Check browser console for API errors

### Issue: Headers not showing
- Clear browser cache
- Check network tab in DevTools for response headers
- Verify API response includes headers

## Next Steps (Optional Enhancements)

1. **Configurable limits** - Make 3/15m and 6/24h configurable per environment
2. **Whitelist exceptions** - Exempt certain users or API keys from rate limiting
3. **Tiered limits** - Different limits for different user types (free/premium)
4. **Metrics dashboard** - Track usage patterns across all users
5. **Gradual backoff** - Increase delays as users approach limits
6. **Rate limit notifications** - Email users when approaching daily limit

## Support
For issues or questions about the rate limiting implementation, check:
- API logs in Vercel dashboard
- Supabase database logs
- Browser console for client-side errors
