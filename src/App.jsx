import React, { useState, useEffect, useRef } from 'react';
import { Book, Calculator, TrendingUp, Target, GraduationCap, LogOut, ChartNoAxesGantt, Binary, NotebookPen, Edit, X, Check } from 'lucide-react';
import { Joyride, STATUS } from 'react-joyride';
import { BM_SUBJECTS, EXAM_COMPONENTS, EXAM_SUBJECTS, LEKTIONENTAFEL } from './constants';
import { GradeCard, SemesterSimulatorCard, BulletinAnalysis, PromotionStatus, AuthPanel, OnboardingSetup } from './components';
import AccountSettings from './components/AccountSettings';
import {
  useLoadData,
  useSaveData,
  useGradeCalculations,
  useBulletinAnalysis,
  useApprenticeshipCalculations,
  useOnboarding
} from './hooks';
import { useAuth } from './hooks/useAuth';
import { useDatabase } from './hooks/useDatabase';
import SemesterPrompt from './components/SemesterPrompt';
import { storage, formatSwissDate } from './utils';
import { analyzeBulletin } from './services/apiService';
import { setUserPreferences } from './services/userPreferencesService';

const swissDateToSQL = (swissDate) => {
  if (!swissDate || typeof swissDate !== 'string') return '';

  const parts = swissDate.split('.');
  if (parts.length !== 3) return '';

  const [day, month, year] = parts;

  if (!day || !month || !year) return '';
  if (day.length !== 2 || month.length !== 2 || year.length !== 4) return '';

  return `${year}-${month}-${day}`;
};

const sqlDateToSwiss = (sqlDate) => {
  if (!sqlDate || typeof sqlDate !== 'string') return '';

  // Extract only the date part (YYYY-MM-DD) from ISO format
  // Handles formats like "2025-12-09T00:00:00.000Z" -> "2025-12-09"
  const dateMatch = sqlDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!dateMatch) return '';

  const [, year, month, day] = dateMatch;

  if (!day || !month || !year) return '';

  return `${day}.${month}.${year}`;
};

const getStoredExamInputValue = (store, subject, componentKey = null) => {
  const value = store?.[subject];
  if (componentKey && value && typeof value === 'object' && !Array.isArray(value)) {
    return value[componentKey] || '';
  }
  return !componentKey && Number.isFinite(value) ? value : '';
};

const setStoredExamInputValue = (store, setStore, subject, componentKey, rawValue) => {
  const value = parseFloat(rawValue);
  if (rawValue === '') {
    if (componentKey) {
      const nextSubjectValue = { ...(store[subject] || {}) };
      delete nextSubjectValue[componentKey];
      setStore({ ...store, [subject]: nextSubjectValue });
    } else {
      setStore({ ...store, [subject]: '' });
    }
    return;
  }

  if (value >= 1 && value <= 6) {
    if (componentKey) {
      setStore({
        ...store,
        [subject]: {
          ...(store[subject] && typeof store[subject] === 'object' ? store[subject] : {}),
          [componentKey]: value
        }
      });
    } else {
      setStore({ ...store, [subject]: value });
    }
  }
};

const clampExamValue = (rawValue) => {
  const value = parseFloat(rawValue);
  return Number.isFinite(value) ? Math.min(6, Math.max(1, value)) : null;
};

const AuthBackdrop = ({ children, contentClassName = 'w-full max-w-xl' }) => (
  <div className="relative h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-br from-[#eef2ff] via-[#fdfbff] to-[#e5e4ff]">
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -top-12 -right-6 h-64 w-64 rounded-full bg-indigo-200/50 blur-3xl" />
      <div className="absolute -bottom-16 -left-10 h-72 w-72 rounded-full bg-purple-200/40 blur-3xl" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/20 to-transparent" />
    </div>
    <div className={`relative z-10 overflow-y-auto max-h-screen flex flex-col items-center ${contentClassName}`}>
      <div className="flex-grow flex items-center justify-center w-full">
        {children}
      </div>
      <footer className="py-6 text-center text-gray-600 text-sm flex-shrink-0">
        Made with ❤️ and 👾 by Kinomé - <a href="mailto:schulnetz2.0@kinome.one" className="text-indigo-600 hover:underline">Probleme oder Feedback</a>
      </footer>
    </div>
  </div>
);

const LoadingState = () => (
  <div className="flex flex-col items-center gap-4 rounded-3xl bg-white/80 px-8 py-10 shadow-2xl backdrop-blur">
    <div className="h-14 w-14 rounded-full border-4 border-indigo-100 border-t-indigo-500 animate-spin" aria-label="Loading" />
    <div className="text-center">
      <p className="text-lg font-semibold text-gray-900">Session wird vorbereitet…</p>
      <p className="text-sm text-gray-500">Das dauert nur einen Moment</p>
    </div>
    <div className="flex items-center gap-2">
      {[0, 150, 300].map(delay => (
        <span
          key={delay}
          className="h-2.5 w-2.5 rounded-full bg-indigo-500 animate-bounce"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  </div>
);

export default function BMGradeCalculator() {
  const { user, authLoading, signOut } = useAuth();
  const { needsOnboarding, onboardingLoading, completeOnboarding } = useOnboarding(user);

  // ============ Application state ============
  const [bmType, setBmType] = useState('TAL');
  const [currentSemester, setCurrentSemester] = useState(() => {
    // Restore semester from localStorage on mount
    try {
      const saved = localStorage.getItem('currentSemester');
      return saved ? parseInt(saved, 10) : 1;
    } catch {
      return 1;
    }
  });
  const [subjects, setSubjects] = useState({});
  const [semesterGrades, setSemesterGrades] = useState({});
  const [examSimulator, setExamSimulator] = useState({});
  const [finalExamGrades, setFinalExamGrades] = useState({});
  const [semesterPlans, setSemesterPlans] = useState({});
  const [subjectGoals, setSubjectGoals] = useState({});
  const [maturnoteGoal, setMaturnoteGoal] = useState(5.0);
  const [mainTab, setMainTab] = useState('overview');
  const [bmTab, setBmTab] = useState('current');
  const [efzTab, setEfzTab] = useState('scan-sal');
  const [showSemesterPrompt, setShowSemesterPrompt] = useState(false);
  const [efzIsAnalyzing, setEfzIsAnalyzing] = useState(false);
  const [efzAnalysisResult, setEfzAnalysisResult] = useState(null);

  // Berufsschule (EFZ) state
  const [moduleCatalog, setModuleCatalog] = useState([]);
  const [moduleGrades, setModuleGrades] = useState({});
  const [modulePlans, setModulePlans] = useState({});
  const [moduleGoals, setModuleGoals] = useState({});
  const [uekGrades, setUekGrades] = useState([]);
  const [uekPlans, setUekPlans] = useState([]);
  const [ipaGrade, setIpaGrade] = useState(null);
  const [finalGoal, setFinalGoal] = useState(5.0);
  const [uekGoal, setUekGoal] = useState(5.0);
  const [newModuleCode, setNewModuleCode] = useState('');
  const [newModuleName, setNewModuleName] = useState('');

  // State for manual entry of old semester grades (BM)
  const [bmManualSubject, setBmManualSubject] = useState('');
  const [bmManualSemester, setBmManualSemester] = useState(1);
  const [bmManualGrade, setBmManualGrade] = useState('');

  // State for manual entry of old module averages (EFZ)
  const [efzManualModuleId, setEfzManualModuleId] = useState('');
  const [efzManualModuleAverage, setEfzManualModuleAverage] = useState('');
  const [efzManualModuleSemester, setEfzManualModuleSemester] = useState(1);
  const [efzManualUekAverage, setEfzManualUekAverage] = useState('');
  const [efzManualUekTheme, setEfzManualUekTheme] = useState('');
  const [signOutPending, setSignOutPending] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);

  // EFZ module editing

  const [editingModuleCode, setEditingModuleCode] = useState(null);
  const [editingModuleForm, setEditingModuleForm] = useState({ code: '', name: '' });

  // ============ Custom hooks ============
  const validSubjects = new Set(Object.keys(LEKTIONENTAFEL[bmType] || {}));

  // Database hook
  const database = useDatabase(user);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Tutorial State
  const [runTour, setRunTour] = useState(false);
  const [isTourCompleted, setIsTourCompleted] = useState(() => {
    // Restore tour completion status from localStorage on mount
    return localStorage.getItem('schulnetz_tour_completed') === 'true';
  });
  const tourLaunchedThisSession = useRef(false); // Track if tour has been launched this session

  // Run the tour ONCE when data is loaded (only on first login/visit)
  useEffect(() => {
    console.log('🔄 Joyride check:', { dataLoaded, isTourCompleted, tourLaunched: tourLaunchedThisSession.current });

    // Only launch tour if:
    // 1. Data has loaded (user is ready)
    // 2. Tour hasn't already been launched this session
    // 3. Tour is not completed (from localStorage or DB)
    if (dataLoaded && !tourLaunchedThisSession.current && !isTourCompleted) {
      console.log('🚀 Joyride decision: launching tour');

      tourLaunchedThisSession.current = true; // Mark as launched this session
      
      // Wait a bit to let UI render
      setTimeout(() => {
        setRunTour(true);
      }, 1500);
    }
  }, [dataLoaded, isTourCompleted]);

  // Ref to track if initial data load has been attempted
  const initialLoadAttempted = useRef(false);

  const handleJoyrideCallback = async (data) => {
    const { status } = data;
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      setRunTour(false);
      localStorage.setItem('schulnetz_tour_completed', 'true');
      setIsTourCompleted(true);
      if (user && database?.updateTourCompleted) {
         try {
           console.log('💾 Saving tour completed status to DB...');
           await database.updateTourCompleted(true);
           console.log('✅ Tour completed status saved to DB');
         } catch (e) {
           console.error("Failed to save tour status to DB:", e);
         }
      }
    }
  };


  useEffect(() => {
    if (!user) {
      setDataLoaded(false);
      initialLoadAttempted.current = false;
    }
  }, [user]);

  // Load data from database on login
  useEffect(() => {
    const loadFromDatabase = async () => {
      console.log('🔍 loadFromDatabase called', { user: !!user, dataLoaded, loading: database.loading, userId: database.userId, authLoading, attempted: initialLoadAttempted.current });
      if (authLoading || !user || !database.userId || dataLoaded || database.loading || initialLoadAttempted.current) return;

      // Mark attempt to avoid multiple concurrent loads
      initialLoadAttempted.current = true;

      try {
        // Sync user first
        console.log('🔄 Syncing user...');
        const userData = await database.syncUser(bmType);
        console.log('✅ User synced:', userData);
        if (userData) {
          setBmType(userData.bm_type || 'TAL');
          // For semester: use DB value, but fallback to current localStorage value
          setCurrentSemester(userData.current_semester || parseInt(localStorage.getItem('currentSemester') || '1', 10));
          setMaturnoteGoal(parseFloat(userData.maturanote_goal) || 5.0);
          setShowSemesterPrompt(Boolean(userData.needsSemesterSetup));
          // For tour: respect if completed in DB OR localStorage
          const tourCompletedInDb = userData.tour_completed || false;
          const tourCompletedInLocal = localStorage.getItem('schulnetz_tour_completed') === 'true';
          setIsTourCompleted(tourCompletedInDb || tourCompletedInLocal);
        }

        // Load grades and convert to subjects format
        console.log('📚 Loading grades...');
        const grades = await database.getUserGrades();
        console.log('📚 Grades loaded:', grades);
        if (grades && grades.length > 0) {
          const subjectsFromDb = {};
          grades.forEach(g => {
            if (!subjectsFromDb[g.subject_name]) {
              subjectsFromDb[g.subject_name] = [];
            }

            // Parse weight as number and format without unnecessary decimals
            const weight = parseFloat(g.weight);
            const displayWeight = Number.isInteger(weight) ? weight.toString() : weight.toFixed(2).replace(/\.?0+$/, '');

            subjectsFromDb[g.subject_name].push({
              id: g.id,
              grade: parseFloat(g.grade),
              weight: weight,
              displayWeight: displayWeight,
              date: g.control_date ? sqlDateToSwiss(g.control_date) : '',
              name: g.control_name
            });
          });
          setSubjects(subjectsFromDb);
        }

        // Load semester grades
        const semGrades = await database.getUserSemesterGrades();
        if (semGrades && semGrades.length > 0) {
          const semGradesFromDb = {};
          semGrades.forEach(g => {
            if (!semGradesFromDb[g.subject_name]) {
              semGradesFromDb[g.subject_name] = {};
            }
            const semesterKey = String(g.semester_number || g.semester || '');
            if (semesterKey) {
              semGradesFromDb[g.subject_name][semesterKey] = parseFloat(g.grade);
            }
          });
          setSemesterGrades(semGradesFromDb);
        }

        // Load semester plans
        const plans = await database.getUserSemesterPlans();
        if (plans && plans.length > 0) {
          const plansFromDb = {};
          plans.forEach(p => {
            if (!plansFromDb[p.subject_name]) {
              plansFromDb[p.subject_name] = [];
            }
            plansFromDb[p.subject_name].push({
              id: p.id,
              grade: parseFloat(p.planned_grade),
              weight: parseFloat(p.weight)
            });
          });
          setSemesterPlans(plansFromDb);
        }

        // Load subject goals
        const goals = await database.getUserSubjectGoals();
        if (goals && goals.length > 0) {
          const goalsFromDb = {};
          goals.forEach(g => {
            goalsFromDb[g.subject_name] = parseFloat(g.target_grade);
          });
          setSubjectGoals(goalsFromDb);
        }

        // Load exam simulator
        const exams = await database.getUserExamGrades();
        const examsFromDb = {};
        const finalExamsFromDb = {};
        if (exams && exams.length > 0) {
          exams.forEach(e => {
            const simulatedGrade = parseFloat(e.simulated_grade);
            const finalGrade = parseFloat(e.final_grade);
            if (Number.isFinite(simulatedGrade)) {
              examsFromDb[e.subject_name] = simulatedGrade;
            }
            if (Number.isFinite(finalGrade)) {
              finalExamsFromDb[e.subject_name] = finalGrade;
            }
          });
        }
        setExamSimulator(examsFromDb);
        setFinalExamGrades(finalExamsFromDb);

        // Load EFZ / Berufsschule data if available
        try {
          // Load modules from ALL semesters (1-8) to ensure manually added modules are not lost
          // Previously only loaded up to current semester, which missed modules added to future semesters
          console.log('🔍 Loading EFZ modules for semesters 1-8');

          // Load modules from all semesters for "Alte Zeugnisse"
          const allModules = [];
          for (let s = 1; s <= 8; s++) {
            try {
              const semModules = await database.getUserEfzModules(s);
              console.log(`📦 Semester ${s} modules:`, semModules?.length || 0);
              if (semModules && semModules.length) {
                allModules.push(...semModules);
              }
            } catch (err) {
              console.warn(`⚠️ Failed to load modules for semester ${s}:`, err.message || err);
            }
          }

          console.log(`✅ Total modules loaded: ${allModules.length}`);

          if (allModules && allModules.length) {
            // Map to local catalog with efz_id and semester
            const catalog = allModules.map(m => ({
              code: m.module_code,
              name: m.name,
              efz_id: m.id,
              semester: m.semester
            }));
            setModuleCatalog(catalog);
            console.log('📋 Module catalog set:', catalog);

            // Load module grades per module
            const gradesByModule = {};
            for (const m of catalog) {
              try {
                const grades = await database.getEfzModuleGrades(m.efz_id);
                console.log(`📊 Module ${m.code}: ${grades?.length || 0} grades`);
                gradesByModule[m.code] = (grades || []).map(g => ({
                  id: g.id,
                  grade: parseFloat(g.grade),
                  weight: parseFloat(g.weight || 1),
                  displayWeight: g.weight ? String(g.weight) : '1',
                  date: g.date ? sqlDateToSwiss(g.date) : '',
                  name: g.control_name || '',
                  semester: g.semester || m.semester || currentSemester,
                  source: g.source || 'manual'
                }));
              } catch (err) {
                console.warn(`⚠️ Failed to load grades for module ${m.code}:`, err.message || err);
              }
            }
            setModuleGrades(gradesByModule);
            console.log('✅ Module grades set:', gradesByModule);

            // Save EFZ data to localStorage as backup
            try {
              const existing = storage.get('bm-calculator-data', {});
              storage.set('bm-calculator-data', {
                ...existing,
                moduleCatalog: catalog,
                moduleGrades: gradesByModule
              });
              console.log('💾 EFZ data saved to localStorage');
            } catch (err) {
              console.warn('⚠️ Failed to save EFZ data to localStorage:', err.message || err);
            }
          } else {
            console.log('ℹ️ No modules found in database, trying localStorage...');
            // Fallback to localStorage
            try {
              const saved = storage.get('bm-calculator-data', {});
              if (saved.moduleCatalog && saved.moduleCatalog.length > 0) {
                setModuleCatalog(saved.moduleCatalog);
                setModuleGrades(saved.moduleGrades || {});
                console.log('✅ EFZ data loaded from localStorage backup');
              }
            } catch (err) {
              console.warn('⚠️ Failed to load EFZ data from localStorage:', err.message || err);
            }
          }

          try {
            const ueks = await database.getEfzUekGrades();
            console.log(`📚 üK grades loaded: ${ueks?.length || 0}`);
            if (ueks && ueks.length) {
              setUekGrades(ueks.map(g => ({ id: g.id, grade: parseFloat(g.grade), weight: 1, displayWeight: '1', date: g.date ? sqlDateToSwiss(g.date) : '', name: g.name })));
              // Save to localStorage
              try {
                const existing = storage.get('bm-calculator-data', {});
                storage.set('bm-calculator-data', { ...existing, uekGrades: ueks });
              } catch (err) {
                console.warn('⚠️ Failed to save üK to localStorage:', err.message || err);
              }
            }
          } catch (err) {
            console.warn('⚠️ Failed to load üK grades:', err.message || err);
            // Try localStorage
            try {
              const saved = storage.get('bm-calculator-data', {});
              if (saved.uekGrades && saved.uekGrades.length > 0) {
                setUekGrades(saved.uekGrades);
                console.log('✅ üK grades loaded from localStorage');
              }
            } catch (err) {
              console.warn('⚠️ Failed to load üK from localStorage:', err.message || err);
            }
          }

          try {
            const ipas = await database.getEfzIpa();
            console.log(`🎓 IPA grades loaded: ${ipas?.length || 0}`);
            if (ipas && ipas.length) {
              // take latest final if exists
              const final = ipas.find(i => i.is_final) || ipas[0];
              if (final) setIpaGrade(parseFloat(final.grade));
              // Save to localStorage
              try {
                const existing = storage.get('bm-calculator-data', {});
                storage.set('bm-calculator-data', { ...existing, ipaGrade: parseFloat(final?.grade) });
              } catch (err) {
                console.warn('⚠️ Failed to save IPA to localStorage:', err.message || err);
              }
            }
          } catch (err) {
            console.warn('⚠️ Failed to load IPA grade:', err.message || err);
            // Try localStorage
            try {
              const saved = storage.get('bm-calculator-data', {});
              if (Number.isFinite(saved.ipaGrade)) {
                setIpaGrade(saved.ipaGrade);
                console.log('✅ IPA grade loaded from localStorage');
              }
            } catch (err) {
              console.warn('⚠️ Failed to load IPA from localStorage:', err.message || err);
            }
          }
        } catch (err) {
          console.error('❌ EFZ load error:', err);
        }

        // Mark data as loaded AFTER all data (BM and EFZ) has been fully loaded
        setDataLoaded(true);
      } catch (err) {
        console.error('Error loading data from database:', err);
        // Fallback to localStorage
        setDataLoaded(true);
      }
    };

    loadFromDatabase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, database.userId, dataLoaded, authLoading]);

  // Fallback: Load from localStorage if not logged in
  useLoadData({
    setSubjects,
    setSemesterGrades,
    setBmType,
    setCurrentSemester,
    setSemesterPlans,
    setSubjectGoals,
    setMaturnoteGoal,
    setModuleCatalog,
    setModuleGrades,
    setModulePlans,
    setModuleGoals,
    setUekGrades,
    setUekPlans,
    setIpaGrade,
    setFinalGoal,
    setUekGoal,
    setFinalExamGrades
  }, !authLoading && !user);

  // Auto-save to localStorage (backup)
  useSaveData({
    subjects,
    semesterGrades,
    bmType,
    currentSemester,
    semesterPlans,
    subjectGoals,
    maturnoteGoal,
    moduleCatalog,
    moduleGrades,
    modulePlans,
    moduleGoals,
    uekGrades,
    uekPlans,
    ipaGrade,
    finalGoal,
    uekGoal,
    finalExamGrades
  });

  const normalizeNumber = (value, fallback = null) => {
    if (value === null || value === undefined || value === '') return fallback;
    const cleaned = String(value).replace(',', '.');
    const parsed = parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const normalizeSemesterValue = (value, fallback) => {
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1) return fallback;
    return parsed;
  };
  const clampGrade = (value) => {
    const n = normalizeNumber(value);
    if (n === null) return null;
    return Math.min(6, Math.max(1, n));
  };

  const clearEfzMessage = () => {
    setEfzAnalysisResult(prev => {
      if (!prev || !prev.message) return prev;
      const { message: _message, ...rest } = prev;
      return Object.keys(rest).length > 0 ? rest : null;
    });
  };

  // Auto-hide EFZ success message after 20s or when switching tabs
  useEffect(() => {
    clearEfzMessage();
  }, [efzTab, mainTab]);

  useEffect(() => {
    if (!efzAnalysisResult?.message) return;
    const t = window.setTimeout(() => clearEfzMessage(), 20000);
    return () => window.clearTimeout(t);
  }, [efzAnalysisResult?.message]);

  // Database persistence functions
  const addControlToDatabase = async (subject, grade, weight, date = null, name = null) => {
    console.log('💾 addControlToDatabase called', { user: !!user, userId: database.userId, subject, grade, weight, date, name });
    if (!user) {
      console.error('❌ Not authenticated - user is null');
      throw new Error('Not authenticated');
    }
    if (!database.userId) {
      console.error('❌ No userId - database.userId is', database.userId);
      throw new Error('No userId available');
    }

    try {
      const normalizedGrade = clampGrade(grade);
      const normalizedWeight = normalizeNumber(weight, 1) ?? 1;

      const sqlDate = date ? swissDateToSQL(date) : '';
      console.log('📅 Date conversion:', { input: date, output: sqlDate });

      if (normalizedGrade === null) {
        console.log('⚠️ Invalid grade, skipping DB save');
        throw new Error('Invalid grade value');
      }

      console.log('📤 About to call database.addGrade with:', { subject, normalizedGrade, normalizedWeight, currentSemester, name, sqlDate });
      const result = await database.addGrade(
        subject,
        normalizedGrade,
        normalizedWeight,
        currentSemester,
        name,
        sqlDate
      );
      console.log('✅ Grade saved to DB successfully:', result);
      return result;
    } catch (err) {
      console.error('❌ Error saving grade to database:', err);
      throw err;
    }
  };

  const saveBulletinToDatabase = async (subject, semester, grade) => {
    console.log('💾 saveBulletinToDatabase called', { user: !!user, userId: database.userId, subject, semester, grade });
    if (!user) {
      console.error('❌ Not authenticated - user is null');
      throw new Error('Not authenticated');
    }
    if (!database.userId) {
      console.error('❌ No userId - database.userId is', database.userId);
      throw new Error('No userId available');
    }

    try {
      console.log('📤 About to call database.setSemesterGrade with:', { subject, semester, grade });
      const result = await database.setSemesterGrade(subject, semester, grade);
      console.log('✅ Semester grade saved to DB successfully:', result);
      return result;
    } catch (err) {
      console.error('❌ Error saving bulletin grade to database:', err);
      throw err;
    }
  };

  // Zeugniss analysis
  const {
    isAnalyzing,
    analysisResult,
    handleFileUpload,
    resetAnalysis
  } = useBulletinAnalysis(
    subjects,
    setSubjects,
    semesterGrades,
    setSemesterGrades,
    validSubjects,
    currentSemester,
    addControlToDatabase,
    saveBulletinToDatabase
  );

  // Calculations
  const calculations = useGradeCalculations(
    subjects,
    semesterGrades,
    semesterPlans,
    examSimulator,
    bmType,
    finalExamGrades
  );

  // Create apprenticeship calculations for current semester and previous semesters
  
  // Filter module grades to only show current semester for calculations
  const filterModuleGradesBySemester = (grades, targetSemester) => {
    if (!Array.isArray(grades)) return [];
    return grades.filter(g => (g.semester || currentSemester) === targetSemester);
  };

  const moduleGradesCurrentSemesterOnly = Object.fromEntries(
    Object.entries(moduleGrades).map(([code, grades]) => [
      code,
      filterModuleGradesBySemester(grades, currentSemester)
    ])
  );

  const apprenticeshipCalculations = useApprenticeshipCalculations(
    moduleGradesCurrentSemesterOnly,
    modulePlans,
    uekGrades,
    uekPlans,
    ipaGrade
  );

  // Create apprenticeship calculations for ALL semesters (for final grade calculations)
  const apprenticeshipCalculationsAllSemesters = useApprenticeshipCalculations(
    moduleGrades,
    modulePlans,
    uekGrades,
    uekPlans,
    ipaGrade
  );

  // Reset analysis when tab changes
  useEffect(() => {
    resetAnalysis();
  }, [bmTab, resetAnalysis]);

  const handleSemesterSelect = async (semester) => {
    setCurrentSemester(semester);
    storage.set('currentSemester', semester);
    if (user && database.userId) {
      try {
        await database.updateSemester(semester);
      } catch (err) {
        console.error('Error saving current semester:', err);
      }
    }
    setShowSemesterPrompt(false);
  };

  const handleSignOut = async () => {
    if (signOutPending) return;

    setSignOutPending(true);
    try {
      await signOut();
    } finally {
      setSignOutPending(false);
    }
  };

  const getFirstName = (profileUser) => {
    const fallbackName = profileUser?.user_metadata?.display_name
      || profileUser?.user_metadata?.full_name
      || profileUser?.email?.split('@')[0]
      || '';
    return fallbackName.trim().split(/\s+/)[0] || fallbackName.trim() || 'du';
  };

  const normalizeModuleCode = (rawSubject) => {
    const cleaned = String(rawSubject || '').trim();
    if (!cleaned) return '';
    const compact = cleaned.replace(/\s+/g, ' ').toUpperCase();
    const explicit = compact.match(/\bM\d{3}[A-Z]?\b/);
    if (explicit) return explicit[0];
    const generic = compact.match(/\b[A-Z]{1,4}\d{2,3}\b/);
    if (generic) return generic[0];
    return compact;
  };

  const extractModuleName = (rawSubject, explicitName = '') => {
    const provided = String(explicitName || '').trim();
    if (provided) return provided;

    const raw = String(rawSubject || '').trim();
    const withoutCode = raw
      .replace(/\b(?:module|modul)\s*/i, '')
      .replace(/\bM?\d{3}[A-Z]?\b/i, '')
      .replace(/^[-–—:|/\\\s]+|[-–—:|/\\\s]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return withoutCode && withoutCode !== raw ? withoutCode : '';
  };

  const addOrMergeModuleGrade = async (moduleCode, moduleName, grade, weight = 1, date = '', name = '', source = 'import', semester = null) => {
    const code = normalizeModuleCode(moduleCode);
    const normalizedGrade = clampGrade(grade);
    if (!code || normalizedGrade === null) return false;

    // Use provided semester or fall back to current semester
    const targetSemester = semester !== null ? semester : currentSemester;

    const normalizedDate = date ? formatSwissDate(date) : '';
    const parsedWeight = apprenticeshipCalculations.parseWeight(weight);
    const normalizedWeight = Number.isFinite(parsedWeight) ? parsedWeight : 1;
    const normalizedName = (name || '').trim();

    let moduleEntry = moduleCatalog.find(m => m.code === code);
    let efzId = moduleEntry?.efz_id || null;

    if (!moduleEntry) {
      if (user && database.userId && database.addEfzModule) {
        try {
          const created = await database.addEfzModule({ module_code: code, name: moduleName || '', semester: targetSemester });
          efzId = created?.id || null;
        } catch (err) {
          console.warn('Failed to create EFZ module from scan:', err.message || err);
        }
      }

      setModuleCatalog(prev => {
        if (prev.some(m => m.code === code)) return prev;
        return [...prev, { code, name: moduleName || '', efz_id: efzId, semester: targetSemester }];
      });
      setModuleGrades(prev => (prev[code] ? prev : { ...prev, [code]: [] }));
      setModulePlans(prev => (prev[code] ? prev : { ...prev, [code]: [] }));
      setModuleGoals(prev => (prev[code] ? prev : { ...prev, [code]: 5.0 }));
    } else if (!moduleEntry.name && moduleName) {
      if (user && database.userId && database.addEfzModule) {
        try {
          await database.addEfzModule({ module_code: code, name: moduleName, semester: moduleEntry.semester || targetSemester });
        } catch (err) {
          console.warn('Failed to update EFZ module name from scan:', err.message || err);
        }
      }

      setModuleCatalog(prev => prev.map(m => (
        m.code === code ? { ...m, name: moduleName } : m
      )));
    }

    const existingGrades = moduleGrades[code] || [];
    const isDuplicate = existingGrades.some(g => {
      const storedDate = g.date ? formatSwissDate(g.date) : '';
      const storedGradeDiff = Math.abs(parseFloat(g.grade) - normalizedGrade);
      const sameSemester = (g.semester || currentSemester) === targetSemester;
      const sameName = (g.name || '').trim() === normalizedName;
      const sameDate = storedDate === normalizedDate;

      // For "Zeugnis" imports, check if it's essentially the same record
      // Same source + same name + same semester = likely duplicate
      const isImportedAverage = (source === 'import' || source === 'import') && 
                                (g.source === 'import' || g.source === 'import');
      const isAverageName = (normalizedName || '').toLowerCase().includes('zeugnis') || 
                           (normalizedName || '').toLowerCase().includes('durchschnitt');
      const isStoredAverageName = (g.name || '').toLowerCase().includes('zeugnis') || 
                                 (g.name || '').toLowerCase().includes('durchschnitt');

      // Strong duplicate: Same type + name + semester + similar grade
      if (isImportedAverage && isAverageName && isStoredAverageName && sameSemester && sameName && storedGradeDiff < 0.5) {
        return true;
      }

      // Exact duplicate: All details match
      return storedGradeDiff < 0.01 && sameDate && sameName && sameSemester;
    });

    if (isDuplicate) return false;

    const tempId = Date.now() + Math.random();
    const localGrade = {
      id: tempId,
      grade: normalizedGrade,
      weight: normalizedWeight,
      displayWeight: String(weight || normalizedWeight),
      date: normalizedDate,
      name: normalizedName,
      source,
      semester: targetSemester
    };

    setModuleGrades(prev => ({
      ...prev,
      [code]: [...(prev[code] || []), localGrade]
    }));

    if (user && database.userId && efzId && database.addEfzModuleGrade) {
      try {
        const created = await database.addEfzModuleGrade({
          module_id: efzId,
          grade: normalizedGrade,
          weight: normalizedWeight,
          date: normalizedDate ? swissDateToSQL(normalizedDate) : null,
          control_name: normalizedName || null,
          source,
          semester: targetSemester
        });
        if (created?.id) {
          setModuleGrades(prev => ({
            ...prev,
            [code]: (prev[code] || []).map(g => (g.id === tempId ? { ...g, id: created.id } : g))
          }));
        }
      } catch (err) {
        console.warn('Failed to save EFZ module grade from scan:', err.message || err);
      }
    }

    return true;
  };

  const handleEfzSalUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setEfzAnalysisResult({ error: 'Nur Bilder (JPG, PNG) sind fürs SAL-Scanne erlaubt.' });
      return;
    }

    try {
      setEfzIsAnalyzing(true);
      setEfzAnalysisResult(null);
      const result = await analyzeBulletin(file, 'EFZ_SAL');

      const controls = Array.isArray(result?.controls) ? result.controls : [];
      let addedModules = 0;
      let addedUek = 0;

      for (const control of controls) {
        const rawSubject = String(control.subject || '').trim();
        if (!rawSubject) continue;
        const normalizedGrade = normalizeNumber(control.grade);
        if (normalizedGrade === null) continue;

        if (/\buek\b|\bük\b/i.test(rawSubject)) {
          addUekGrade(
            'ueK',
            normalizedGrade,
            1,
            control.date ? formatSwissDate(control.date) : '',
            control.name || 'SAL'
          );
          addedUek += 1;
          continue;
        }

        const moduleCode = normalizeModuleCode(rawSubject);
        const moduleName = extractModuleName(rawSubject, control.moduleName || control.module_name || control.module);
        const wasAdded = await addOrMergeModuleGrade(
          moduleCode,
          moduleName,
          normalizedGrade,
          control.weight || 1,
          control.date,
          control.name || 'SAL',
          'import'
        );
        if (wasAdded) addedModules += 1;
      }

      setEfzAnalysisResult({
        message: `${addedModules} Modulnote(n) hinzugefügt, ${addedUek} üK-Note(n) hinzugefügt.`
      });
    } catch (error) {
      console.error('EFZ SAL analysis error:', error);
      setEfzAnalysisResult({ error: 'Fehler bei der SAL-Analyse.' });
    } finally {
      setEfzIsAnalyzing(false);
      e.target.value = '';
    }
  };

  const handleEfzBulletinUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!(file.type.startsWith('image/') || file.type === 'application/pdf')) {
      setEfzAnalysisResult({ error: 'Formats acceptes: image (JPG, PNG) ou PDF.' });
      return;
    }

    try {
      setEfzIsAnalyzing(true);
      setEfzAnalysisResult(null);
      const result = await analyzeBulletin(file, 'EFZ_BULLETIN');
      const semesters = Array.isArray(result?.semesters)
        ? result.semesters
        : (result?.grades ? [{ semester: result.semester || currentSemester, grades: result.grades }] : []);

      let addedModules = 0;
      let addedUek = 0;
      for (const semesterData of semesters) {
        const semester = semesterData?.semester || currentSemester;
        const grades = semesterData?.grades || {};
        for (const [moduleRaw, grade] of Object.entries(grades)) {
          const normalizedGrade = clampGrade(grade);
          if (normalizedGrade === null) continue;

          // Check if this is a üK entry
          if (/\buek\b|\bük\b/i.test(moduleRaw)) {
            addUekGrade(
              'ueK',
              normalizedGrade,
              1,
              '',
              `Zeugnis S${semester}`
            );
            addedUek += 1;
            continue;
          }

          // Otherwise treat as a module
          const moduleCode = normalizeModuleCode(moduleRaw);
          const moduleName = extractModuleName(moduleRaw);
          if (!moduleCode) continue;

          const wasAdded = await addOrMergeModuleGrade(
            moduleCode,
            moduleName,
            normalizedGrade,
            1,
            '',
            `Zeugnis S${semester}`,
            'import',
            semester
          );
          if (wasAdded) addedModules += 1;
        }
      }

      const message = addedModules > 0 && addedUek > 0
        ? `${addedModules} Modul(e) und ${addedUek} üK-Note(n) aus alten Zeugnissen hinzugefügt.`
        : addedModules > 0
        ? `${addedModules} Modul(e) aus alten Zeugnissen hinzugefügt.`
        : addedUek > 0
        ? `${addedUek} üK-Note(n) aus alten Zeugnissen hinzugefügt.`
        : 'Keine neuen Daten hinzugefügt.';

      setEfzAnalysisResult({ message });
    } catch (error) {
      console.error('EFZ bulletin analysis error:', error);
      setEfzAnalysisResult({ error: 'Fehler bei der Analyse des Berufsschul-Zeugnisses.' });
    } finally {
      setEfzIsAnalyzing(false);
      e.target.value = '';
    }
  };

  // Conditional rendering after all hooks
  if (authLoading || onboardingLoading) {
    return (
      <AuthBackdrop contentClassName="w-full max-w-sm">
        <LoadingState />
      </AuthBackdrop>
    );
  }
  if (!user) {
    return (
      <AuthBackdrop>
        <AuthPanel />
      </AuthBackdrop>
    );
  }

  // Display onboarding setup if necessary
  if (needsOnboarding) {
    return (
      <OnboardingSetup
        onComplete={async ({ currentSemester, bmType }) => {
          await completeOnboarding({ currentSemester, bmType });
          setBmType(bmType);
          setCurrentSemester(currentSemester);
        }}
      />
    );
  }

  // Display semester prompt if necessary
  if (showSemesterPrompt) {
    return <SemesterPrompt onSelectSemester={handleSemesterSelect} />;
  }

  // ============ Management functions ============
  const addGrade = async (subject, grade, weight, date = null, name = null) => {
    const normalizedGrade = normalizeNumber(grade);
    const normalizedWeight = normalizeNumber(weight, 1) ?? 1;
    const normalizedDate = date ? formatSwissDate(date) : '';
    const normalizedName = name ? name.trim() : null;

    if (normalizedGrade === null) {
      console.log('⚠️ Invalid grade, skipping save');
      return;
    }

    // Check for duplicates: same subject, grade, date, and name
    const existingGrades = subjects[subject] || [];
    const isDuplicate = existingGrades.some(g => {
      const storedDate = g.date ? formatSwissDate(g.date) : '';
      return (
        Math.abs(g.grade - normalizedGrade) < 0.01 &&
        storedDate === normalizedDate &&
        (g.name || '').trim() === (normalizedName || '')
      );
    });

    if (isDuplicate) {
      console.log('⚠️ Duplicate grade detected, skipping:', { subject, grade, date, name });
      return;
    }

    const newGrade = {
      id: Date.now(),
      grade: normalizedGrade,
      weight: normalizedWeight,
      displayWeight: normalizedWeight.toString(),
      date: normalizedDate,
      name: normalizedName
    };

    setSubjects(prev => ({
      ...prev,
      [subject]: [...(prev[subject] || []), newGrade]
    }));

    // Save to database
    await addControlToDatabase(subject, normalizedGrade, normalizedWeight, normalizedDate, normalizedName);
  };

  const removeGrade = async (subject, gradeId) => {
    setSubjects(prev => ({
      ...prev,
      [subject]: (prev[subject] || []).filter(g => g.id !== gradeId)
    }));

    // Remove from database
    if (user && database.userId) {
      try {
        await database.removeGrade(gradeId);
      } catch (err) {
        console.error('Error removing grade from database:', err);
      }
    }
  };

  const addPlannedControl = async (subject, grade, weight) => {
    const plan = {
      id: Date.now(),
      grade: parseFloat(grade),
      weight: parseFloat(weight)
    };
    setSemesterPlans(prev => ({
      ...prev,
      [subject]: [...(prev[subject] || []), plan]
    }));

    // Save to database
    if (user && database.userId) {
      try {
        await database.addSemesterPlan(subject, currentSemester, grade, weight);
      } catch (err) {
        console.error('Error saving plan to database:', err);
      }
    }
  };

  const removePlannedControl = async (subject, id) => {
    setSemesterPlans(prev => ({
      ...prev,
      [subject]: (prev[subject] || []).filter(p => p.id !== id)
    }));

    // Remove from database
    if (user && database.userId) {
      try {
        await database.removeSemesterPlan(id);
      } catch (err) {
        console.error('Error removing plan from database:', err);
      }
    }
  };

  const addModule = async () => {
    const code = normalizeModuleCode(newModuleCode);
    const name = newModuleName.trim();
    if (!code) return;

    // Persist to EFZ DB when possible
    let efzId = null;
    if (user && database.userId && database.addEfzModule) {
      try {
        const created = await database.addEfzModule({ module_code: code, name, semester: currentSemester });
        efzId = created?.id || null;
      } catch (err) {
        console.warn('Failed to create EFZ module in DB:', err.message || err);
      }
    }

    setModuleCatalog(prev => {
      if (prev.some(m => m.code === code)) return prev;
      return [{ code, name, efz_id: efzId, semester: currentSemester }, ...prev];
    });

    setModuleGrades(prev => (prev[code] ? prev : { ...prev, [code]: [] }));
    setModulePlans(prev => (prev[code] ? prev : { ...prev, [code]: [] }));
    setModuleGoals(prev => (prev[code] ? prev : { ...prev, [code]: 5.0 }));

    setNewModuleCode('');
    setNewModuleName('');
  };

  const saveModuleEdit = async () => {
    if (!editingModuleCode) return;
    const newCode = editingModuleForm.code.trim().toUpperCase();
    const newName = editingModuleForm.name.trim();
    if (!newCode) return;

    if (newCode !== editingModuleCode) {
      // Code changed - rename the module
      setModuleGrades(prev => {
        const oldData = prev[editingModuleCode];
        const newData = { ...prev };
        delete newData[editingModuleCode];
        if (oldData) newData[newCode] = oldData;
        return newData;
      });
      setModulePlans(prev => {
        const oldData = prev[editingModuleCode];
        const newData = { ...prev };
        delete newData[editingModuleCode];
        if (oldData) newData[newCode] = oldData;
        return newData;
      });
      setModuleGoals(prev => {
        const oldData = prev[editingModuleCode];
        const newData = { ...prev };
        delete newData[editingModuleCode];
        if (oldData) newData[newCode] = oldData;
        return newData;
      });
    }

    // Update module catalog
    setModuleCatalog(prev =>
      prev.map(m =>
        m.code === editingModuleCode
          ? { ...m, code: newCode, name: newName }
          : m
      )
    );

    setEditingModuleCode(null);
    setEditingModuleForm({ code: '', name: '' });
  };

  const addModuleGrade = async (moduleId, grade, weight, date = null, name = null, semester = null) => {
    const normalizedGrade = clampGrade(grade);
    const parsedWeight = apprenticeshipCalculations.parseWeight(weight);
    const normalizedWeight = Number.isFinite(parsedWeight) ? parsedWeight : 1;
    const normalizedDate = date ? formatSwissDate(date) : '';
    const normalizedName = name ? name.trim() : null;
    const targetSemester = semester !== null ? semester : currentSemester;

    if (normalizedGrade === null) return;

    const existingGrades = moduleGrades[moduleId] || [];
    const isDuplicate = existingGrades.some(g => {
      const storedDate = g.date ? formatSwissDate(g.date) : '';
      return (
        Math.abs(g.grade - normalizedGrade) < 0.01 &&
        storedDate === normalizedDate &&
        (g.name || '').trim() === (normalizedName || '') &&
        (g.semester || currentSemester) === targetSemester
      );
    });

    if (isDuplicate) return;

    const displayWeight = typeof weight === 'string' && weight.trim() !== ''
      ? weight.trim()
      : normalizedWeight.toString();

    const newGrade = {
      id: Date.now(),
      grade: normalizedGrade,
      weight: normalizedWeight,
      displayWeight,
      date: normalizedDate,
      name: normalizedName,
      source: 'manual',
      semester: targetSemester
    };

    setModuleGrades(prev => ({
      ...prev,
      [moduleId]: [...(prev[moduleId] || []), newGrade]
    }));

    // Persist to EFZ DB if module has efz_id
    try {
      const moduleEntry = moduleCatalog.find(m => m.code === moduleId);
      const efzId = moduleEntry?.efz_id;
      if (user && database.userId && efzId && database.addEfzModuleGrade) {
        const sqlDate = date ? swissDateToSQL(date) : null;
        const created = await database.addEfzModuleGrade({ module_id: efzId, grade: normalizedGrade, weight: normalizedWeight, date: sqlDate, control_name: normalizedName, source: 'manual', semester: targetSemester });
        if (created && created.id) {
          // Replace temporary id with DB id
          setModuleGrades(prev => ({
            ...prev,
            [moduleId]: (prev[moduleId] || []).map(g => g.id === newGrade.id ? { ...g, id: created.id } : g)
          }));
        }
      }
    } catch (err) {
      console.warn('Error saving module grade to EFZ DB:', err.message || err);
    }
  };

  const removeModuleGrade = (moduleId, gradeId) => {
    setModuleGrades(prev => ({
      ...prev,
      [moduleId]: (prev[moduleId] || []).filter(g => g.id !== gradeId)
    }));

    // Attempt to remove from EFZ DB when possible
    try {
      const moduleEntry = moduleCatalog.find(m => m.code === moduleId);
      const efzId = moduleEntry?.efz_id;
      if (user && database.userId && efzId && database.removeEfzModuleGrade) {
        database.removeEfzModuleGrade(gradeId).catch(err => console.warn('Error removing module grade from EFZ DB:', err.message || err));
      }
    } catch (err) {
      console.warn('Error during EFZ module grade removal:', err.message || err);
    }
  };

  const addModulePlan = (moduleId, grade, weight) => {
    const parsedWeight = apprenticeshipCalculations.parseWeight(weight);
    if (!Number.isFinite(parsedWeight)) return;
    const normalizedGrade = clampGrade(grade);
    if (normalizedGrade === null) return;

    const plan = {
      id: Date.now(),
      grade: normalizedGrade,
      weight: parsedWeight
    };

    setModulePlans(prev => ({
      ...prev,
      [moduleId]: [...(prev[moduleId] || []), plan]
    }));
  };

  const removeModulePlan = (moduleId, id) => {
    setModulePlans(prev => ({
      ...prev,
      [moduleId]: (prev[moduleId] || []).filter(p => p.id !== id)
    }));
  };

  const addUekGrade = (_subject, grade, _weight, date = null, name = null) => {
    const normalizedGrade = clampGrade(grade);
    const normalizedDate = date ? formatSwissDate(date) : '';
    const normalizedName = name ? name.trim() : null;

    if (normalizedGrade === null) return;

    const existingGrades = uekGrades || [];
    const isDuplicate = existingGrades.some(g => {
      const storedDate = g.date ? formatSwissDate(g.date) : '';
      return (
        Math.abs(g.grade - normalizedGrade) < 0.01 &&
        storedDate === normalizedDate &&
        (g.name || '').trim() === (normalizedName || '')
      );
    });

    if (isDuplicate) return;

    const newGrade = {
      id: Date.now(),
      grade: normalizedGrade,
      weight: 1,
      displayWeight: '1',
      date: normalizedDate,
      name: normalizedName,
      source: normalizedName?.startsWith('Zeugniss') || normalizedName === 'SAL' ? 'import' : 'manual'
    };

    setUekGrades(prev => ([...(prev || []), newGrade]));
    // Persist to EFZ DB
    try {
      if (user && database.userId && database.addEfzUekGrade) {
        const sqlDate = date ? swissDateToSQL(date) : null;
        database.addEfzUekGrade({ grade: normalizedGrade, name: normalizedName, date: sqlDate });
      }
    } catch (err) {
      console.warn('Error saving ueK grade to EFZ DB:', err.message || err);
    }
  };

  const removeUekGrade = (_subject, gradeId) => {
    setUekGrades(prev => (prev || []).filter(g => g.id !== gradeId));
    if (user && database.userId && database.removeEfzUekGrade) {
      database.removeEfzUekGrade(gradeId).catch(err => console.warn('Error removing ueK grade from EFZ DB:', err.message || err));
    }
  };

  const getSubjectsForSemester = (semester) => {
    const allSubjects = [
      ...BM_SUBJECTS[bmType].grundlagen,
      ...BM_SUBJECTS[bmType].schwerpunkt,
      ...BM_SUBJECTS[bmType].erganzung,
      ...BM_SUBJECTS[bmType].interdisziplinar
    ];
    return allSubjects.filter(subject => {
      const semesters = LEKTIONENTAFEL[bmType][subject];
      return semesters && semesters.includes(semester);
    });
  };

  const calculateRequiredGradeWithPlans = (subject, targetAverage, assumedWeight = 1) => {
    const baseGrades = subjects[subject] || [];
    const planned = (semesterPlans[subject] || []).map(p => ({
      grade: parseFloat(p.grade),
      weight: calculations.parseWeight(p.weight ?? 1)
    }));
    const all = [...baseGrades, ...planned]
      .map(g => ({
        grade: parseFloat(g.grade),
        weight: calculations.parseWeight(g.weight ?? 1)
      }))
      .filter(g => Number.isFinite(g.grade) && Number.isFinite(g.weight) && g.weight > 0);
    if (all.length === 0) return null;
    const parsedAssumedWeight = calculations.parseWeight(assumedWeight);
    if (!Number.isFinite(parsedAssumedWeight) || parsedAssumedWeight <= 0) return null;

    // Convert rounded goal to real goal (e.g.: 6 → 5.75, 5 → 4.75)
    // This ensures the raw average rounds UP to the target when rounded to nearest 0.5
    const realTarget = targetAverage - 0.25;

    const currentTotalWeight = all.reduce((sum, g) => sum + g.weight, 0);
    const currentSum = all.reduce((sum, g) => sum + (g.grade * g.weight), 0);
    const required = (realTarget * (currentTotalWeight + parsedAssumedWeight) - currentSum) / parsedAssumedWeight;
    
    // Clamp result to valid grade range [1.0, 6.0]
    return Math.max(1.0, Math.min(6.0, Math.round(required * 10) / 10));
  };

  const calculateRequiredModuleGradeWithPlans = (moduleId, targetAverage, assumedWeight = 1) => {
    const baseGrades = moduleGrades[moduleId] || [];
    const planned = modulePlans[moduleId] || [];
    const all = [...baseGrades, ...planned];
    if (all.length === 0) return null;

    const parsedAssumedWeight = apprenticeshipCalculations.parseWeight(assumedWeight);
    if (!Number.isFinite(parsedAssumedWeight)) return null;

    const currentTotalWeight = all.reduce(
      (sum, g) => sum + apprenticeshipCalculations.parseWeight(g.weight ?? 1),
      0
    );
    const currentSum = all.reduce(
      (sum, g) => sum + (parseFloat(g.grade) * apprenticeshipCalculations.parseWeight(g.weight ?? 1)),
      0
    );
    const required = (targetAverage * (currentTotalWeight + parsedAssumedWeight) - currentSum) / parsedAssumedWeight;
    
    // Clamp result to valid grade range [1.0, 6.0]
    return Math.max(1.0, Math.min(6.0, Math.round(required * 10) / 10));
  };

  const addBmManualSemesterGrade = async (subject, semester, grade) => {
    const normalizedSubject = (subject || '').trim();
    const normalizedSemester = parseInt(semester, 10);
    const normalizedGrade = clampGrade(grade);

    if (!normalizedSubject || !Number.isFinite(normalizedSemester) || normalizedGrade === null) {
      return;
    }

    if (normalizedSemester < 1 || normalizedSemester > 8) {
      return;
    }

    setSemesterGrades(prev => ({
      ...prev,
      [normalizedSubject]: {
        ...(prev[normalizedSubject] || {}),
        [normalizedSemester]: normalizedGrade
      }
    }));

    // Persist to DB if user is logged in
    try {
      if (user && database.userId && database.setSemesterGrade) {
        await database.setSemesterGrade(normalizedSubject, normalizedSemester, normalizedGrade);
      }
    } catch (err) {
      console.warn('Error saving semester grade to DB:', err.message || err);
    }

    // Clear form
    setBmManualSubject('');
    setBmManualSemester(1);
    setBmManualGrade('');
  };

  const addEfzManualModuleAverage = async () => {
    const moduleId = normalizeModuleCode(efzManualModuleId);
    const normalizedAverage = clampGrade(efzManualModuleAverage);
    const targetSemester = efzManualModuleSemester;

    if (!moduleId || normalizedAverage === null) {
      return;
    }

    // Find or create the module
    let moduleEntry = moduleCatalog.find(m => m.code === moduleId);
    let efzId = moduleEntry?.efz_id || null;
    
    if (!moduleEntry) {
      if (user && database.userId && database.addEfzModule) {
        try {
          const created = await database.addEfzModule({ module_code: moduleId, name: '', semester: targetSemester });
          efzId = created?.id || null;
        } catch (err) {
          console.warn('Failed to create EFZ module:', err.message || err);
        }
      }

      setModuleCatalog(prev => {
        if (prev.some(m => m.code === moduleId)) return prev;
        return [...prev, { code: moduleId, name: '', efz_id: efzId, semester: targetSemester }];
      });
      setModuleGrades(prev => (prev[moduleId] ? prev : { ...prev, [moduleId]: [] }));
      setModulePlans(prev => (prev[moduleId] ? prev : { ...prev, [moduleId]: [] }));
      setModuleGoals(prev => (prev[moduleId] ? prev : { ...prev, [moduleId]: 5.0 }));
    } else if (!efzId && user && database.userId && database.addEfzModule) {
      try {
        const created = await database.addEfzModule({ module_code: moduleId, name: moduleEntry.name || '', semester: targetSemester });
        efzId = created?.id || null;
        setModuleCatalog(prev => prev.map(m => m.code === moduleId ? { ...m, efz_id: efzId } : m));
      } catch (err) {
        console.warn('Failed to create EFZ module in DB:', err.message || err);
      }
    }

    // Add as single "grade" with weight 1 (represents the average)
    const tempId = Date.now() + Math.random();
    const newGrade = {
      id: tempId,
      grade: normalizedAverage,
      weight: 1,
      displayWeight: '1',
      date: '',
      name: 'Zeugniss-Durchschnitt',
      source: 'import',
      semester: targetSemester
    };

    setModuleGrades(prev => ({
      ...prev,
      [moduleId]: [...(prev[moduleId] || []), newGrade]
    }));

    if (user && database.userId && efzId && database.addEfzModuleGrade) {
      try {
        const created = await database.addEfzModuleGrade({
          module_id: efzId,
          grade: normalizedAverage,
          weight: 1,
          date: null,
          control_name: 'Zeugniss-Durchschnitt',
          source: 'import',
          semester: targetSemester
        });
        if (created?.id) {
          setModuleGrades(prev => ({
            ...prev,
            [moduleId]: (prev[moduleId] || []).map(g => (g.id === tempId ? { ...g, id: created.id } : g))
          }));
        }
      } catch (err) {
        console.warn('Error saving manual module average to EFZ DB:', err.message || err);
      }
    }

    // Clear form
    setEfzManualModuleId('');
    setEfzManualModuleAverage('');
  };

  const addEfzManualUekAverage = async () => {
    const normalizedAverage = clampGrade(efzManualUekAverage);

    if (normalizedAverage === null) {
      return;
    }

    const themeName = efzManualUekTheme.trim() || 'Zeugniss-Durchschnitt';

    const newGrade = {
      id: Date.now(),
      grade: normalizedAverage,
      weight: 1,
      displayWeight: '1',
      date: '',
      name: themeName,
      source: 'import'
    };

    setUekGrades(prev => ([...(prev || []), newGrade]));

    if (user && database.userId && database.addEfzUekGrade) {
      try {
        await database.addEfzUekGrade({ grade: normalizedAverage, name: themeName, date: null });
      } catch (err) {
        console.warn('Error saving manual üK average to EFZ DB:', err.message || err);
      }
    }

    setEfzManualUekAverage('');
    setEfzManualUekTheme('');
  };

  const allSubjects = [
    ...BM_SUBJECTS[bmType].grundlagen,
    ...BM_SUBJECTS[bmType].schwerpunkt,
    ...BM_SUBJECTS[bmType].erganzung,
    ...BM_SUBJECTS[bmType].interdisziplinar
  ];
  const currentSemesterSubjects = getSubjectsForSemester(currentSemester);

  const bmCurrentAverage = (() => {
    const averages = currentSemesterSubjects
      .map(subject => calculations.getSemesterAverage(subject))
      .filter(value => Number.isFinite(value));
    if (averages.length === 0) return null;
    const sum = averages.reduce((acc, value) => acc + value, 0);
    return Math.round((sum / averages.length) * 10) / 10;
  })();

  const bmCurrentExactAverage = (() => {
    const averages = currentSemesterSubjects
      .map(subject => {
        const grades = subjects[subject] || [];
        if (grades.length === 0) return null;
        const totalWeight = grades.reduce((sum, g) => sum + (parseFloat(g.weight) || 0), 0);
        if (totalWeight <= 0) return null;
        return grades.reduce((sum, g) => sum + ((parseFloat(g.grade) || 0) * (parseFloat(g.weight) || 0)), 0) / totalWeight;
      })
      .filter(value => Number.isFinite(value));
    if (averages.length === 0) return null;
    return averages.reduce((acc, value) => acc + value, 0) / averages.length;
  })();

  const formatAverage = (rounded, exact = null) => {
    if (!Number.isFinite(rounded)) return '-';
    return `${rounded.toFixed(1)}${Number.isFinite(exact) ? ` (${exact.toFixed(1)})` : ''}`;
  };

  const moduleMeta = new Map(moduleCatalog.map(module => [module.code, module]));
  const moduleIds = new Set([
    ...moduleCatalog.map(module => module.code),
    ...Object.keys(moduleGrades || {}),
    ...Object.keys(modulePlans || {})
  ]);
  const moduleListAll = Array.from(moduleIds)
    .map(code => ({
      code,
      name: moduleMeta.get(code)?.name || ''
    }))
    .sort((a, b) => a.code.localeCompare(b.code))
    .filter(module => {
      return moduleCatalog.some(m => m.code === module.code);
    });

  const isEfzPreviousOnly = (moduleCode) => {
    const moduleEntry = moduleCatalog.find(m => m.code === moduleCode);
    if (!moduleEntry) return false;
    const semesterValue = normalizeSemesterValue(moduleEntry.semester, currentSemester);
    return semesterValue < currentSemester;
  };

  const efzCurrentModules = moduleListAll.filter(m => !isEfzPreviousOnly(m.code));
  const efzPreviousModules = moduleListAll.filter(m => isEfzPreviousOnly(m.code));
  const removeModule = (code) => {
    if (!window.confirm(`Modul ${code} wirklich löschen?`)) return;
    const moduleEntry = moduleCatalog.find(m => m.code === code);
    const efzId = moduleEntry?.efz_id;
    // Remove in DB so it doesn't come back after reload
    if (user && database.userId && efzId && database.removeEfzModule) {
      database.removeEfzModule(efzId).catch(err => console.warn('Error removing EFZ module from DB:', err.message || err));
    }

    setModuleCatalog(prev => prev.filter(m => m.code !== code));
    setModuleGrades(prev => { const newData = { ...prev }; delete newData[code]; return newData; });
    setModulePlans(prev => { const newData = { ...prev }; delete newData[code]; return newData; });
    setModuleGoals(prev => { const newData = { ...prev }; delete newData[code]; return newData; });
  };

  const modulesAverage = apprenticeshipCalculations.getModulesAverage();
  const rawModulesAverage = apprenticeshipCalculations.getRawModulesAverage();
  const uekAverage = apprenticeshipCalculations.getUekAverage();
  const schoolPart = apprenticeshipCalculations.getSchoolPart();
  const finalGrade = apprenticeshipCalculations.getFinalGrade();
  const efzOverallAverage = apprenticeshipCalculations.getOverallFinalGrade();
  const efzRawOverallAverage = apprenticeshipCalculations.getRawOverallFinalGrade();

  // For final grade tab: use calculations including ALL semesters
  const modulesAverageAllSemesters = apprenticeshipCalculationsAllSemesters.getModulesAverage();
  const rawModulesAverageAllSemesters = apprenticeshipCalculationsAllSemesters.getRawModulesAverage();
  const uekAverageAllSemesters = apprenticeshipCalculationsAllSemesters.getUekAverage();
  const schoolPartAllSemesters = apprenticeshipCalculationsAllSemesters.getSchoolPart();
  const finalGradeAllSemesters = apprenticeshipCalculationsAllSemesters.getFinalGrade();

  // Helper function to get module average for previous semesters (all grades)
  const getModuleAverageAllSemesters = (moduleCode) => {
    return apprenticeshipCalculationsAllSemesters.getModuleAverage(moduleCode);
  };

  const getRawModuleAverageAllSemesters = (moduleCode) => {
    return apprenticeshipCalculationsAllSemesters.getRawModuleAverage(moduleCode);
  };

  const userFirstName = getFirstName(user);

  // ============ Tour Configuration ============
  const tourSteps = [
    {
      target: 'body',
      content: 'Willkommen zu Schulnetz 2.0! Diese Führung zeigt dir alle wichtigen Funktionen der App. Lass dich leiten durch deine Noten und Simulationen!',
      placement: 'center',
      title: '🎓 Willkommen'
    },
    {
      target: '[data-tour="tab-overview"]',
      content: 'In der Übersicht siehst du deine aktuellen Noten im Überblick. Du kannst hier dein BM-Typ (TAL oder DL) festlegen und das aktuelle Semester angeben. Außerdem findest du hier deine Profil- und Sicherheitseinstellungen.',
      placement: 'bottom',
      title: '📊 Übersicht',
      skipScroll: true
    },
    {
      target: '[data-tour="tab-berufsschule"]',
      content: 'Jetzt schauen wir uns die Berufsschule an. Der Berufsschule-Tab (EFZ) hat 4 Unterabschnitte mit unterschiedlichen Funktionen.',
      placement: 'bottom',
      title: '👾 Berufsschule (EFZ)',
      skipScroll: true,
      before: () => {
        setMainTab('berufsschule');
        return new Promise(resolve => setTimeout(resolve, 300));
      }
    },
    {
      target: '[data-tour="efz-aktuell"]',
      content: 'Aktuell: Hier kannst du SAL-Screenshots hochladen oder manuell Noten deiner aktuellen Module eintragen.',
      placement: 'bottom',
      title: '📝 EFZ - Aktuell',
      skipScroll: true,
      before: () => {
        document.querySelector('[data-tour="efz-aktuell"]')?.click();
        return new Promise(resolve => setTimeout(resolve, 300));
      }
    },
    {
      target: '[data-tour="efz-simulation"]',
      content: 'Simulation: Berechne deine minimalen Notenziele für deine Module basierend auf deinen Objektiven.',
      placement: 'bottom',
      title: '🎯 EFZ - Simulation',
      skipScroll: true,
      before: () => {
        document.querySelector('[data-tour="efz-simulation"]')?.click();
        return new Promise(resolve => setTimeout(resolve, 300));
      }
    },
    {
      target: '[data-tour="efz-previous"]',
      content: 'Alte Zeugnisse: Verwalte deine historischen Module von früheren Semestern.',
      placement: 'bottom',
      title: '📚 EFZ - Alte Zeugnisse',
      skipScroll: true,
      before: () => {
        document.querySelector('[data-tour="efz-previous"]')?.click();
        return new Promise(resolve => setTimeout(resolve, 300));
      }
    },
    {
      target: '[data-tour="efz-final"]',
      content: 'Abschluss: Simuliere deine minimale IPA-Note am Ende deiner Ausbildung basierend auf deinen Zielen.',
      placement: 'bottom',
      title: '🏁 EFZ - Abschluss',
      skipScroll: true,
      before: () => {
        document.querySelector('[data-tour="efz-final"]')?.click();
        return new Promise(resolve => setTimeout(resolve, 300));
      }
    },
    {
      target: '[data-tour="tab-bm"]',
      content: 'Die Berufsmaturität (BM) hat 4 Unterabschnitte für die Verwaltung deiner BM-Noten. Klicke um zu beginnen!',
      placement: 'bottom',
      title: '📚 Berufsmaturität (BM)',
      skipScroll: true,
      before: () => {
        setMainTab('bm');
        return new Promise(resolve => setTimeout(resolve, 300));
      }
    },
    {
      target: '[data-tour="bm-current"]',
      content: 'Aktuell: Hier gibst du die Noten (Kontrollen) des laufenden Semesters ein.',
      placement: 'bottom',
      title: '📝 BM - Aktuell',
      skipScroll: true,
      before: () => {
        document.querySelector('[data-tour="bm-current"]')?.click();
        return new Promise(resolve => setTimeout(resolve, 300));
      }
    },
    {
      target: '[data-tour="bm-simulation"]',
      content: 'Semestersimulation: Berechne deine minimalen Notenziele für jedes Fach des aktuellen Semesters.',
      placement: 'bottom',
      title: '🎯 BM - Simulation',
      skipScroll: true,
      before: () => {
        document.querySelector('[data-tour="bm-simulation"]')?.click();
        return new Promise(resolve => setTimeout(resolve, 300));
      }
    },
    {
      target: '[data-tour="bm-previous"]',
      content: 'Alte Zeugnisse: Verwalte die Noten von früheren Semestern deiner Ausbildung.',
      placement: 'bottom',
      title: '📚 BM - Alte Zeugnisse',
      skipScroll: true,
      before: () => {
        document.querySelector('[data-tour="bm-previous"]')?.click();
        return new Promise(resolve => setTimeout(resolve, 300));
      }
    },
    {
      target: '[data-tour="bm-exam"]',
      content: 'Abschlussprüfungen: Analysiere deine Promotion und simuliere deine Abschlussnoten (Erfahrungsnote + Prüfungsnote).',
      placement: 'bottom',
      title: '🏁 BM - Abschlussprüfungen',
      skipScroll: true,
      before: () => {
        document.querySelector('[data-tour="bm-exam"]')?.click();
        return new Promise(resolve => setTimeout(resolve, 300));
      }
    },
    {
      target: 'button[title="Relancer le tutoriel"]',
      content: 'Dieser Help-Button startet die Führung jederzeit neu - perfekt, wenn du schnell eine Erklärung brauchst!',
      placement: 'top',
      title: '❓ Hilfe-Button'
    }
  ];

  // ============ Render ============
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f8f9ff] via-white to-[#eef2ff] py-6 sm:py-10 px-3">
      <Joyride
        steps={tourSteps}
        run={runTour}
        continuous={true}
        showSkipButton={true}
        onCallback={handleJoyrideCallback}
        styles={{
          options: {
            primaryColor: '#4f46e5',
            textColor: '#1f2937',
            backgroundColor: '#ffffff',
            overlayColor: 'rgba(0, 0, 0, 0.5)',
          },
          tooltip: {
            borderRadius: 16,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            padding: '24px',
            fontSize: 14,
          },
          tooltipTitle: {
            fontSize: 18,
            fontWeight: 600,
            marginBottom: 8,
          },
          tooltipContainer: {
            borderRadius: 16,
          },
          buttonPrimary: {
            backgroundColor: '#4f46e5',
            borderRadius: 8,
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 500,
          },
          buttonBack: {
            borderRadius: 8,
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 500,
            color: '#6b7280',
          },
          buttonClose: {
            color: '#9ca3af',
          },
          buttonSkip: {
            color: '#9ca3af',
          },
          spotlight: {
            borderRadius: 12,
          },
        }}
      />
      <div className="max-w-7xl mx-auto px-2 sm:px-4">
        {/* Header */}
        <header className="bg-white rounded-2xl shadow-xl px-4 py-3 sm:px-6 sm:py-4 mb-4 border border-gray-100">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-indigo-900 flex items-center gap-3">
                Schulnetz 2.0
              </h1>
              {user && (
                <p className="mt-3 text-lg sm:text-xl font-semibold text-gray-800">
                  Hallo, {userFirstName} !
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-3 flex-shrink-0">
              {user && (
                <div className="inline-flex items-center justify-center gap-2 text-sm text-gray-600 bg-gray-50 border border-gray-200 px-3 py-2 rounded-full font-medium">
                  <div className={`w-2 h-2 rounded-full animate-pulse ${(database.userId && database.loading === false)
                    ? 'bg-green-500'
                    : 'bg-red-500'
                    }`}></div>
                  {(database.userId && database.loading === false)
                    ? 'Synchronisiert'
                    : 'Nicht synchronisiert'}
                </div>
              )}
              {user && (
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={signOutPending}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <LogOut className="h-4 w-4" />
                  {signOutPending ? '...' : 'Abmelden'}
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Main pages */}
        <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 border border-gray-100 overflow-visible">
          {/* Mobile: Main page dropdown */}
          <div className="sm:hidden mb-6">
            <select
              value={mainTab}
              onChange={(e) => setMainTab(e.target.value)}
              className="w-full p-3 bg-cyan-600 text-white rounded-xl font-medium text-center appearance-none cursor-pointer shadow-lg"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '20px' }}
            >
              <option value="overview" className="bg-white text-gray-800">🏠 Übersicht</option>
              <option value="berufsschule" className="bg-white text-gray-800">👾 Berufsschule</option>
              <option value="bm" className="bg-white text-gray-800">📚 BM</option>
            </select>
          </div>

          {/* Desktop: Main page buttons */}
          <div className="hidden sm:flex gap-2 mb-8 justify-center flex-wrap">
            <button
              onClick={() => setMainTab('overview')}
              className={`px-4 py-2.5 rounded-xl font-medium whitespace-nowrap transition-all duration-200 flex items-center gap-2 ${mainTab === 'overview'
                ? 'bg-gradient-to-r from-cyan-600 to-cyan-500 text-white shadow-lg shadow-cyan-200'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100 hover:shadow-md border border-gray-200'
                }`}
              data-tour="tab-overview"
            >
              <ChartNoAxesGantt className="w-4 h-4" />
              Übersicht
            </button>

            <button
              onClick={() => setMainTab('berufsschule')}
              className={`px-4 py-2.5 rounded-xl font-medium whitespace-nowrap transition-all duration-200 flex items-center gap-2 ${mainTab === 'berufsschule'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-200'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100 hover:shadow-md border border-gray-200'
                }`}
              data-tour="tab-berufsschule"
            >
              <Binary className="w-4 h-4" />
              Berufsschule
            </button>

            <button
              onClick={() => setMainTab('bm')}
              className={`px-4 py-2.5 rounded-xl font-medium whitespace-nowrap transition-all duration-200 flex items-center gap-2 ${mainTab === 'bm'
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-200'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100 hover:shadow-md border border-gray-200'
                }`}
              data-tour="tab-bm"
            >
              <NotebookPen className="w-4 h-4" />
              BM
            </button>
          </div>

          {/* Page 1: Overview */}
          {mainTab === 'overview' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Übersicht und Einstellungen</h2>
              <div className="grid lg:grid-cols-2 gap-6 mb-6">
                <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
                  <div className="text-xs text-indigo-700 mb-1">BM</div>
                  <div className="text-3xl font-bold text-indigo-900">{formatAverage(bmCurrentAverage, bmCurrentExactAverage)}</div>
                </div>
                <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                  <div className="text-xs text-amber-700 mb-1">Berufsschule</div>
                  <div className="text-3xl font-bold text-amber-900">{formatAverage(efzRawOverallAverage)}</div>
                  {(!Number.isFinite(efzOverallAverage)) && (
                    <div className="text-xs text-amber-600 mt-2">Bitte Noten hinzufügen</div>
                  )}
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">BM-Typ</label>
                  <select
                    value={bmType}
                    onChange={async (e) => {
                      const newBmType = e.target.value;
                      setBmType(newBmType);
                      if (user && database.userId) {
                        try {
                          await database.updateBmType(newBmType);
                          console.log('✅ BM type saved successfully');
                        } catch (err) {
                          console.error('❌ Failed to save BM type:', err);
                        }
                      }
                    }}
                    className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 transition-all"
                  >
                    <option value="TAL">TAL - Technique, Architecture, Life Sciences</option>
                    <option value="DL">DL - Dienstleistung</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Aktuelles Semester</label>
                  <input
                    type="number"
                    min="1"
                    max="8"
                    value={currentSemester}
                    onChange={async (e) => {
                      const newSemester = parseInt(e.target.value, 10);
                      if (!Number.isFinite(newSemester)) return;
                      setCurrentSemester(newSemester);
                      if (user && database.userId) {
                        try {
                          await database.updateSemester(newSemester);
                          console.log('✅ Semester saved successfully');
                        } catch (err) {
                          console.error('❌ Failed to save semester:', err);
                        }
                      }
                    }}
                    className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 transition-all"
                  />
                </div>
              </div>

              <div className="my-6 border-t border-gray-200" />

              <div className="mb-4">
                <button
                  onClick={() => setShowProfileSettings(!showProfileSettings)}
                  className="flex items-center gap-2 text-lg font-semibold text-gray-900 hover:text-indigo-600 transition-colors"
                >
                  <span>Profil und Sicherheit</span>
                  <span className="text-sm text-gray-500">{showProfileSettings ? '▼' : '▶'}</span>
                </button>
                <p className="text-sm text-gray-500 mt-1">Name, E-Mail und Passwort verwalten.</p>
              </div>

              {showProfileSettings && (
                <div className="mt-4">
                  <AccountSettings user={user} />
                </div>
              )}
            </div>
          )}

          {/* Page 2: Berufsschule */}
          {mainTab === 'berufsschule' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Berufsschule (EFZ)</h2>

              <div className="flex flex-wrap gap-2 mb-6">
                <button
                  onClick={() => setEfzTab('scan-sal')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${efzTab === 'scan-sal' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-700'
                    }`}
                  data-tour="efz-aktuell"
                >
                  Aktuell
                </button>
                <button
                  onClick={() => setEfzTab('simulation')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${efzTab === 'simulation' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-700'
                    }`}
                  data-tour="efz-simulation"
                >
                  Modulsimulation
                </button>
                <button
                  onClick={() => setEfzTab('previous')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${efzTab === 'previous' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-700'
                    }`}
                  data-tour="efz-previous"
                >
                  Alte Zeugnisse
                </button>
                <button
                  onClick={() => setEfzTab('final')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${efzTab === 'final' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-700'
                    }`}
                  data-tour="efz-final"
                >
                  Abschluss
                </button>
              </div>

              {efzTab === 'scan-sal' && (
                <>
                  <div className="mb-6 rounded-xl border border-amber-100 bg-amber-50 p-4">
                    <div className="text-xs text-amber-700 mb-1">Moduldurchschnitt</div>
                    <div className="text-3xl font-bold text-amber-900">
                      {formatAverage(modulesAverage, rawModulesAverage)}
                    </div>
                  </div>

                  <div className="mb-6 w-full rounded-lg shadow-sm p-6 border-2 bg-blue-50 border-blue-200">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-800">SAL-Module scannen</h3>
                    </div>
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                      <div className="text-sm text-gray-600">SAL-Screenshot importieren (JPG, PNG)</div>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleEfzSalUpload}
                        disabled={efzIsAnalyzing}
                      />
                    </label>

                    {efzIsAnalyzing && (
                      <div className="flex items-center justify-center p-4 bg-blue-50 rounded-lg">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
                        <span className="text-blue-600">Analyse läuft ...</span>
                      </div>
                    )}
                    {efzAnalysisResult?.error && (
                      <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                        {efzAnalysisResult.error}
                      </div>
                    )}
                    {efzAnalysisResult?.message && (
                      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
                        {efzAnalysisResult.message}
                      </div>
                    )}
                  </div>

                  <div className="mb-6 w-full bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800">Module</h3>
                        <p className="text-xs text-gray-600">Module hinzufügen und danach Noten erfassen.</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {editingModuleCode ? (
                          <div className="flex gap-1">
                            <input
                              type="text"
                              placeholder="Code"
                              value={editingModuleForm.code}
                              onChange={(e) => setEditingModuleForm({ ...editingModuleForm, code: e.target.value })}
                              className="w-24 p-2 border border-gray-300 rounded text-sm"
                            />
                            <input
                              type="text"
                              placeholder="Name"
                              value={editingModuleForm.name}
                              onChange={(e) => setEditingModuleForm({ ...editingModuleForm, name: e.target.value })}
                              className="w-40 p-2 border border-gray-300 rounded text-sm"
                            />
                            <button
                              onClick={saveModuleEdit}
                              className="px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 inline-flex items-center gap-1"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingModuleCode(null);
                                setEditingModuleForm({ code: '', name: '' });
                              }}
                              className="px-3 py-2 bg-gray-400 text-white rounded text-sm hover:bg-gray-500 inline-flex items-center gap-1"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <input
                              type="text"
                              placeholder="Code (z. B. M152)"
                              value={newModuleCode}
                              onChange={(e) => setNewModuleCode(e.target.value)}
                              className="w-32 p-2 border border-gray-300 rounded text-sm"
                            />
                            <input
                              type="text"
                              placeholder="Modulname"
                              value={newModuleName}
                              onChange={(e) => setNewModuleName(e.target.value)}
                              className="w-48 p-2 border border-gray-300 rounded text-sm"
                            />
                            <button
                              onClick={addModule}
                              className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700"
                            >
                              Hinzufügen
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {efzCurrentModules.length === 0 ? (
                      <p className="text-sm text-gray-500">Noch keine Module erfasst.</p>
                    ) : (
                      <div className="grid md:grid-cols-2 gap-4">
                        {efzCurrentModules.map(module => {
                          const label = module.name ? `${module.code} - ${module.name}` : module.code;
                          return (
                            <div key={module.code}>
                              <GradeCard
                                subject={module.code}
                                title={label}
                                titleActions={
                                  <>
                                    <button
                                      onClick={() => {
                                        setEditingModuleCode(module.code);
                                        setEditingModuleForm({ code: module.code, name: module.name });
                                      }}
                                      className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
                                      title="Modul umbenennen"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => removeModule(module.code)}
                                      className="p-1.5 bg-red-100 hover:bg-red-200 rounded text-red-700"
                                      title="Modul löschen"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </>
                                }
                                grades={moduleGradesCurrentSemesterOnly[module.code] || []}
                                onAddGrade={addModuleGrade}
                                onRemoveGrade={removeModuleGrade}
                                semesterAverage={apprenticeshipCalculations.getModuleAverage(module.code)}
                                exactAverage={apprenticeshipCalculations.getRawModuleAverage(module.code)}
                                targetGrade={5.0}
                                requiredGrade={apprenticeshipCalculations.getRequiredModuleGrade(module.code, 5.0)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="mb-6 bg-white rounded-xl border border-gray-200 p-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">üK</h3>
                    <GradeCard
                      subject="üK"
                      grades={uekGrades}
                      onAddGrade={(subject, grade, _weight, date, name) => addUekGrade(subject, grade, 1, date, name)}
                      onRemoveGrade={removeUekGrade}
                      semesterAverage={apprenticeshipCalculations.getUekAverage()}
                      exactAverage={apprenticeshipCalculations.getRawUekAverage()}
                      targetGrade={5.0}
                      requiredGrade={null}
                      fixedWeight={1}
                      hideWeightInput
                    />
                  </div>
                </>
              )}

              {efzTab === 'simulation' && (
                <>
                  {efzCurrentModules.length > 0 ? (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-gray-800 mb-3">Modulsimulation</h3>
                      <div className="grid md:grid-cols-2 gap-4">
                        {efzCurrentModules.map(module => {
                          const moduleId = module.code;
                          const label = module.name ? `${module.code} - ${module.name}` : module.code;
                          const goal = moduleGoals[moduleId] || 5.0;

                          return (
                            <SemesterSimulatorCard
                              key={`${moduleId}-sim`}
                              subject={label}
                              currentGrades={moduleGradesCurrentSemesterOnly[moduleId] || []}
                              plannedControls={modulePlans[moduleId] || []}
                              onAddPlan={(grade, weight) => addModulePlan(moduleId, grade, weight)}
                              onRemovePlan={(id) => removeModulePlan(moduleId, id)}
                              currentAverage={apprenticeshipCalculations.getModuleAverage(moduleId)}
                              simulatedAverage={apprenticeshipCalculations.getSimulatedModuleAverage(moduleId)}
                              goalGrade={goal}
                              onGoalChange={(value) => setModuleGoals({ ...moduleGoals, [moduleId]: value })}
                              computeRequired={(assumedWeight) => calculateRequiredModuleGradeWithPlans(moduleId, goal, assumedWeight)}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg text-center">
                      <p className="text-gray-700 mb-2">Noch keine Module für dieses Semester hinzugefügt.</p>
                      <p className="text-sm text-gray-600">Füge Module unter dem Reiter "Aktuell" hinzu, um sie hier zu simulieren.</p>
                    </div>
                  )}
                </>
              )}

              {efzTab === 'previous' && (
                <>
                  <div className="mb-6 w-full rounded-lg shadow-sm p-6 border-2 bg-purple-50 border-purple-200">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Zeugnis scannen</h3>
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                      <div className="text-sm text-gray-600">Bilddatei (JPG, PNG) oder PDF</div>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*,application/pdf"
                        onChange={handleEfzBulletinUpload}
                        disabled={efzIsAnalyzing}
                      />
                    </label>

                    {efzIsAnalyzing && (
                      <div className="flex items-center justify-center p-4 bg-purple-50 rounded-lg">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mr-3"></div>
                        <span className="text-purple-600">Analyse läuft ...</span>
                      </div>
                    )}
                    {efzAnalysisResult?.error && (
                      <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                        {efzAnalysisResult.error}
                      </div>
                    )}
                    {efzAnalysisResult?.message && (
                      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
                        {efzAnalysisResult.message}
                      </div>
                    )}
                  </div>

                  {/* Manual entry for old module averages */}
                  <div className="mb-6 w-full rounded-lg shadow-sm p-6 border-2 bg-green-50 border-green-200">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Alte Moduldurchschnitte hinzufügen</h3>
                    <div className="grid md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Modulcode</label>
                        <input
                          type="text"
                          placeholder="z. B. M152"
                          value={efzManualModuleId}
                          onChange={(e) => setEfzManualModuleId(e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Semester</label>
                        <select
                          value={efzManualModuleSemester}
                          onChange={(e) => setEfzManualModuleSemester(parseInt(e.target.value, 10))}
                          className="w-full p-2 border border-gray-300 rounded text-sm"
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                            <option key={sem} value={sem}>S{sem}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Durchschnitt</label>
                        <input
                          type="number"
                          step="0.5"
                          min="1"
                          max="6"
                          placeholder="Note"
                          value={efzManualModuleAverage}
                          onChange={(e) => setEfzManualModuleAverage(e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded text-sm"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          onClick={addEfzManualModuleAverage}
                          className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium"
                        >
                          Hinzufügen
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mb-6 rounded-lg shadow-sm p-6 border-2 bg-amber-50 border-amber-200">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Alte üK-Note hinzufügen</h3>
                    <div className="grid md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Durchschnitt</label>
                        <input
                          type="number"
                          step="0.5"
                          min="1"
                          max="6"
                          placeholder="Note"
                          value={efzManualUekAverage}
                          onChange={(e) => setEfzManualUekAverage(e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Thema</label>
                        <input
                          type="text"
                          placeholder="z.B. Linux, Datenbanken"
                          value={efzManualUekTheme}
                          onChange={(e) => setEfzManualUekTheme(e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded text-sm"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          onClick={addEfzManualUekAverage}
                          className="w-full px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 text-sm font-medium"
                        >
                          Hinzufügen
                        </button>
                      </div>
                    </div>
                  </div>

                  {efzPreviousModules.length > 0 && (
                    <div className="mb-6 w-full bg-white rounded-xl border border-gray-200 p-4">
                      <h3 className="text-lg font-semibold text-gray-800 mb-3">Alte Module</h3>
                      <div className="grid md:grid-cols-2 gap-4">
                        {efzPreviousModules.map(module => {
                          const label = module.name ? `${module.code} - ${module.name}` : module.code;
                          return (
                            <div key={`prev-${module.code}`}>
                              <GradeCard
                                subject={module.code}
                                title={label}
                                titleActions={
                                  <>
                                    <button
                                      onClick={() => {
                                        setEditingModuleCode(module.code);
                                        setEditingModuleForm({ code: module.code, name: module.name });
                                      }}
                                      className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
                                      title="Modul umbenennen"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => removeModule(module.code)}
                                      className="p-1.5 bg-red-100 hover:bg-red-200 rounded text-red-700"
                                      title="Modul löschen"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </>
                                }
                                grades={moduleGrades[module.code] || []}
                                onAddGrade={addModuleGrade}
                                onRemoveGrade={removeModuleGrade}
                                semesterAverage={getModuleAverageAllSemesters(module.code)}
                                exactAverage={getRawModuleAverageAllSemesters(module.code)}
                                targetGrade={5.0}
                                requiredGrade={null}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}

              {efzTab === 'final' && (
                <div className="mb-6 w-full bg-white rounded-xl border border-gray-200 p-4">
                  <div className="mb-4 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl">
                    <div className="grid md:grid-cols-4 gap-4">
                      <div className="bg-white rounded-lg p-3 text-center border border-amber-100">
                        <div className="text-xs text-amber-700 mb-1">Berufsschule-Durchschnitt</div>
                        <div className="text-2xl font-bold text-amber-900">{modulesAverageAllSemesters?.toFixed(1) || '-'}</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 text-center border border-amber-100">
                        <div className="text-xs text-amber-700 mb-1">üK-Durchschnitt</div>
                        <div className="text-2xl font-bold text-amber-900">{uekAverageAllSemesters?.toFixed(1) || '-'}</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 text-center border border-amber-100">
                        <div className="text-xs text-amber-700 mb-1">Schulteil</div>
                        <div className="text-2xl font-bold text-amber-900">{schoolPartAllSemesters?.toFixed(1) || '-'}</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 text-center border border-amber-100">
                        <div className="text-xs text-amber-700 mb-1">Lehrabschlussnote</div>
                        <div className="text-2xl font-bold text-amber-900">{finalGradeAllSemesters?.toFixed(1) || '-'}</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">IPA</h3>
                      <p className="text-xs text-gray-600">IPA-Note und Ziel für den Lehrabschluss.</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">IPA-Note</label>
                        <input
                          type="number"
                          step="0.1"
                          min="1"
                          max="6"
                          value={ipaGrade ?? ''}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value);
                            if (Number.isFinite(value)) {
                              setIpaGrade(value);
                            } else if (e.target.value === '') {
                              setIpaGrade(null);
                            }
                          }}
                          onBlur={(e) => {
                            const value = parseFloat(e.target.value);
                            if (Number.isFinite(value)) {
                              const clamped = Math.min(6, Math.max(1, value));
                              setIpaGrade(clamped);
                                if (user && database.userId && database.setEfzIpa) {
                                  database.setEfzIpa({ grade: clamped, is_final: true }).catch(err => console.warn('Error saving IPA to EFZ DB:', err.message || err));
                              }
                            }
                          }}
                          className="w-24 p-2 border border-gray-300 rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Ziel Lehrabschluss</label>
                        <input
                          type="number"
                          step="0.1"
                          min="1"
                          max="6"
                          value={finalGoal}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value);
                            if (Number.isFinite(value)) setFinalGoal(value);
                          }}
                          className="w-24 p-2 border border-gray-300 rounded text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid md:grid-cols-3 gap-4">
                    <div className="rounded-lg bg-gray-50 p-3 border border-gray-200">
                      <div className="text-xs text-gray-600">Schulteil</div>
                      <div className="text-xl font-bold text-gray-800">{schoolPart?.toFixed(1) || '-'}</div>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-3 border border-gray-200">
                      <div className="text-xs text-gray-600">Lehrabschlussnote</div>
                      <div className="text-xl font-bold text-gray-800">{finalGrade?.toFixed(1) || '-'}</div>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-3 border border-gray-200">
                      <div className="text-xs text-gray-600">Benötigte IPA-Note</div>
                      <div className="text-xl font-bold text-gray-800">
                        {apprenticeshipCalculations.getRequiredIpaGrade(finalGoal)?.toFixed(1) || '-'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Page 3: BM */}
          {mainTab === 'bm' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Berufsmaturität (BM)</h2>
              <div className="flex flex-wrap gap-2 mb-6">
                <button
                  onClick={() => setBmTab('current')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${bmTab === 'current' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'
                    }`}
                  data-tour="bm-current"
                >
                  Aktuell
                </button>
                <button
                  onClick={() => setBmTab('semester-sim')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${bmTab === 'semester-sim' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'
                    }`}
                  data-tour="bm-simulation"
                >
                  Semestersimulation
                </button>
                <button
                  onClick={() => setBmTab('previous')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${bmTab === 'previous' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'
                    }`}
                  data-tour="bm-previous"
                >
                  Alte Zeugnisse
                </button>
                <button
                  onClick={() => setBmTab('exam')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${bmTab === 'exam' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'
                    }`}
                  data-tour="bm-exam"
                >
                  Abschlussprüfungen
                </button>
              </div>

              {/* Semester Simulator Tab */}
              {bmTab === 'semester-sim' && (
                <div>
                  <PromotionStatus
                    promotionStatus={calculations.getSimulatedPromotionStatus()}
                    title="Promotionsstatus BM1"
                  />

                  <h2 className="text-2xl font-bold text-gray-800 mb-4">Semestersimulation</h2>
                  <div className="grid md:grid-cols-2 gap-4">
                    {currentSemesterSubjects.map(subject => {
                      const currentGrades = subjects[subject] || [];
                      const plannedControls = semesterPlans[subject] || [];
                      const goalGrade = subjectGoals[subject] || 5.0;

                      return (
                        <SemesterSimulatorCard
                          key={subject}
                          subject={subject}
                          currentGrades={currentGrades}
                          plannedControls={plannedControls}
                          onAddPlan={(grade, weight) => addPlannedControl(subject, grade, weight)}
                          onRemovePlan={(id) => removePlannedControl(subject, id)}
                          currentAverage={calculations.getSemesterAverage(subject)}
                          simulatedAverage={calculations.getSimulatedSemesterAverage(subject)}
                          goalGrade={goalGrade}
                          onGoalChange={(goal) => setSubjectGoals({ ...subjectGoals, [subject]: goal })}
                          computeRequired={(assumedWeight) => calculateRequiredGradeWithPlans(subject, goalGrade, assumedWeight)}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Current Semester Tab */}
              {bmTab === 'current' && (
                <>
                  <BulletinAnalysis
                    isAnalyzing={isAnalyzing}
                    analysisResult={analysisResult}
                    onFileUpload={handleFileUpload}
                    activeTab={bmTab}
                  />
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">Aktuelles Semester (S{currentSemester})</h2>
                    <div className="grid md:grid-cols-2 gap-4">
                      {currentSemesterSubjects.map(subject => {
                        // Use grades from local state (subjects) which contains the details
                        const subjectGrades = subjects[subject] || [];
                        return (
                          <GradeCard
                            key={subject}
                            subject={subject}
                            grades={subjectGrades}
                            onAddGrade={addGrade}
                            onRemoveGrade={removeGrade}
                            semesterAverage={calculations.getSemesterAverage(subject)}
                            exactAverage={(() => {
                              const totalWeight = subjectGrades.reduce((sum, g) => sum + (parseFloat(g.weight) || 0), 0);
                              if (totalWeight <= 0) return null;
                              return subjectGrades.reduce((sum, g) => sum + ((parseFloat(g.grade) || 0) * (parseFloat(g.weight) || 0)), 0) / totalWeight;
                            })()}
                            targetGrade={5.0}
                            requiredGrade={calculations.getRequiredSemesterGrade(subject, 5.0)}
                          />
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* Previous Bulletins Tab */}
              {bmTab === 'previous' && (
                <>
                  <BulletinAnalysis
                    isAnalyzing={isAnalyzing}
                    analysisResult={analysisResult}
                    onFileUpload={handleFileUpload}
                    activeTab={bmTab}
                  />

                  {/* Manual entry for old semester grades */}
                  <div className="mb-6 rounded-lg shadow-sm p-6 border-2 bg-green-50 border-green-200">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Alte Semesternote hinzufügen</h3>
                    <div className="grid md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Fach</label>
                        <select
                          value={bmManualSubject}
                          onChange={(e) => setBmManualSubject(e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded text-sm"
                        >
                          <option value="">Wähle Fach</option>
                          {allSubjects.map(subject => (
                            <option key={subject} value={subject}>{subject}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Semester</label>
                        <select
                          value={bmManualSemester}
                          onChange={(e) => setBmManualSemester(parseInt(e.target.value, 10))}
                          className="w-full p-2 border border-gray-300 rounded text-sm"
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                            <option key={sem} value={sem}>S{sem}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Note</label>
                        <input
                          type="number"
                          step="0.5"
                          min="1"
                          max="6"
                          placeholder="Note"
                          value={bmManualGrade}
                          onChange={(e) => setBmManualGrade(e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded text-sm"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          onClick={() => addBmManualSemesterGrade(bmManualSubject, bmManualSemester, bmManualGrade)}
                          className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium"
                        >
                          Hinzufügen
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">Alte Zeugnisse</h2>
                    <div className="grid md:grid-cols-2 gap-4">
                      {allSubjects.map(subject => {
                        const semGrades = semesterGrades[subject] || {};
                        const erfahrungsnote = calculations.getErfahrungsnote(subject);

                        return (
                          <div key={subject} className="border-2 border-purple-200 rounded-lg p-4 bg-gradient-to-r from-purple-50 to-pink-50">
                            <h3 className="font-semibold text-gray-800 mb-2">{subject}</h3>

                            {Object.keys(semGrades).length > 0 ? (
                              <div className="space-y-1 mb-3">
                                {Object.entries(semGrades).map(([sem, grade]) => (
                                  <div key={sem} className="flex justify-between items-center text-sm">
                                    <div className="flex items-center gap-2">
                                      <span className="text-gray-600">S{sem}:</span>
                                      <span className="font-semibold">{grade.toFixed(1)}</span>
                                    </div>
                                    <button
                                      onClick={async () => {
                                        if (confirm(`S${sem}-Note für ${subject} löschen?`)) {
                                          const newGrades = { ...semesterGrades };
                                          if (newGrades[subject]) {
                                            delete newGrades[subject][sem];
                                            if (Object.keys(newGrades[subject]).length === 0) {
                                              delete newGrades[subject];
                                            }
                                            setSemesterGrades(newGrades);

                                            // Delete from database if user is logged in
                                            if (user && database.userId) {
                                              console.log(`✅ Deleted S${sem} grade for ${subject}`);
                                            } else {
                                              console.log(`✅ Deleted S${sem} grade for ${subject} (local only)`);
                                            }
                                          }
                                        }
                                      }}
                                      className="text-red-500 hover:text-red-700 p-1 flex-shrink-0"
                                      title="Diese Semesternote löschen"
                                    >
                                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-gray-500 text-sm mb-3">Kein Semesternote</p>
                            )}

                            {erfahrungsnote && (
                              <div className="border-t border-purple-200 pt-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm font-semibold text-gray-700">Erfahrungsnote:</span>
                                  <span className="text-lg font-bold text-purple-700">{erfahrungsnote.toFixed(1)}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* Exam Tab */}
              {bmTab === 'exam' && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">Abschlussprüfungen</h2>

                  <div className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-blue-900 mb-1">Gesamtdurchschnitt (Maturnote)</h3>
                        <p className="text-xs text-gray-600">Gewichtete Durchschnitte aller Prüfungsfächer</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600">Ziel:</span>
                        <input
                          type="number"
                          step="0.1"
                          min="4"
                          max="6"
                          value={maturnoteGoal}
                          onChange={async (e) => {
                            const newGoal = parseFloat(e.target.value);
                            setMaturnoteGoal(newGoal);
                            try {
                              if (
                                user &&
                                database &&
                                database.userId &&
                                typeof database.updateMaturanoteGoal === 'function'
                              ) {
                                await database.updateMaturanoteGoal(newGoal);
                              } else {
                                // No backend or function, just skip DB update
                                console.log('Maturnote goal update skipped: no user, userId, or updateMaturanoteGoal function.');
                              }
                            } catch (err) {
                              // Catch any error, including ReferenceError if updateMaturanoteGoal is not defined
                              console.error('Maturnote goal update failed (but UI will not crash):', err);
                            }
                          }}
                          className="w-16 p-1 border-2 border-indigo-300 rounded text-sm font-bold text-center"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      {(() => {
                        const certStatus = calculations.getFinalCertificationStatus();
                        const hasAverage = certStatus.average !== null;
                        
                        return (
                          <>
                            <div>
                              <div className="text-sm text-gray-600 mb-1">Aktueller Durchschnitt</div>
                              <div className={`text-4xl font-bold ${hasAverage && certStatus.average < 4.0
                                ? 'text-red-700'
                                : 'text-blue-700'
                                }`}>
                                {hasAverage ? certStatus.average.toFixed(1) : '-'}
                              </div>
                            </div>

                            {hasAverage && (
                              <div className="flex-1 bg-white/60 p-4 rounded-lg border border-white">
                                <div className="text-sm font-semibold mb-2 text-gray-800">
                                  Bestehensnormen (BM)
                                  {!certStatus.hasAllNotes && <span className="text-xs font-normal text-gray-500 ml-2">(Vorläufig - nicht alle Noten vorhanden)</span>}
                                </div>
                                <div className="space-y-1 text-sm">
                                  <div className="flex items-center justify-between">
                                    <span className="text-gray-600">Gesamtnote ≥ 4.0:</span>
                                    <span className={`font-medium ${certStatus.conditions.averageOk ? 'text-green-600' : 'text-red-600'}`}>
                                      {certStatus.average.toFixed(1)} {certStatus.conditions.averageOk ? '✅' : '❌'}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-gray-600">Max. 2 ungenügende Noten:</span>
                                    <span className={`font-medium ${certStatus.conditions.insufficientOk ? 'text-green-600' : 'text-red-600'}`}>
                                      {certStatus.insufficientCount} {certStatus.conditions.insufficientOk ? '✅' : '❌'}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-gray-600">Notenabweichung ≤ 2.0:</span>
                                    <span className={`font-medium ${certStatus.conditions.deficitOk ? 'text-green-600' : 'text-red-600'}`}>
                                      {certStatus.deficit.toFixed(1)} {certStatus.conditions.deficitOk ? '✅' : '❌'}
                                    </span>
                                  </div>
                                </div>
                                <div className={`mt-3 p-2 text-center font-bold rounded ${certStatus.isPassed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                  {certStatus.isPassed ? '🎉 Diplom bestanden!' : '⚠️ Diplom nicht bestanden'}
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    {[
                      ...BM_SUBJECTS[bmType].grundlagen,
                      ...(BM_SUBJECTS[bmType].schwerpunkt || []),
                      ...(BM_SUBJECTS[bmType].erganzung || []),
                      ...(BM_SUBJECTS[bmType].interdisziplinar || [])
                    ].map(subject => {
                      const erfahrungsnote = calculations.getErfahrungsnote(subject);
                      const simulatedExamGrade = examSimulator[subject];
                      const definitiveExamGrade = finalExamGrades[subject];
                      const maturnote = calculations.getExamAverage(subject);
                      const requiredExam = calculations.getRequiredExamGrade(subject, maturnoteGoal);
                      const isExamSubject = EXAM_SUBJECTS[bmType].includes(subject);
                      const isInterdisciplinary = BM_SUBJECTS[bmType].interdisziplinar.includes(subject);
                      const hasFinalInput = isExamSubject || isInterdisciplinary;
                      const simulatedLabel = isInterdisciplinary ? 'Simulierte IDPA-Projektnote' : 'Simulierte Abschlussprüfungsnote';
                      const definitiveLabel = isInterdisciplinary ? 'Definitive IDPA-Projektnote' : 'Definitive Abschlussprüfungsnote';

                      return (
                        <div key={subject} className="border-2 border-green-200 rounded-lg p-4 bg-gradient-to-r from-green-50 to-emerald-50">
                          <h3 className="font-semibold text-gray-800 mb-3">{subject}</h3>

                          <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                            <div>
                              <span className="text-gray-600">Erfahrungsnote:</span>
                              <div className="font-bold text-lg">{erfahrungsnote?.toFixed(1) || '-'}</div>
                            </div>
                            {hasFinalInput && (
                              <div>
                                <span className="text-gray-600">Benötigte Note:</span>
                                <div className="font-bold text-lg text-blue-600">
                                  {requiredExam?.toFixed(1) || '-'}
                                </div>
                              </div>
                            )}
                          </div>

                          {hasFinalInput && (
                            <div className="grid gap-3 sm:grid-cols-2 mb-3">
                              <div>
                                <label className="block text-xs text-gray-700 mb-1">{simulatedLabel}</label>
                                <input
                                  type="number"
                                  step="0.5"
                                  min="1"
                                  max="6"
                                  value={simulatedExamGrade || ''}
                                  onChange={(e) => {
                                    const value = parseFloat(e.target.value);
                                    if (value >= 1 && value <= 6) {
                                      setExamSimulator({ ...examSimulator, [subject]: value });
                                    } else if (e.target.value === '') {
                                      setExamSimulator({ ...examSimulator, [subject]: '' });
                                    }
                                  }}
                                  onBlur={async (e) => {
                                    const value = parseFloat(e.target.value);
                                    if (Number.isFinite(value)) {
                                      const clamped = Math.min(6, Math.max(1, value));
                                      setExamSimulator({ ...examSimulator, [subject]: clamped });
                                      if (user && database.userId && database.setExamGrade) {
                                        await database.setExamGrade(subject, clamped).catch(err => console.warn('Error saving simulated exam grade:', err.message || err));
                                      }
                                    }
                                  }}
                                  className="w-full p-2 border border-gray-300 rounded"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-700 mb-1">{definitiveLabel}</label>
                                <input
                                  type="number"
                                  step="0.5"
                                  min="1"
                                  max="6"
                                  value={definitiveExamGrade || ''}
                                  onChange={(e) => {
                                    const value = parseFloat(e.target.value);
                                    if (value >= 1 && value <= 6) {
                                      setFinalExamGrades({ ...finalExamGrades, [subject]: value });
                                    } else if (e.target.value === '') {
                                      setFinalExamGrades({ ...finalExamGrades, [subject]: '' });
                                    }
                                  }}
                                  onBlur={async (e) => {
                                    const value = parseFloat(e.target.value);
                                    if (Number.isFinite(value)) {
                                      const clamped = Math.min(6, Math.max(1, value));
                                      setFinalExamGrades({ ...finalExamGrades, [subject]: clamped });
                                      if (user && database.userId && database.setFinalExamGrade) {
                                        await database.setFinalExamGrade(subject, clamped).catch(err => console.warn('Error saving definitive exam grade:', err.message || err));
                                      }
                                    }
                                  }}
                                  className="w-full p-2 border border-gray-300 rounded"
                                />
                              </div>
                            </div>
                          )}

                          {maturnote && (
                            <div className="bg-white rounded p-3 text-center">
                              <div className="text-xs text-gray-600 mb-1">Maturnote</div>
                              <div className={`text-2xl font-bold ${maturnote >= 5.5 ? 'text-green-700' :
                                maturnote >= 4.0 ? 'text-blue-700' :
                                  'text-red-700'
                                }`}>
                                {maturnote.toFixed(1)}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-8 py-6 text-center text-gray-600 text-sm">
          Made with ❤️ and 👾 by Kinomé - <a href="mailto:schulnetz2.0@kinome.one" className="text-indigo-600 hover:underline">Probleme oder Feedback</a>
        </footer>

        {/* Floating Help Button to Restart Tour */}
        <button
          onClick={() => { setRunTour(true); window.scrollTo(0,0); }}
          className="fixed bottom-6 right-6 w-12 h-12 bg-purple-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-purple-700 transition shadow-purple-500/30 z-[9000]"
          title="Relancer le tutoriel"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinelinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        </button>
      </div>
    </div>
  );
}
