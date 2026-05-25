import { useEffect, useState, useCallback } from 'react';
import { getUserPreferences, setUserPreferences, hasCompletedOnboarding } from '../services/userPreferencesService';

/**
 * Hook pour gérer l'onboarding utilisateur
 * Vérifie si l'utilisateur a complété sa configuration initiale
 */
export function useOnboarding(user) {
  const [needsOnboarding, setNeedsOnboarding] = useState(null);
  const [onboardingLoading, setOnboardingLoading] = useState(true);
  const [onboardingError, setOnboardingError] = useState(null);
  const [userPreferences, setUserPreferencesState] = useState(null);

  // Charger les préférences au montage ou quand l'utilisateur change
  useEffect(() => {
    let mounted = true;

    if (!user) {
      setNeedsOnboarding(null);
      setOnboardingLoading(false);
      return;
    }

    const checkOnboarding = async () => {
      setOnboardingLoading(true);
      setOnboardingError(null);

      try {
        const completed = await hasCompletedOnboarding();
        if (mounted) {
          setNeedsOnboarding(!completed);

          if (completed) {
            // Charger les préférences actuelles
            const { data, error } = await getUserPreferences();
            if (!error && data) {
              setUserPreferencesState(data);
            }
          }
        }
      } catch (error) {
        if (mounted) {
          setOnboardingError(error.message);
          setNeedsOnboarding(true); // Affiche l'onboarding en cas d'erreur
        }
      } finally {
        if (mounted) {
          setOnboardingLoading(false);
        }
      }
    };

    checkOnboarding();

    return () => {
      mounted = false;
    };
  }, [user]);

  const completeOnboarding = useCallback(async ({ currentSemester, bmType }) => {
    setOnboardingError(null);
    try {
      const { data, error } = await setUserPreferences({
        currentSemester,
        bmType,
        maturanoteGoal: 5.0
      });

      if (error) {
        throw error;
      }

      setUserPreferencesState(data);
      setNeedsOnboarding(false);
      return { data, error: null };
    } catch (error) {
      setOnboardingError(error.message);
      return { data: null, error };
    }
  }, []);

  return {
    needsOnboarding,
    onboardingLoading,
    onboardingError,
    userPreferences,
    completeOnboarding
  };
}
