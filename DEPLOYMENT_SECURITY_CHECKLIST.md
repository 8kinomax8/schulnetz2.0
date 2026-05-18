# Deployment Security Checklist for Vercel

## ✅ Security Fixes Applied

### 1. Authentication (✅ FIXED)
- [x] Bearer token verification on `/api/scan` endpoint
- [x] Supabase Auth token validation before Claude API calls
- [x] Frontend now sends `Authorization: Bearer <token>` header

**Files changed:**
- `api/scan.js` - Added `verifySupabaseToken()` and auth check
- `src/services/apiService.js` - Now retrieves & sends bearer token

### 2. CORS (✅ FIXED)
- [x] CORS origins whitelist instead of `*`
- [x] Allows: `localhost:5173`, `localhost:3000`, and your Vercel production domain
- [x] Validates origin before setting `Access-Control-Allow-Origin`

**Files changed:**
- `api/scan.js` - Added `ALLOWED_ORIGINS` and `validateCORSOrigin()`

### 3. Input Validation (✅ FIXED)
- [x] Base64 size limit: **5MB max**
- [x] ScanType validation: only `['SAL', 'BULLETIN', 'EFZ_SAL']` accepted
- [x] Data URI format validation
- [x] Returns 413 for oversized uploads, 400 for invalid input

**Files changed:**
- `api/scan.js` - Added `MAX_BASE64_SIZE` and validation checks

---

## Required Vercel Environment Variables

Ensure these are set in your Vercel project settings (not in `vercel.json`):

```
# Supabase (needed at build time for Vite)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...

# Claude API (needed at runtime for /api/scan)
ANTHROPIC_API_KEY=sk-ant-...

# Optional: Additional allowed origins (comma-separated)
ALLOWED_ORIGINS=https://your-custom-domain.com
```

**Status:** ✅ You've already added these via Vercel GUI

---

## Deployment Verification Steps

After pushing to production:

1. **Test authentication required:**
   ```bash
   curl -X POST https://your-app.vercel.app/api/scan \
     -H "Content-Type: application/json" \
     -d '{"image": "data:image/png;base64,fake", "scanType": "SAL"}'
   # Should return: 401 Unauthorized
   ```

2. **Test CORS rejection:**
   - Open DevTools on any site (not your Vercel domain)
   - Try calling your scan endpoint
   - Should be blocked by CORS policy

3. **Test with valid auth:**
   - Log into your app at `https://your-app.vercel.app`
   - Try uploading a document
   - Should work with proper token

---

## Build Success

```
✓ 1750 modules transformed
✓ built in 1.54s
```

Bundle size warning is normal (recharts library is large). Not a security issue.

---

## Notes

- **Local dev:** Both `localhost:5173` and `localhost:3000` work without auth (for testing)
- **Production:** All requests require valid Supabase JWT token
- **Rate limiting:** Not yet implemented (consider for Phase 2 if API abuse detected)
- **Monitoring:** Add error tracking via Sentry or Vercel Logs for production monitoring
