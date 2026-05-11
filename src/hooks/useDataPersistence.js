import { useEffect, useRef } from 'react';
import { storage } from '../utils/storage';

const STORAGE_KEY = 'bm-calculator-data';

/**
 * Hook personnalisé pour charger les données au démarrage
 */
export const useLoadData = (setters, shouldLoadLocalData = true) => {
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!shouldLoadLocalData || hasLoadedRef.current) {
      return;
    }

    hasLoadedRef.current = true;

    try {
      const data = storage.get(STORAGE_KEY);
      // Load the separately saved semester with priority
      const savedSemester = storage.get('currentSemester');
      
      if (data) {
        setters.setSubjects(data.subjects || {});
        setters.setSemesterGrades(data.semesterGrades || {});
        setters.setBmType(data.bmType || 'TAL');
        // Use the separately saved semester or the one in data
        setters.setCurrentSemester(savedSemester || data.currentSemester || 1);
        setters.setSemesterPlans(data.semesterPlans || {});
        setters.setSubjectGoals(data.subjectGoals || {});
        if (setters.setMaturnoteGoal) setters.setMaturnoteGoal(data.maturnoteGoal || 5.0);
        if (setters.setModuleCatalog) setters.setModuleCatalog(data.moduleCatalog || []);
        if (setters.setModuleGrades) setters.setModuleGrades(data.moduleGrades || {});
        if (setters.setModulePlans) setters.setModulePlans(data.modulePlans || {});
        if (setters.setModuleGoals) setters.setModuleGoals(data.moduleGoals || {});
        if (setters.setUekGrades) setters.setUekGrades(data.uekGrades || []);
        if (setters.setUekPlans) setters.setUekPlans(data.uekPlans || []);
        if (setters.setIpaGrade) setters.setIpaGrade(data.ipaGrade ?? null);
        if (setters.setFinalGoal) setters.setFinalGoal(data.finalGoal || 5.0);
        if (setters.setUekGoal) setters.setUekGoal(data.uekGoal || 5.0);
        if (setters.setFinalExamGrades) setters.setFinalExamGrades(data.finalExamGrades || {});
      } else if (savedSemester) {
        // If no data but semester saved, load it anyway
        setters.setCurrentSemester(savedSemester);
      }
    } catch {
      console.log('No saved data found');
    }
  }, [shouldLoadLocalData, setters]);
};

/**
 * Custom hook to automatically save data
 */
export const useSaveData = (data) => {
  useEffect(() => {
    try {
      storage.set(STORAGE_KEY, data);
      // Also save current semester separately for persistence
      storage.set('currentSemester', data.currentSemester);
    } catch (error) {
      console.error('Save error:', error);
    }
  }, [data]);
};
