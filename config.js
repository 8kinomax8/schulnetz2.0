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
  // Production (Vercel): use relative paths (Vercel Functions at /api, same origin)
  // Development: use Vite proxy or VITE_API_URL env variable
  API_URL: (() => {
    const isDev = !!import.meta.env?.DEV;
    const envUrl = import.meta.env?.VITE_API_URL;
    
    // Production: always use relative paths (Vercel Functions)
    if (!isDev) return '';
    
    // Development: use Vite proxy if localhost, else use VITE_API_URL
    if (!envUrl || /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(envUrl)) {
      return ''; // Use Vite proxy to http://localhost:3001
    }
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
