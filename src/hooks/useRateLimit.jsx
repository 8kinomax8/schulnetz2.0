/**
 * Hook pour gérer le rate limiting du scan API
 * Fournit l'état du rate limiting et les méthodes pour l'afficher
 */
/* eslint-disable react-refresh/only-export-components */

import { useState, useEffect, useCallback } from 'react';
import { getRateLimitState } from '../services/apiService';

export const useRateLimit = () => {
  const [rateLimitState, setRateLimitState] = useState(() => getRateLimitState());
  const [error, setError] = useState(null);

  // Met à jour l'état chaque seconde
  useEffect(() => {
    const interval = setInterval(() => {
      setRateLimitState({...getRateLimitState()});
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRateLimitError = useCallback((err) => {
    if (err.code === 'RATE_LIMIT_EXCEEDED') {
      const { retryAfter } = err;
      const retryInSeconds = retryAfter || 60;
      const retryTime = new Date(Date.now() + retryInSeconds * 1000);
      
      setError({
        type: 'RATE_LIMIT_EXCEEDED',
        message: err.message,
        retryAfter: retryInSeconds,
        retryTime: retryTime.toLocaleTimeString(),
        remaining15m: err.rateLimitState?.remaining15m,
        remaining24h: err.rateLimitState?.remaining24h
      });

      // Auto-clear error after retry time
      const timeout = setTimeout(() => {
        setError(null);
      }, retryInSeconds * 1000 + 500);

      return () => clearTimeout(timeout);
    }
    return null;
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    rateLimitState,
    error,
    handleRateLimitError,
    clearError,
    isRateLimited: error?.type === 'RATE_LIMIT_EXCEEDED'
  };
};

/**
 * Composant pour afficher le badge de rate limiting
 */
export const RateLimitBadge = ({ rateLimitState, minimal = false }) => {
  if (!rateLimitState?.remaining15m && !rateLimitState?.remaining24h) {
    return null;
  }

  if (minimal) {
    return (
      <div className="inline-block px-2 py-1 text-xs bg-amber-50 text-amber-700 rounded">
        <span className="font-semibold">Scans:</span> {rateLimitState.remaining15m}/3 (15m), {rateLimitState.remaining24h}/6 (24h)
      </div>
    );
  }

  return (
    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
      <p className="text-sm font-semibold text-amber-900 mb-2">API Usage</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-amber-700">Last 15 minutes</p>
          <p className="text-lg font-bold text-amber-900">
            {rateLimitState.remaining15m ?? '?'}/{rateLimitState.limit15m ?? 3}
          </p>
        </div>
        <div>
          <p className="text-xs text-amber-700">Last 24 hours</p>
          <p className="text-lg font-bold text-amber-900">
            {rateLimitState.remaining24h ?? '?'}/{rateLimitState.limit24h ?? 6}
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * Composant pour afficher l'erreur de rate limiting
 */
export const RateLimitError = ({ error, onDismiss }) => {
  if (!error || error.type !== 'RATE_LIMIT_EXCEEDED') {
    return null;
  }

  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-red-900">Rate Limit Exceeded</h3>
          <p className="text-sm text-red-700 mt-1">{error.message}</p>
          <p className="text-sm text-red-700 mt-2">
            Please try again at <span className="font-semibold">{error.retryTime}</span>
          </p>
          {error.remaining15m !== undefined && (
            <p className="text-xs text-red-600 mt-2">
              15-min window: {error.remaining15m}/3 remaining • 24-hour window: {error.remaining24h}/6 remaining
            </p>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 text-red-400 hover:text-red-500"
          >
            <span className="sr-only">Dismiss</span>
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};
