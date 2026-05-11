import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

// Load env from both `backend/.env` and repo root `.env` (ESM import order matters)
dotenv.config();
try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  // If the variable exists but is empty (common in shells), force override from `.env`
  dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });
} catch {
  // ignore
}

const { BACKEND_CONFIG } = await import("../config.js");

const pool = mysql.createPool({
  host: BACKEND_CONFIG.DATABASE.host,
  user: BACKEND_CONFIG.DATABASE.user,
  password: BACKEND_CONFIG.DATABASE.password,
  database: BACKEND_CONFIG.DATABASE.database,
  port: BACKEND_CONFIG.DATABASE.port,
  waitForConnections: true,
  connectionLimit: 2,
  queueLimit: 0,
  ssl: BACKEND_CONFIG.DATABASE.ssl
});

// Prevent pool from keeping process alive when DB unavailable
pool.on('error', (err) => {
  console.warn('Pool error (non-critical):', err.code);
});

export async function testConnection() {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log("✅ Database connected successfully (MySQL 8)");
    return true;
  } catch (error) {
    console.error("❌ Database connection failed:", error.code, error.message);
    return false;
  }
}

export default pool;