/**
 * Vercel Function: /api/scan
 * Serverless handler for document scanning via Claude API
 * Handles: SAL screenshots, bulletin PDFs, EFZ module scans
 */

// ============================================================================
// PROMPTS - Claude instructions
// ============================================================================

const BULLETIN_PROMPT = `You are analyzing a Swiss school report (Berufsschule or Berufsmaturität). Extract all semester grades.

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

const EFZ_SAL_PROMPT = `You are analyzing a SAL screenshot from Swiss apprenticeship training (Berufsschule). Extract EVERY graded entry.

OUTPUT FORMAT (ONLY valid JSON, no text before or after):
{
  "controls": [
    {"subject": "M152", "moduleName": "Multimedia-Inhalte in Webauftritt integrieren", "date": "2025-01-15", "name": "Kontrolle", "grade": 5.5, "weight": 1},
    {"subject": "ueK", "date": "2025-01-10", "name": "üK-Note", "grade": 4.5, "weight": 1}
  ]
}

IMPORTANT RULES:
- For modules: subject MUST be "M" + 3 digits (e.g., M152, M123, M200)
  - If you see m152 or "Module 152" or "Modul 152", normalize to "M152"
  - moduleName: extract the visible module title/name next to the module code when present. Do not put the test/control name here.
- For üK entries: subject MUST be exactly "ueK" (or "uek" in input -> "ueK" in output)
- date: YYYY-MM-DD format preferred
- grade: numeric (5.5, 4.0, 6.0, etc) - REQUIRED
- weight: numeric, default 1 if not visible
- EXTRACT EVERY row you see
- If no data: {"error": "no controls found"}
`;

// ============================================================================
// HELPERS
// ============================================================================

function getPromptForScanType(scanType) {
  switch (scanType) {
    case 'EFZ_SAL':
      return EFZ_SAL_PROMPT;
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
// VERCEL FUNCTION HANDLER
// ============================================================================

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log("🔵 POST /api/scan - Document analysis request");
  try {
    const { image, scanType } = req.body;

    if (!image) {
      console.log("❌ No image provided");
      return res.status(400).json({ error: "No image provided" });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.log("❌ Missing Anthropic API key");
      return res.status(500).json({ error: "Missing Anthropic API key" });
    }

    const { mediaType, base64Data } = parseDataUri(image);
    console.log(`📸 Media type: ${mediaType}, size: ${base64Data.length} bytes`);

    const claudeResponse = await analyzeDocumentWithClaude(
      base64Data,
      mediaType,
      scanType,
      apiKey
    );

    res.json(claudeResponse);

  } catch (error) {
    console.error("❌ /api/scan error:", error.message);
    res.status(error.message.includes("400") ? 400 : 500).json({
      error: error.message
    });
  }
}
