import express from "express";
import cors from "cors";
/* global process */
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import { testConnection } from "./db.js";
import routes from "./routes.js";
import * as iaService from "./iaService.js";

// Load env from both `backend/.env` (default) and repo root `.env` (common in this project)
dotenv.config();
try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  // If the variable exists but is empty (common in shells), force override from `.env`
  dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });
} catch {
  // ignore: best-effort for local dev
}

// IMPORTANT (ESM): load env BEFORE importing config so it can read process.env.
const { BACKEND_CONFIG, validateConfig } = await import("../config.js");

validateConfig();

const app = express();
// Robust CORS handling: allow configured origins, localhost dev, and log rejections
app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g. curl, server-to-server) with no origin
    if (!origin) return callback(null, true);

    const allowed = Array.isArray(BACKEND_CONFIG.CORS_ORIGINS)
      ? BACKEND_CONFIG.CORS_ORIGINS
      : [BACKEND_CONFIG.CORS_ORIGINS];

    // Always allow common dev hosts (Vite may pick another port if 5173 is taken)
    const devOriginRe = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/;
    if (devOriginRe.test(origin) || allowed.includes(origin)) {
      return callback(null, true);
    }

    console.warn(`Rejected CORS origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'), false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  optionsSuccessStatus: 200
}));
app.use(express.json({ limit: BACKEND_CONFIG.MAX_FILE_SIZE }));


app.set('trust proxy', true);

// ============================================================================
// DOCUMENT SCANNING ENDPOINT - Delegates to IA Service
// ============================================================================
// Endpoint to scan and analyze school documents (bulletins, SAL screenshots)
// Uses Claude vision API for image/PDF document extraction
// Response contains extracted grades, controls, or semester data

app.post("/api/scan", async (req, res) => {
  console.log("🔵 POST /api/scan - Document analysis request");
  try {
    const { image, scanType } = req.body;

    if (!image) {
      console.log("❌ No image provided");
      return res.status(400).json({ error: "No image provided" });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      console.log("❌ Missing Anthropic API key");
      return res.status(500).json({ error: "Missing Anthropic API key" });
    }

    // Parse base64 data from data URI
    const { mediaType, base64Data } = iaService.parseDataUri(image);
    console.log(`📸 Media type: ${mediaType}, size: ${base64Data.length} bytes`);

    // Call IA service to analyze document with Claude
    const claudeResponse = await iaService.analyzeDocumentWithClaude(
      base64Data,
      mediaType,
      scanType,
      process.env.ANTHROPIC_API_KEY
    );

    // Return Claude's response directly
    res.json(claudeResponse);

  } catch (error) {
    console.error("❌ /api/scan error:", error.message);
    res.status(error.message.includes("400") ? 400 : 500).json({
      error: error.message
    });
  }
});

// ============================================================================
// DATABASE API ROUTES (MySQL - Legacy)
// ============================================================================
// Note: These routes are maintained for backward compatibility
// but the frontend has migrated to Supabase for primary persistence

app.use('/api', routes);

app.listen(BACKEND_CONFIG.PORT, BACKEND_CONFIG.HOST, () => {
  console.log(`Backend API running on http://${BACKEND_CONFIG.HOST}:${BACKEND_CONFIG.PORT}`);
  console.log("Environment:", BACKEND_CONFIG.NODE_ENV);
  console.log("Loaded API key:", BACKEND_CONFIG.ANTHROPIC_API_KEY ? `✅ (starts with ${BACKEND_CONFIG.ANTHROPIC_API_KEY.substring(0, 10)}...)` : "❌ MISSING");
  console.log("CORS origins:", BACKEND_CONFIG.CORS_ORIGINS);
});

// Test database connection asynchronously without blocking server startup
(async () => {
  try {
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error("⚠️ Running without database.");
    }
  } catch (err) {
    console.error("⚠️ Database test error:", err.message);
  }
})();
