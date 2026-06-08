/**
 * Centralized Configuration File
 * Modify this file to change environment-specific settings
 * No need to search through the entire codebase
 */

// ============================================
// FRONTEND CONFIGURATION
// ============================================

export const FRONTEND_CONFIG = {
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

  // Add frontend validation if needed in the future
  if (errors.length > 0) {
    console.error('Configuration Errors:');
    errors.forEach(err => console.error(err));
  }

  return errors.length === 0;
}

export default {
  FRONTEND_CONFIG,
  validateConfig
};
