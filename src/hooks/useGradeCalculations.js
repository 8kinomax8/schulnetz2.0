import {
  calculateSemesterAverage,
  calculateErfahrungsnote,
  calculateRequiredGrade,
  simulateAverage,
  parseWeight,
  calculatePromotionStatus,
  roundToHalfOrWhole,
  calculateMaturnoteWithExam,
  calculateBmOverallAverage,
  calculateMaturExamGrade,
  calculateFinalCertificationStatus
} from '../services/calculationService';
import { BM_SUBJECTS, EXAM_COMPONENTS, EXAM_SUBJECTS } from '../constants';

/**
 * Hook personnalisé pour tous les calculs de notes
 * @param {Object} subjects - Matières avec leurs notes
 * @param {Object} semesterGrades - Notes semestrielles
 * @param {Object} semesterSimulator - Simulateur de semestre
 * @param {Object} examSimulator - Simulateur d'examen
 * @param {Object} finalExamGrades - Definitive final exam grades { subjectName: grade }
 * @param {string} bmType - Type de BM
 * @returns {Object} Fonctions de calcul
 */
export const useGradeCalculations = (subjects, semesterGrades, semesterSimulator, examSimulator, bmType, finalExamGrades = {}) => {
  
  // Calculations for current semester
  const getSemesterAverage = (subject) => {
    return calculateSemesterAverage(subjects[subject]);
  };

  const getErfahrungsnote = (subject) => {
    return calculateErfahrungsnote(semesterGrades[subject]);
  };

  const getRequiredSemesterGrade = (subject, targetAverage, nextWeight = 1) => {
    const currentGrades = subjects[subject] || [];
    return calculateRequiredGrade(currentGrades, targetAverage, nextWeight);
  };

  // Calculations for semester simulator
  const getSimulatedSemesterAverage = (subject) => {
    const currentGrades = subjects[subject] || [];
    const plannedControls = semesterSimulator[subject] || [];
    return simulateAverage(currentGrades, plannedControls);
  };

  // Calculations for final exams
  const getMaturExamGrade = (subject, source = examSimulator) => {
    const examValue = source?.[subject];
    if (examValue && typeof examValue === 'object' && !Array.isArray(examValue)) {
      const components = EXAM_COMPONENTS[bmType]?.[subject] || [];
      const componentGrades = components.map(component => examValue[component.key]);
      return calculateMaturExamGrade(componentGrades);
    }

    const parsed = parseFloat(examValue);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const getExamAverage = (subject) => {
    const erfahrungsnote = getErfahrungsnote(subject);
    if (!erfahrungsnote) return null;

    const isExamSubject = (EXAM_SUBJECTS[bmType] || []).includes(subject);
    const isInterdisciplinary = (BM_SUBJECTS[bmType]?.interdisziplinar || []).includes(subject);
    const definitiveExamGrade = getMaturExamGrade(subject, finalExamGrades);
    const simulatedExamGrade = getMaturExamGrade(subject, examSimulator);

    if (!isExamSubject && !isInterdisciplinary) return erfahrungsnote;
    if (Number.isFinite(definitiveExamGrade)) {
      return calculateMaturnoteWithExam(erfahrungsnote, definitiveExamGrade);
    }
    if (!Number.isFinite(simulatedExamGrade)) return null;
    return calculateMaturnoteWithExam(erfahrungsnote, simulatedExamGrade);
  };

  const getRequiredExamGrade = (subject, targetAverage) => {
    const erfahrungsnote = getErfahrungsnote(subject);
    if (!erfahrungsnote) return null;
    const canHaveFinalGrade = (EXAM_SUBJECTS[bmType] || []).includes(subject)
      || (BM_SUBJECTS[bmType]?.interdisziplinar || []).includes(subject);
    if (!canHaveFinalGrade) return null;

    const targetBeforeRounding = targetAverage - 0.25;
    return 2 * targetBeforeRounding - erfahrungsnote;
  };

  // Calculate overall average (Gesamtnote)
  const getOverallAverage = () => {
    const countingSubjects = [
      ...(BM_SUBJECTS[bmType]?.grundlagen || []),
      ...(BM_SUBJECTS[bmType]?.schwerpunkt || []),
      ...(BM_SUBJECTS[bmType]?.erganzung || []),
      ...(BM_SUBJECTS[bmType]?.interdisziplinar || [])
    ];

    const maturnotes = countingSubjects
      .map(subject => getExamAverage(subject))
      .filter(Number.isFinite);

    return calculateBmOverallAverage(maturnotes);
  };

  const getFinalCertificationStatus = () => {
    const countingSubjects = [
      ...(BM_SUBJECTS[bmType]?.grundlagen || []),
      ...(BM_SUBJECTS[bmType]?.schwerpunkt || []),
      ...(BM_SUBJECTS[bmType]?.erganzung || []),
      ...(BM_SUBJECTS[bmType]?.interdisziplinar || [])
    ];

    const maturnotes = countingSubjects
      .map(subject => getExamAverage(subject))
      .filter(Number.isFinite);

    return calculateFinalCertificationStatus(maturnotes);
  };

  // Semester promotion status
  const getPromotionStatus = (simulatedGrades = null) => {
    const gradesToUse = simulatedGrades || Object.entries(semesterGrades).reduce((acc, [subject, grades]) => {
      const latestSemester = Math.max(...Object.keys(grades).map(Number));
      acc[subject] = grades[latestSemester];
      return acc;
    }, {});

    return calculatePromotionStatus(gradesToUse, bmType);
  };

  // Simulated promotion status
  const getSimulatedPromotionStatus = () => {
    const simulatedGrades = {};
    
    Object.keys(subjects).forEach(subject => {
      const simAvg = getSimulatedSemesterAverage(subject);
      if (simAvg) {
        simulatedGrades[subject] = roundToHalfOrWhole(simAvg);
      }
    });

    return calculatePromotionStatus(simulatedGrades, bmType);
  };

  return {
    // Current semester
    getSemesterAverage,
    getErfahrungsnote,
    getRequiredSemesterGrade,
    
    // Simulator
    getSimulatedSemesterAverage,
    
    // Exams
    getMaturExamGrade,
    getExamAverage,
    getRequiredExamGrade,
    getOverallAverage,
    getFinalCertificationStatus,
    
    // Promotion
    getPromotionStatus,
    getSimulatedPromotionStatus,
    
    // Utilities
    parseWeight
  };
};
