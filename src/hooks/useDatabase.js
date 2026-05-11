import { useAuth } from './useAuth';
import { storage } from '../utils/storage';
import { supabase } from '../services/supabaseClient';
import * as gradeService from '../services/gradeService';
import * as semesterGradeService from '../services/semesterGradeService';
import * as subjectService from '../services/subjectService';
import * as efz from '../services/efzService';
import { useState, useCallback } from 'react';

/**
 * Custom hook to manage database operations
 * Handles user sync, grades, semester plans, goals, and exam simulations
 */
export function useDatabase() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const userId = user?.id || null;
  const userEmail = user?.email || null;
  const userName = user?.user_metadata?.display_name || user?.user_metadata?.full_name || userEmail?.split('@')[0] || null;

  const readLocalSettings = () => {
    const saved = storage.get('bm-calculator-data', {});
    return {
      bm_type: saved.bmType || 'TAL',
      current_semester: saved.currentSemester || 1,
      maturanote_goal: saved.maturnoteGoal || 5.0
    };
  };

  const ensureSubject = useCallback(async (subjectName) => {
    return await subjectService.getOrCreateSubject(subjectName);
  }, []);

  // Sync user to database
  const syncUser = useCallback(async (bmType = 'TAL') => {
    if (!userId) return null;
    const localSettings = readLocalSettings();
    const savedSemester = storage.get('currentSemester', null);
    const hasLocalSemester = Number.isFinite(savedSemester) || (savedSemester !== null && savedSemester !== undefined);
    const localSemester = Number.isFinite(savedSemester)
      ? savedSemester
      : (hasLocalSemester ? savedSemester : localSettings.current_semester);

    const { data: preferences, error: fetchError } = await supabase
      .from('user_preferences')
      .select('current_semester, bm_type, maturanote_goal, created_at, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    let nextPreferences = preferences || {
      current_semester: localSemester,
      bm_type: localSettings.bm_type || bmType || 'TAL',
      maturanote_goal: localSettings.maturanote_goal
    };

    if (!preferences) {
      const { data: upsertedPreferences, error: upsertError } = await supabase
        .from('user_preferences')
        .upsert([{
          user_id: userId,
          current_semester: nextPreferences.current_semester,
          bm_type: nextPreferences.bm_type,
          maturanote_goal: nextPreferences.maturanote_goal
        }], { onConflict: 'user_id' })
        .select('current_semester, bm_type, maturanote_goal, created_at, updated_at')
        .single();

      if (upsertError) {
        throw upsertError;
      }

      nextPreferences = upsertedPreferences || nextPreferences;
    }

    return {
      id: userId,
      email: userEmail,
      display_name: userName,
      current_semester: nextPreferences.current_semester || 1,
      bm_type: nextPreferences.bm_type || bmType || 'TAL',
      maturanote_goal: nextPreferences.maturanote_goal || 5.0,
      needsSemesterSetup: !preferences && !hasLocalSemester
    };
  }, [userId, userEmail, userName]);

  // Update user semester
  const updateSemester = useCallback(async (semester) => {
    if (!userId) return semester;
    const saved = storage.get('bm-calculator-data', {});
    storage.set('bm-calculator-data', { ...saved, currentSemester: semester });
    storage.set('currentSemester', semester);

    console.log('💾 updateSemester called', { userId, semester });
    const { data, error: upsertError } = await supabase
      .from('user_preferences')
      .upsert([{ user_id: userId, current_semester: semester }])
      .select();

    if (upsertError) {
      console.error('❌ Semester upsert error:', upsertError);
      throw upsertError;
    }
    console.log('✅ Semester upserted successfully:', data);

    return semester;
  }, [userId]);

  // Update user BM type
  const updateBmType = useCallback(async (bmType) => {
    if (!userId) return bmType;
    const saved = storage.get('bm-calculator-data', {});
    storage.set('bm-calculator-data', { ...saved, bmType });

    console.log('💾 updateBmType called', { userId, bmType });
    const { data, error: upsertError } = await supabase
      .from('user_preferences')
      .upsert([{ user_id: userId, bm_type: bmType }])
      .select();

    if (upsertError) {
      console.error('❌ BmType upsert error:', upsertError);
      throw upsertError;
    }
    console.log('✅ BmType upserted successfully:', data);

    return bmType;
  }, [userId]);

  // Update maturanote goal
  const updateMaturanoteGoal = useCallback(async (goal) => {
    if (!userId) return goal;
    const saved = storage.get('bm-calculator-data', {});
    storage.set('bm-calculator-data', { ...saved, maturnoteGoal: goal });

    console.log('💾 updateMaturanoteGoal called', { userId, goal });
    const { data, error: upsertError } = await supabase
      .from('user_preferences')
      .upsert([{ user_id: userId, maturanote_goal: goal }])
      .select();

    if (upsertError) {
      console.error('❌ MaturanoteGoal upsert error:', upsertError);
      throw upsertError;
    }
    console.log('✅ MaturanoteGoal upserted successfully:', data);

    return goal;
  }, [userId]);

  // ============================================
  // GRADES
  // ============================================

  const addGrade = useCallback(async (subjectName, grade, weight, semester, controlName = null, controlDate = null) => {
    if (!userId) return null;

    setLoading(true);
    setError(null);
    try {
      const subject = await ensureSubject(subjectName);
      return await gradeService.addGrade({
        subject_id: subject.id,
        semester_number: semester,
        grade,
        weight,
        date: controlDate || null,
        control_name: controlName,
        source: 'manual'
      });
    } catch (err) {
      setError(err.message);
      console.error('Error adding grade:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, ensureSubject]);

  const removeGrade = useCallback(async (gradeId) => {
    if (!userId) return null;

    setLoading(true);
    setError(null);
    try {
      return await gradeService.deleteGrade(gradeId);
    } catch (err) {
      setError(err.message);
      console.error('Error removing grade:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const getUserGrades = useCallback(async (semester = null, subject = null) => {
    if (!userId) return [];

    setLoading(true);
    setError(null);
    try {
      const [grades, subjects] = await Promise.all([
        gradeService.listGrades(),
        subjectService.listSubjects()
      ]);

      const subjectById = new Map(subjects.map((entry) => [entry.id, entry]));
      return grades
        .filter((entry) => (semester === null || entry.semester_number === semester))
        .filter((entry) => !subject || subjectById.get(entry.subject_id)?.name === subject)
        .map((entry) => ({
          ...entry,
          subject_name: subjectById.get(entry.subject_id)?.name || null,
          subject_id: entry.subject_id
        }));
    } catch (err) {
      setError(err.message);
      console.error('Error fetching grades:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // ============================================
  // SEMESTER GRADES
  // ============================================

  const setSemesterGrade = useCallback(async (subjectName, semester, grade) => {
    if (!userId) return null;

    setLoading(true);
    setError(null);
    try {
      const subject = await ensureSubject(subjectName);
      return await semesterGradeService.upsertSemesterGrade({
        subject_id: subject.id,
        semester_number: semester,
        grade
      });
    } catch (err) {
      setError(err.message);
      console.error('Error setting semester grade:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, ensureSubject]);

  const getUserSemesterGrades = useCallback(async (semester = null) => {
    if (!userId) return [];

    setLoading(true);
    setError(null);
    try {
      const data = await semesterGradeService.listSemesterGrades();
      return data
        .filter((entry) => semester === null || entry.semester_number === semester)
        .map((entry) => ({
          ...entry,
          subject_name: entry.subjects?.name || null
        }));
    } catch (err) {
      setError(err.message);
      console.error('Error fetching semester grades:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // ============================================
  // SEMESTER PLANS
  // ============================================

  const addSemesterPlan = useCallback(async (subjectName, semester, plannedGrade, weight = 1, description = null) => {
    if (!userId) return null;

    setLoading(true);
    setError(null);
    try {
      const subject = await ensureSubject(subjectName);
      const { data, error } = await supabase
        .from('semester_plans')
        .insert([{ subject_id: subject.id, semester_number: semester, planned_grade: plannedGrade, weight, description }])
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (err) {
      setError(err.message);
      console.error('Error adding semester plan:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, ensureSubject]);

  const removeSemesterPlan = useCallback(async (planId) => {
    if (!userId) return null;

    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.from('semester_plans').delete().eq('id', planId);
      if (error) throw error;
      return true;
    } catch (err) {
      setError(err.message);
      console.error('Error removing semester plan:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const getUserSemesterPlans = useCallback(async (semester = null) => {
    if (!userId) return [];

    setLoading(true);
    setError(null);
    try {
      let query = supabase.from('semester_plans').select('id, subject_id, semester_number, planned_grade, weight, description, created_at, subjects(name, code)').order('created_at', { ascending: false });
      if (semester !== null) query = query.eq('semester_number', semester);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((entry) => ({
        ...entry,
        subject_name: entry.subjects?.name || null
      }));
    } catch (err) {
      setError(err.message);
      console.error('Error fetching semester plans:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // ============================================
  // SUBJECT GOALS
  // ============================================

  const setSubjectGoal = useCallback(async (subjectName, targetGrade) => {
    if (!userId) return null;

    setLoading(true);
    setError(null);
    try {
      const subject = await ensureSubject(subjectName);
      const { data, error } = await supabase
        .from('subject_goals')
        .upsert([{ subject_id: subject.id, target_grade: targetGrade }], { onConflict: 'user_id,subject_id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (err) {
      setError(err.message);
      console.error('Error setting subject goal:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, ensureSubject]);

  const removeSubjectGoal = useCallback(async (subjectName) => {
    if (!userId) return null;

    setLoading(true);
    setError(null);
    try {
      const subject = await ensureSubject(subjectName);
      const { error } = await supabase.from('subject_goals').delete().eq('subject_id', subject.id);
      if (error) throw error;
      return true;
    } catch (err) {
      setError(err.message);
      console.error('Error removing subject goal:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, ensureSubject]);

  const getUserSubjectGoals = useCallback(async () => {
    if (!userId) return [];

    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('subject_goals')
        .select('id, subject_id, target_grade, created_at, subjects(name, code)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((entry) => ({
        ...entry,
        subject_name: entry.subjects?.name || null
      }));
    } catch (err) {
      setError(err.message);
      console.error('Error fetching subject goals:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // ============================================
  // EXAM SIMULATOR
  // ============================================

  const setExamGrade = useCallback(async (subjectName, simulatedGrade) => {
    if (!userId) return null;

    setLoading(true);
    setError(null);
    try {
      const subject = await ensureSubject(subjectName);
      const { data, error } = await supabase
        .from('exam_simulator')
        .upsert([{ subject_id: subject.id, simulated_grade: simulatedGrade }], { onConflict: 'user_id,subject_id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (err) {
      setError(err.message);
      console.error('Error setting exam grade:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, ensureSubject]);

  const setFinalExamGrade = useCallback(async (subjectName, finalGrade) => {
    if (!userId) return null;

    setLoading(true);
    setError(null);
    try {
      const subject = await ensureSubject(subjectName);
      const { data, error } = await supabase
        .from('exam_simulator')
        .upsert([{ subject_id: subject.id, final_grade: finalGrade }], { onConflict: 'user_id,subject_id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (err) {
      // If the column doesn't exist in the target DB, log a helpful message and surface a friendly error
      const msg = err?.message || String(err);
      if (msg.includes('final_grade does not exist') || msg.includes('column "final_grade"')) {
        console.warn('exam_simulator.final_grade column missing in DB. Run migrations to add it (see supabase/migrations).');
        setError('Database schema missing: final exam grades not supported. Run migrations to add final_grade column.');
        throw new Error('Database schema missing: please run `npx supabase db push` or apply migrations to add exam_simulator.final_grade');
      }
      setError(msg);
      console.error('Error setting final exam grade:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, ensureSubject]);

  const removeExamGrade = useCallback(async (subjectName) => {
    if (!userId) return null;

    setLoading(true);
    setError(null);
    try {
      const subject = await ensureSubject(subjectName);
      const { error } = await supabase.from('exam_simulator').delete().eq('subject_id', subject.id);
      if (error) throw error;
      return true;
    } catch (err) {
      setError(err.message);
      console.error('Error removing exam grade:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, ensureSubject]);

  const getUserExamGrades = useCallback(async () => {
    if (!userId) return [];

    setLoading(true);
    setError(null);
    try {
      // Try selecting the final_grade column, but gracefully fallback if it doesn't exist
      let res = await supabase
        .from('exam_simulator')
        .select('id, subject_id, simulated_grade, final_grade, created_at, subjects(name, code)')
        .order('created_at', { ascending: false });

      if (res.error) {
        const message = res.error.message || '';
        if (message.includes('final_grade') || message.includes('does not exist')) {
          console.warn('final_grade column missing; retrying without it');
          res = await supabase
            .from('exam_simulator')
            .select('id, subject_id, simulated_grade, created_at, subjects(name, code)')
            .order('created_at', { ascending: false });
        }
      }

      if (res.error) throw res.error;
      return (res.data ?? []).map((entry) => ({
        ...entry,
        subject_name: entry.subjects?.name || null
      }));
    } catch (err) {
      setError(err.message || String(err));
      console.error('Error fetching exam grades:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // ============================================
  // EFZ / Berufsschule (Supabase)
  // ============================================

  const getUserEfzModules = useCallback(async (semester = null) => {
    try {
      return await efz.getUserModules(semester);
    } catch (err) {
      console.error('Error fetching EFZ modules:', err);
      return [];
    }
  }, []);

  const addEfzModule = useCallback(async ({ module_code, name, semester = 1 }) => {
    try {
      return await efz.addModule({ module_code, name, semester });
    } catch (err) {
      console.error('Error adding EFZ module:', err);
    }
  }, []);

  const removeEfzModule = useCallback(async (id) => {
    try {
      return await efz.removeModule(id);
    } catch (err) {
      console.error('Error removing EFZ module:', err);
    }
  }, []);

  const getEfzModuleGrades = useCallback(async (module_id) => {
    try {
      return await efz.getModuleGrades(module_id);
    } catch (err) {
      console.error('Error fetching module grades:', err);
      return [];
    }
  }, []);

  const addEfzModuleGrade = useCallback(async (payload) => {
    try {
      return await efz.addModuleGrade(payload);
    } catch (err) {
      console.error('Error adding module grade:', err);
    }
  }, []);

  const removeEfzModuleGrade = useCallback(async (id) => {
    try {
      return await efz.removeModuleGrade(id);
    } catch (err) {
      console.error('Error removing module grade:', err);
    }
  }, []);

  const getEfzUekGrades = useCallback(async () => {
    try {
      return await efz.getUekGrades();
    } catch (err) {
      console.error('Error fetching ueK grades:', err);
      return [];
    }
  }, []);

  const addEfzUekGrade = useCallback(async (payload) => {
    try {
      return await efz.addUekGrade(payload);
    } catch (err) {
      console.error('Error adding ueK grade:', err);
    }
  }, []);

  const removeEfzUekGrade = useCallback(async (id) => {
    try {
      return await efz.removeUekGrade(id);
    } catch (err) {
      console.error('Error removing ueK grade:', err);
    }
  }, []);

  const getEfzIpa = useCallback(async () => {
    try {
      return await efz.getIpa();
    } catch (err) {
      console.error('Error fetching IPA:', err);
      return [];
    }
  }, []);

  const setEfzIpa = useCallback(async ({ grade, is_final = true }) => {
    try {
      return await efz.setIpa({ grade, is_final });
    } catch (err) {
      console.error('Error setting IPA:', err);
    }
  }, []);

  const removeEfzIpa = useCallback(async (id) => {
    try {
      return await efz.removeIpa(id);
    } catch (err) {
      console.error('Error removing IPA:', err);
    }
  }, []);

  return {
    loading,
    error,
    userId,
    syncUser,
    updateSemester,
    updateBmType,
    updateMaturanoteGoal,
    addGrade,
    removeGrade,
    getUserGrades,
    setSemesterGrade,
    getUserSemesterGrades,
    addSemesterPlan,
    removeSemesterPlan,
    getUserSemesterPlans,
    setSubjectGoal,
    removeSubjectGoal,
    getUserSubjectGoals,
    setExamGrade,
    removeExamGrade,
    getUserExamGrades
    ,
    // EFZ
    getUserEfzModules,
    addEfzModule,
    removeEfzModule,
    getEfzModuleGrades,
    addEfzModuleGrade,
    removeEfzModuleGrade,
    getEfzUekGrades,
    addEfzUekGrade,
    removeEfzUekGrade,
    getEfzIpa,
    setEfzIpa,
    removeEfzIpa,
    setFinalExamGrade
  };
}
