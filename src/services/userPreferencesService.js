import { supabase } from './supabaseClient';

/**
 * Récupère les préférences utilisateur
 */
export async function getUserPreferences() {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .single();

  return { data, error };
}

/**
 * Crée ou met à jour les préférences utilisateur
 */
export async function setUserPreferences({ currentSemester, bmType, maturanoteGoal = 5.0, tourCompleted = false }) {
  const { data, error } = await supabase
    .from('user_preferences')
    .upsert(
      {
        current_semester: currentSemester,
        bm_type: bmType,
        maturanote_goal: maturanoteGoal,
        tour_completed: tourCompleted
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  return { data, error };
}

/**
 * Vérifie si l'utilisateur a complété l'onboarding
 */
export async function hasCompletedOnboarding() {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('user_id')
    .single();

  if (error && error.code === 'PGRST116') {
    // Row not found = pas encore d'onboarding
    return false;
  }

  return !!data;
}
