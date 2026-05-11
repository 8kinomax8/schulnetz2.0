import {
  calculateSemesterAverage,
  calculateErfahrungsnote,
  calculateRequiredGrade,
  simulateAverage,
  parseWeight,
  calculatePromotionStatus,
  roundToHalfOrWhole
} from '../services/calculationService';

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
  const getExamAverage = (subject) => {
    // If a definitive final exam grade exists, use it directly
    if (finalExamGrades && Number.isFinite(finalExamGrades[subject])) return finalExamGrades[subject];
    const erfahrungsnote = getErfahrungsnote(subject);
    const examGrade = examSimulator[subject];
    if (!erfahrungsnote || !examGrade) return null;
    return (erfahrungsnote + examGrade) / 2;
  };

  const getRequiredExamGrade = (subject, targetAverage) => {
    const erfahrungsnote = getErfahrungsnote(subject);
    if (!erfahrungsnote) return null;
    return 2 * targetAverage - erfahrungsnote;
  };

  // Calculate overall average (Gesamtnote)
  const getOverallAverage = () => {
    const subjects = Object.keys(semesterGrades);
    if (subjects.length === 0) return null;
    
    let totalWeightedSum = 0;
    let totalWeight = 0;
    
    subjects.forEach(subject => {
      // Prefer definitive final exam grade if available
      if (finalExamGrades && Number.isFinite(finalExamGrades[subject])) {
        totalWeightedSum += finalExamGrades[subject];
        totalWeight += 1;
        return;
      }
      const examGrade = examSimulator[subject];
      if (examGrade) {
        const avg = getExamAverage(subject);
        if (avg) {
          totalWeightedSum += avg;
          totalWeight += 1;
        }
      }
    });
    
    return totalWeight > 0 ? totalWeightedSum / totalWeight : null;
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
    getExamAverage,
    getRequiredExamGrade,
    getOverallAverage,
    
    // Promotion
    getPromotionStatus,
    getSimulatedPromotionStatus,
    
    // Utilities
    parseWeight
  };
};
