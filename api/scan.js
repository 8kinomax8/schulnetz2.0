/**
 * Vercel Function: /api/scan
 * Serverless handler for document scanning via Claude API
 * Handles: SAL screenshots, bulletin PDFs, EFZ module scans
 */

import { createClient } from '@supabase/supabase-js';

// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================

const MAX_BASE64_SIZE = 5 * 1024 * 1024; // 5MB limit
const VALID_SCAN_TYPES = ['SAL', 'BULLETIN', 'EFZ_SAL', 'EFZ_BULLETIN'];

// Whitelist allowed origins
const ALLOWED_ORIGINS = [
  'http://localhost:5173',  // Local development
  'http://localhost:3000',  // Alt local dev
  ...(process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`]
    : []),
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [])
].filter(Boolean);

// Initialize Supabase client for auth verification
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// ============================================================================
// PROMPTS - Claude instructions
// ============================================================================

const BULLETIN_PROMPT = `You are analyzing a Swiss school report (Berufsmaturität). Extract all semester grades.

OUTPUT FORMAT (ONLY valid JSON, no text before or after):
{
  "semesters": [
    {"semester": 1, "grades": {"Deutsch": 4.5, "Mathematik": 5.0}},
    {"semester": 2, "grades": {"Deutsch": 4.0}}
  ]
}

RULES:
- Use ONLY these subject names: Deutsch, Englisch, Französisch, Mathematik, Naturwissenschaften, Finanz- und Rechnungswesen, Wirtschaft und Recht, Geschichte und Politik, Interdisziplinäres Arbeiten in den Fächern
- grades are numeric (4.5, 5.0, etc)
- If no data found: {"error": "no grades found"}
`;

const SAL_PROMPT = `You are analyzing a SAL screenshot (list of assessments/Lernkontroller). Extract EVERY assessment you can see.

OUTPUT FORMAT (ONLY valid JSON, no text before or after):
{
  "controls": [
    {"subject": "Deutsch", "date": "2025-01-15", "name": "Test", "grade": 4.5},
    {"subject": "Mathematik", "date": "2025-01-10", "name": "Quiz", "grade": 5.0}
  ]
}

RULES:
- EXTRACT EVERY row/line you see (don't filter)
- subject: deduce from column header or name. Use canonical names: Deutsch, Englisch, Französisch, Mathematik, Naturwissenschaften, Finanz- und Rechnungswesen, Wirtschaft und Recht, Geschichte und Politik, Interdisziplinäres Arbeiten in den Fächern
- date: extract as YYYY-MM-DD (or DD.MM.YYYY if YYYY-MM-DD not possible)
- grade: numeric value (6.0, 5.5, 4.0, etc)
- If no data: {"error": "no assessments found"}
`;

const EFZ_SAL_PROMPT = `You are analyzing a SAL screenshot from Swiss apprenticeship training (Berufsschule continuous assessment system). Extract EVERY graded entry visible.

The SAL typically shows a LIST or TABLE of:
- Module code (M###) or üK entry
- Assessment name/title
- Date of assessment
- Numeric grade
- Sometimes weight/importance

OUTPUT FORMAT (ONLY valid JSON, no text before or after):
{
  "controls": [
    {"subject": "M152", "moduleName": "Multimedia-Inhalte in Webauftritt integrieren", "date": "2025-01-15", "name": "Kontrolle 1", "grade": 5.5, "weight": 1},
    {"subject": "M117", "moduleName": "Webseiten mit XHTML strukturieren", "date": "2025-01-10", "name": "Test", "grade": 4.5, "weight": 1},
    {"subject": "ueK", "date": "2025-01-20", "name": "üK-Note", "grade": 5.0, "weight": 1}
  ]
}

CRITICAL RULES:
1. SUBJECT EXTRACTION:
   - For modules: ONLY "M" + 3 digits (M152, M117, M254, etc.)
   - Normalize variations: "m152" → "M152", "Module 152" → "M152", "M 152" → "M152"
   - For üK: ALWAYS use "ueK" (lowercase ue, capital K)
   - Normalize: "üK", "Ük", "ÜK", "üKurs", "Übungskurs" → "ueK"

2. MODULE NAME (moduleName field):
   - Only for M### entries (modules)
   - Extract the FULL descriptive name if visible (e.g., "Webseiten mit XHTML strukturieren")
   - This is the skill/topic name, NOT the assessment name
   - Leave empty/omit if not visible

3. ASSESSMENT NAME (name field):
   - The specific assessment/test name (e.g., "Kontrolle 1", "Test", "Quiz", "Projekt")
   - For üK: just use "üK-Note" or similar

4. DATE:
   - Extract as YYYY-MM-DD if possible
   - Alternative: DD.MM.YYYY
   - If date unclear, use best guess or omit

5. GRADE:
   - REQUIRED - must be numeric (4.5, 5.0, 6.0, etc.)
   - Valid range: 1.0 to 6.0 for Swiss system
   - If value is not numeric or unclear, SKIP this row entirely

6. WEIGHT:
   - Optional, default 1
   - Only if explicitly shown in SAL

7. EXTRACTION COMPLETENESS:
   - Extract EVERY visible row/entry
   - Do NOT filter or skip rows
   - Do NOT invent data not visible in the screenshot
   - Do NOT hallucinate module names if not shown

If no data found: {"error": "no assessments found"}
If unclear format: {"error": "could not parse SAL format"}
`;

const EFZ_BULLETIN_PROMPT = `You are analyzing a Swiss apprenticeship school report (Berufsschule Zeugnis) showing module/skill grades from an IT/computer science program.

The bulletin is displayed as a TABLE:
- Each ROW = one module/subject or übungskurs (üK)
- Each COLUMN = one semester (labeled as Semester, S, or just numbers 1, 2, 3, 4)
- Each CELL = the numeric grade for that module in that semester

STRUCTURE YOU WILL SEE:
- Left column header: "Fach", "Fächter", "Subject", "Module", "Übungskurs" or similar
- Top row headers: Semester numbers (1, 2, 3, 4, etc.) or labels like "S1", "S2", or "Semester 1", "Semester 2"
- Data rows: Each row has a subject/module name and grades for each semester

IDENTIFYING MODULES vs ÜBUNGSKURSE (üK):
1. Modules: Regular subjects (e.g., "Informatikkompetenzen", "Datenbanken", etc.)
2. Übungskurse (üK): Lines containing keywords like:
   - "Übungskurs" or "üK" or "ÜK" anywhere in the line
   - Specific practice course names (e.g., "Linux-üK", "Datenbank-üK", "Web-üK")
   - These are typically listed in a separate section or marked distinctly

CODE GENERATION FOR ROWS:
- If a row has a visible code (M152, M401, etc.): USE IT AS-IS
- If a row has NO CODE but IS A MODULE: Generate code like "M###" (e.g., M117, M122)
  * Assign codes sequentially (M101-M199 for regular modules)
- If a row has NO CODE but IS AN ÜBUNGSKURS: Mark it as "ueK" and include the descriptive name
  * Example: "ueK_Linux", "ueK_Database", "ueK_Web"
  * Prefer using the descriptive name after "ueK_"

EXAMPLE of what a real bulletin looks like:
\`\`\`
Fach                                    Semester 1   Semester 2   Semester 3   Semester 4
Informatikkompetenzen                   5.5          5.0          6.0          5.5
Kleine Datensysteme modellieren         6.0          6.0          6.0          5.0
Datenbanken & Datenschutz              5.5          5.0          5.5          5.0
[... more modules ...]
Übungskurs Linux                        5.5          5.0          -            5.5
Übungskurs Datenbanken                  4.5          4.5          5.0          4.5
\`\`\`

OUTPUT FORMAT (ONLY valid JSON, no text before or after):
{
  "semesters": [
    {"semester": 1, "grades": {"M101": 5.5, "M102": 6.0, "M103": 5.5, "ueK_Linux": 5.5, "ueK_Database": 4.5}},
    {"semester": 2, "grades": {"M101": 5.0, "M102": 6.0, "M103": 5.0, "ueK_Linux": 5.0, "ueK_Database": 4.5}},
    {"semester": 3, "grades": {"M101": 6.0, "M102": 6.0, "M103": 5.5, "ueK_Database": 5.0}},
    {"semester": 4, "grades": {"M101": 5.5, "M102": 5.0, "M103": 5.0, "ueK_Linux": 5.5, "ueK_Database": 4.5}}
  ]
}

CRITICAL RULES - READ CAREFULLY:

1. TABLE STRUCTURE IDENTIFICATION:
   - First column contains subject/module names (may wrap across multiple lines)
   - Remaining columns are semesters with numeric grades
   - Look for patterns: left side = descriptions, right side = numbers

2. SEMESTER IDENTIFICATION:
   - Column headers tell you which semester: "Semester 1", "S1", "1", "2", "3", "4", etc.
   - Map column positions to semester numbers (1st data column = semester 1, etc.)
   - If no header, assume columns are sequential (1, 2, 3, 4, ...)

3. MODULE vs ÜBUNGSKURS DISTINCTION:
   - Keywords that indicate ÜBUNGSKURS: "Übungskurs", "üK", "ÜK", "-üK", "- ÜK"
   - All other subject lines are MODULES
   - This distinction MUST be preserved for proper categorization

4. GRADE EXTRACTION:
   - Only extract VISIBLE numeric grades (5.0, 4.5, 3.5, 6.0, etc.)
   - If a cell is empty, "-", "—", or blank: SKIP that semester for that entry
   - Ignore any text in grade cells; only take the number
   - Decimal format: "5.0", "4.5", "3.5" are valid; "5", "4" should be treated as-is

5. CODE GENERATION RULES:
   - Check each row for an existing code (M###, M###, etc.)
   - If row HAS a code: extract and use it exactly as-is
   - If row has NO code and IS A MODULE: Assign a sequential M-code (M101, M102, M103, ...)
   - If row has NO code and IS AN ÜBUNGSKURS: Use "ueK" + descriptive part (e.g., "ueK_Linux", "ueK_Database")
   - Do NOT invent codes; derive them from visible information

6. HALLUCINATION PREVENTION:
   - Do NOT invent rows, grades, or modules not visible
   - Do NOT create entries for empty cells
   - Do NOT misread headers or formatting as grades
   - Do NOT assume semesters exist if no grade column is present
   - If uncertain about a value, SKIP it

7. HANDLING MULTI-LINE SUBJECT NAMES:
   - Subject names may span multiple lines (e.g., wrapped text)
   - Combine all lines into a single subject identifier
   - Use the full name (or a shortened version) for the code if generating one

If no clear table found: {"error": "no grades table found"}
If table exists but is empty: {"error": "table found but no numeric grades visible"}
`;


// ============================================================================
// HELPERS
// ============================================================================

function getPromptForScanType(scanType) {
  switch (scanType) {
    case 'EFZ_SAL':
      return EFZ_SAL_PROMPT;
    case 'EFZ_BULLETIN':
      return EFZ_BULLETIN_PROMPT;
    case 'SAL':
      return SAL_PROMPT;
    case 'BULLETIN':
      return BULLETIN_PROMPT;
    default:
      console.warn(`[IA] Unknown scan type: ${scanType}, using BULLETIN prompt`);
      return BULLETIN_PROMPT;
  }
}

function buildContentArray(base64Data, mediaType, prompt) {
  const textContent = {
    type: "text",
    text: prompt
  };

  if (mediaType === 'application/pdf') {
    console.log("[IA] Detected PDF - using document parsing");
    return [
      textContent,
      {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: base64Data
        }
      }
    ];
  }

  const supportedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!supportedImageTypes.includes(mediaType)) {
    throw new Error(`Unsupported media type: ${mediaType}. Use JPG, PNG, WebP, or PDF.`);
  }

  console.log(`[IA] Detected image - media type: ${mediaType}`);
  return [
    textContent,
    {
      type: "image",
      source: {
        type: "base64",
        media_type: mediaType,
        data: base64Data
      }
    }
  ];
}

function parseDataUri(dataUri) {
  const matches = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches || !matches[1] || !matches[2]) {
    throw new Error("Invalid data URI format. Expected: data:mime/type;base64,<data>");
  }
  return {
    mediaType: matches[1],
    base64Data: matches[2]
  };
}

async function analyzeDocumentWithClaude(base64Data, mediaType, scanType, apiKey) {
  if (!apiKey) {
    throw new Error("Missing Anthropic API key");
  }

  console.log(`[IA] Analyzing document: ${scanType} (${mediaType})`);

  const prompt = getPromptForScanType(scanType);
  const contentArray = buildContentArray(base64Data, mediaType, prompt);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: contentArray
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[IA] Claude API error: ${response.status}`, errorText);
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  console.log("[IA] Claude response received successfully");
  return data;
}

// ============================================================================
// AUTHENTICATION & SECURITY HELPERS
// ============================================================================

async function verifySupabaseToken(token) {
  if (!supabase) {
    console.warn('[Auth] Supabase not configured, skipping auth check');
    return { user: null, error: 'Supabase not configured' };
  }

  if (!token) {
    return { user: null, error: 'No token provided' };
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error) {
      console.warn('[Auth] Token verification failed:', error.message);
      return { user: null, error: error.message };
    }
    return { user: data.user, error: null };
  } catch (e) {
    console.error('[Auth] Unexpected error during token verification:', e.message);
    return { user: null, error: 'Token verification failed' };
  }
}

// ============================================================================
// RATE LIMITING HELPERS
// ============================================================================

async function checkRateLimit(userId, token) {
  if (!supabase) {
    console.warn('[RateLimit] Supabase not configured, skipping rate limit check');
    return { allowed: true, remaining: null };
  }

  try {
    const now = new Date();
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Create client with user token for RLS
    const userSupabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    // Query 15-minute window
    const { data: recent15m, error: error15m } = await supabase
      .from('scan_rate_limits')
      .select('id')
      .eq('user_id', userId)
      .gte('scanned_at', fifteenMinutesAgo.toISOString())
      .lt('scanned_at', now.toISOString());

    if (error15m) {
      console.warn('[RateLimit] Error checking 15m limit:', error15m.message);
      // Don't block on error, just log and continue
      return { allowed: true, remaining: null };
    }

    const count15m = recent15m?.length || 0;
    const remaining15m = Math.max(0, 3 - count15m);

    // Check 15-minute limit (3 scans)
    if (count15m >= 3) {
      console.warn(`[RateLimit] User ${userId} exceeded 15-minute limit (${count15m}/3)`);
      return {
        allowed: false,
        remaining: 0,
        retryAfter: Math.ceil((fifteenMinutesAgo.getTime() + 15 * 60 * 1000 - now.getTime()) / 1000),
        reason: 'Rate limit exceeded: 3 scans per 15 minutes'
      };
    }

    // Query 24-hour window
    const { data: recent24h, error: error24h } = await supabase
      .from('scan_rate_limits')
      .select('id')
      .eq('user_id', userId)
      .gte('scanned_at', twentyFourHoursAgo.toISOString())
      .lt('scanned_at', now.toISOString());

    if (error24h) {
      console.warn('[RateLimit] Error checking 24h limit:', error24h.message);
      // Don't block on error
      return { allowed: true, remaining: null };
    }

    const count24h = recent24h?.length || 0;
    const remaining24h = Math.max(0, 6 - count24h);

    // Check 24-hour limit (6 scans)
    if (count24h >= 6) {
      console.warn(`[RateLimit] User ${userId} exceeded 24-hour limit (${count24h}/6)`);
      return {
        allowed: false,
        remaining: 0,
        retryAfter: Math.ceil((twentyFourHoursAgo.getTime() + 24 * 60 * 60 * 1000 - now.getTime()) / 1000),
        reason: 'Rate limit exceeded: 6 scans per 24 hours'
      };
    }

    console.log(`[RateLimit] User ${userId}: 15m=${count15m}/3, 24h=${count24h}/6`);
    return {
      allowed: true,
      remaining: Math.min(remaining15m, remaining24h),
      remaining15m,
      remaining24h,
      limit15m: 3,
      limit24h: 6
    };
  } catch (error) {
    console.error('[RateLimit] Unexpected error:', error.message);
    // Don't block on unexpected error, just log
    return { allowed: true, remaining: null };
  }
}

async function logScan(userId, scanType, status = 'success') {
  if (!supabase) {
    console.warn('[RateLimit] Supabase not configured, skipping scan log');
    return;
  }

  try {
    const { error } = await supabase
      .from('scan_rate_limits')
      .insert({
        user_id: userId,
        scan_type: scanType,
        status,
        scanned_at: new Date().toISOString()
      });

    if (error) {
      console.warn('[RateLimit] Error logging scan:', error.message);
    } else {
      console.log(`[RateLimit] Scan logged for user ${userId}`);
    }
  } catch (error) {
    console.error('[RateLimit] Error inserting scan log:', error.message);
  }
}

function validateCORSOrigin(origin) {
  if (!origin) return false;
  return ALLOWED_ORIGINS.includes(origin);
}

function setCORSHeaders(req, res) {
  const origin = req.headers.origin;
  if (validateCORSOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  );
}

// ============================================================================
// VERCEL FUNCTION HANDLER
// ============================================================================

export default async function handler(req, res) {
  // Set CORS headers with origin validation
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log("🔵 POST /api/scan - Document analysis request");
  try {
    // ========== AUTHENTICATION ==========
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      console.warn('[Auth] Request missing bearer token');
      return res.status(401).json({ error: 'Unauthorized: Missing bearer token' });
    }

    const { user, error: authError } = await verifySupabaseToken(token);
    if (authError || !user) {
      console.warn('[Auth] Invalid token for user:', authError);
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    console.log(`[Auth] Authenticated user: ${user.id}`);

    // ========== RATE LIMITING CHECK ==========
    const rateLimitCheck = await checkRateLimit(user.id, token);
    
    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit-15m', '3');
    res.setHeader('X-RateLimit-Limit-24h', '6');
    
    if (rateLimitCheck.remaining15m !== undefined) {
      res.setHeader('X-RateLimit-Remaining-15m', rateLimitCheck.remaining15m);
    }
    if (rateLimitCheck.remaining24h !== undefined) {
      res.setHeader('X-RateLimit-Remaining-24h', rateLimitCheck.remaining24h);
    }

    if (!rateLimitCheck.allowed) {
      console.warn(`[RateLimit] Request blocked: ${rateLimitCheck.reason}`);
      if (rateLimitCheck.retryAfter) {
        res.setHeader('Retry-After', rateLimitCheck.retryAfter);
      }
      return res.status(429).json({
        error: rateLimitCheck.reason,
        retryAfter: rateLimitCheck.retryAfter,
        limit15m: 3,
        limit24h: 6
      });
    }

    // ========== INPUT VALIDATION ==========
    let { image, scanType } = req.body;

    // Normalize scanType to avoid case-sensitivity or naming issues
    if (scanType) {
      scanType = String(scanType).toUpperCase();
      if (scanType === 'ZEUGNISS') {
        scanType = 'BULLETIN';
      }
    }

    if (!image) {
      console.warn('[Validation] No image provided');
      return res.status(400).json({ error: 'No image provided' });
    }

    // Validate base64 size
    if (image.length > MAX_BASE64_SIZE) {
      console.warn(`[Validation] Image too large: ${image.length} bytes (max ${MAX_BASE64_SIZE})`);
      return res.status(413).json({
        error: `Image too large. Max ${MAX_BASE64_SIZE / (1024 * 1024)}MB allowed`
      });
    }

    // Validate scanType
    if (!scanType || !VALID_SCAN_TYPES.includes(scanType)) {
      console.warn(`[Validation] Invalid scanType: ${scanType}`);
      return res.status(400).json({
        error: `Invalid scanType. Must be one of: ${VALID_SCAN_TYPES.join(', ')}`
      });
    }

    // Validate data URI format
    if (!image.match(/^data:(image|application)\/[a-zA-Z0-9\-+.]+;base64,/)) {
      console.warn('[Validation] Invalid data URI format');
      return res.status(400).json({ error: 'Invalid data URI format' });
    }

    // ========== PROCESSING ==========
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('Missing Anthropic API key');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const { mediaType, base64Data } = parseDataUri(image);
    console.log(`📸 Media type: ${mediaType}, size: ${base64Data.length} bytes`);

    const claudeResponse = await analyzeDocumentWithClaude(
      base64Data,
      mediaType,
      scanType,
      apiKey
    );

    // Log successful scan
    await logScan(user.id, scanType, 'success');

    res.json(claudeResponse);

  } catch (error) {
    console.error('❌ /api/scan error:', error.message);
    res.status(error.message.includes('400') ? 400 : 500).json({
      error: error.message
    });
  }
}
