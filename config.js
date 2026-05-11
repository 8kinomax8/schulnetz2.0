/**
 * Centralized Configuration File
 * Modify this file to change environment-specific settings
 * No need to search through the entire codebase
 */

/* global process */

const nodeEnv = typeof process !== 'undefined' && process.env ? process.env : {};

// ============================================
// BACKEND CONFIGURATION
// ============================================

export const BACKEND_CONFIG = {
  // Server
  PORT: nodeEnv.PORT || 3001,
  HOST: nodeEnv.HOST || '0.0.0.0',
  NODE_ENV: nodeEnv.NODE_ENV || 'development',

  // Database (RDS)
  DATABASE: {
    host: nodeEnv.RDS_HOST || 'localhost',
    user: nodeEnv.RDS_USER || 'root',
    password: nodeEnv.RDS_PASSWORD || '',
    database: nodeEnv.RDS_DATABASE || 'bm_calculator',
    port: nodeEnv.RDS_PORT || 3306,
    ssl: { rejectUnauthorized: false } // MySQL RDS nécessite TLS
  },

  // API Keys
  ANTHROPIC_API_KEY: nodeEnv.ANTHROPIC_API_KEY || '',

  // CORS Origins (Add your Amplify domain here)
  CORS_ORIGINS: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    nodeEnv.FRONTEND_URL || 'http://localhost:5173',
  ].filter(Boolean),

  // Maximum file size for uploads (30MB)
  MAX_FILE_SIZE: '30mb'
};

// ============================================
// FRONTEND CONFIGURATION
// ============================================

export const FRONTEND_CONFIG = {
  // Backend API URL
  // Use VITE_API_URL env variable, fallback to local EC2 (change if needed)
  // Default to local backend for development; override with VITE_API_URL in production
  // In dev, prefer same-origin calls through the Vite proxy (`/api` -> http://localhost:3001)
  API_URL: (() => {
    const envUrl = import.meta.env?.VITE_API_URL;
    const isDev = !!import.meta.env?.DEV;
    if (!envUrl) return isDev ? '' : 'http://localhost:3001';
    if (isDev && /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(envUrl)) return '';
    return envUrl;
  })(),

  // Application Settings
  MAX_GRADE: 6.0,
  MIN_GRADE: 1.0,
  DEFAULT_BM_TYPE: 'TAL' // TAL or DL
};

// ============================================
// Validation Helper
// ============================================

export function validateConfig() {
  const errors = [];

  // Backend validation
  if (!BACKEND_CONFIG.ANTHROPIC_API_KEY && BACKEND_CONFIG.NODE_ENV === 'production') {
    errors.push('❌ ANTHROPIC_API_KEY is not set');
  }
  if (!BACKEND_CONFIG.DATABASE.password && BACKEND_CONFIG.NODE_ENV === 'production') {
    errors.push('❌ RDS_PASSWORD is not set');
  }

  // Frontend validation
  if (!FRONTEND_CONFIG.API_URL) {
    errors.push('❌ VITE_API_URL is not set');
  }
  if (errors.length > 0) {
    console.error('Configuration Errors:');
    errors.forEach(err => console.error(err));
    if (BACKEND_CONFIG.NODE_ENV === 'production') {
      throw new Error('Missing critical configuration');
    }
  }

  return errors.length === 0;
}

export default {
  BACKEND_CONFIG,
  FRONTEND_CONFIG,
  validateConfig
};
