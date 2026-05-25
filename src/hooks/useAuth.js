import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';

// Authentication hook: Supabase session management
export function useAuth() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Fetch initial session
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        setAuthError(error.message);
      }
      setUser(data?.session?.user ?? null);
      setAuthLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback(async (email, password, displayName = '') => {
    setAuthError(null);
    const { data, error } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        data: {
          display_name: displayName
        }
      }
    });
    if (error) setAuthError(error.message);
    return { data, error };
  }, []);

  const signIn = useCallback(async (email, password) => {
    setAuthError(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
    return { data, error };
  }, []);

  const signOut = useCallback(async () => {
    setAuthError(null);
    const { error } = await supabase.auth.signOut();
    if (error) setAuthError(error.message);
  }, []);

  const updateEmail = useCallback(async (newEmail) => {
    setAuthError(null);
    try {
      const { data, error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) {
        setAuthError(error.message);
        throw error;
      }
      return data;
    } catch (error) {
      setAuthError(error.message);
      throw error;
    }
  }, []);

  const updatePassword = useCallback(async (currentPassword, newPassword) => {
    setAuthError(null);
    const currentEmail = user?.email;

    if (!currentEmail) {
      const error = new Error('Keinn eingeloggter Benutzer gefunden');
      setAuthError(error.message);
      throw error;
    }

    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: currentEmail,
      password: currentPassword
    });

    if (reauthError) {
      setAuthError('Aktuelles Passwort ist ungültig');
      throw reauthError;
    }

    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setAuthError(error.message);
      throw error;
    }
    return data;
  }, [user?.email]);

  const updateDisplayName = useCallback(async (newDisplayName) => {
    setAuthError(null);
    const { data, error } = await supabase.auth.updateUser({ 
      data: { display_name: newDisplayName } 
    });
    if (error) {
      setAuthError(error.message);
      throw error;
    }
    return data;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google'
    });
    if (error) setAuthError(error.message);
    return { data, error };
  }, []);

  const signInWithGithub = useCallback(async () => {
    setAuthError(null);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github'
    });
    if (error) setAuthError(error.message);
    return { data, error };
  }, []);

  return { user, authLoading, authError, signUp, signIn, signOut, updateEmail, updatePassword, updateDisplayName, signInWithGoogle, signInWithGithub };
}
