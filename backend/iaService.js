/**
 * IA Service - Isolated Claude/Anthropic integration for document scanning
 * Handles bulletin analysis, SAL (Lernkontroller) scanning, and EFZ module extraction
 * Uses Claude Haiku with vision and document parsing
 */

import fetch from "node-fetch";

// ============================================================================
// PROMPTS - Claude instructions for different document types
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
// CLAUDE API SERVICE
// ============================================================================

/**
 * Call Claude Haiku API to analyze a document/image
 * @param {string} base64Data - Base64 encoded image or PDF
 * @param {string} mediaType - MIME type (image/jpeg, image/png, image/webp, application/pdf)
 * @param {string} scanType - Document type: 'BULLETIN', 'SAL', 'EFZ_SAL'
 * @param {string} apiKey - Anthropic API key
 * @returns {Promise<Object>} Claude response with extracted data
 */
export async function analyzeDocumentWithClaude(base64Data, mediaType, scanType, apiKey) {
  if (!apiKey) {
    throw new Error("Missing Anthropic API key");
  }

  console.log(`[IA] Analyzing document: ${scanType} (${mediaType})`);

  // Select appropriate prompt based on document type
  const prompt = getPromptForScanType(scanType);

  // Build content array based on media type
  const contentArray = buildContentArray(base64Data, mediaType, prompt);

  // Call Anthropic API
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
// HELPERS
// ============================================================================

/**
 * Get Claude prompt based on scan type
 * @param {string} scanType - 'BULLETIN', 'SAL', or 'EFZ_SAL'
 * @returns {string} The appropriate prompt
 */
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

/**
 * Build Claude API content array
 * Handles both image and PDF media types
 * @param {string} base64Data - Base64 encoded data
 * @param {string} mediaType - MIME type
 * @param {string} prompt - Claude prompt/instructions
 * @returns {Array} Content array for Claude API
 */
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

  // Image handling (JPEG, PNG, WebP)
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

/**
 * Validate and parse base64 data from data URI
 * @param {string} dataUri - Data URI (data:mime/type;base64,...)
 * @returns {Object} {mediaType, base64Data}
 */
export function parseDataUri(dataUri) {
  const matches = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches || !matches[1] || !matches[2]) {
    throw new Error("Invalid data URI format. Expected: data:mime/type;base64,<data>");
  }
  return {
    mediaType: matches[1],
    base64Data: matches[2]
  };
}

export default {
  analyzeDocumentWithClaude,
  parseDataUri,
  getPromptForScanType
};
