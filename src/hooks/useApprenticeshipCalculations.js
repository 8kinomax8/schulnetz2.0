import {
  calculateModuleAverage,
  calculateRawModuleAverage,
  calculateModulesAverage,
  calculateRawModulesAverage,
  calculateModulesAverageFromModules,
  calculateRawModulesAverageFromModules,
  calculateRequiredWeightedGrade,
  calculateSchoolPart,
  calculateFinalGrade,
  calculateRequiredIpa,
  calculateUekAverage,
  calculateRawUekAverage,
  parseWeight,
  simulateModuleAverage,
  simulateUekAverage
} from '../services/calculationService';

/**
 * Hook de calculs pour la Berufsschule (EFZ)
 * @param {Object} modules - Notes par module { moduleId: [{grade, weight}, ...] }
 * @param {Object} modulePlans - Notes planifiees par module { moduleId: [{grade, weight}, ...] }
 * @param {Array} uekGrades - Notes d'ueK
 * @param {Array} uekPlans - Notes d'ueK planifiees
 * @param {number|null} ipaGrade - Note IPA
 * @returns {Object} Fonctions de calcul
 */
export const useApprenticeshipCalculations = (
  modules,
  modulePlans,
  uekGrades,
  uekPlans,
  ipaGrade
) => {
  const getModuleAverage = (moduleId) => {
    return calculateModuleAverage(modules?.[moduleId]);
  };

  const getRawModuleAverage = (moduleId) => {
    return calculateRawModuleAverage(modules?.[moduleId]);
  };

  const getSimulatedModuleAverage = (moduleId) => {
    const currentGrades = modules?.[moduleId] || [];
    const plannedGrades = modulePlans?.[moduleId] || [];
    return simulateModuleAverage(currentGrades, plannedGrades);
  };

  const getModulesAverage = () => {
    return calculateModulesAverageFromModules(modules || {});
  };

  const getRawModulesAverage = () => {
    return calculateRawModulesAverageFromModules(modules || {});
  };

  const getSimulatedModulesAverage = () => {
    const moduleIds = new Set([
      ...Object.keys(modules || {}),
      ...Object.keys(modulePlans || {})
    ]);

    const simulatedAverages = Array.from(moduleIds)
      .map((moduleId) => getSimulatedModuleAverage(moduleId))
      .filter((value) => Number.isFinite(value));

    return calculateModulesAverage(simulatedAverages);
  };

  const getRawSimulatedModulesAverage = () => {
    const moduleIds = new Set([
      ...Object.keys(modules || {}),
      ...Object.keys(modulePlans || {})
    ]);

    const simulatedAverages = Array.from(moduleIds)
      .map((moduleId) => getSimulatedModuleAverage(moduleId))
      .filter((value) => Number.isFinite(value));

    return calculateRawModulesAverage(simulatedAverages);
  };

  const getRequiredModuleGrade = (moduleId, targetAverage, nextWeight = 1) => {
    const currentGrades = modules?.[moduleId] || [];
    return calculateRequiredWeightedGrade(currentGrades, targetAverage, nextWeight);
  };

  const getUekAverage = () => {
    return calculateUekAverage(uekGrades || []);
  };

  const getRawUekAverage = () => {
    return calculateRawUekAverage(uekGrades || []);
  };

  const getSimulatedUekAverage = () => {
    return simulateUekAverage(uekGrades || [], uekPlans || []);
  };

  const getSchoolPart = () => {
    return calculateSchoolPart(getModulesAverage(), getUekAverage());
  };

  const getRawSchoolPart = () => {
    const modulesAverage = getRawModulesAverage();
    const uekAverage = getRawUekAverage();
    if (!Number.isFinite(modulesAverage) || !Number.isFinite(uekAverage)) return null;
    return (modulesAverage * 0.8) + (uekAverage * 0.2);
  };

  const getSimulatedSchoolPart = () => {
    return calculateSchoolPart(getSimulatedModulesAverage(), getSimulatedUekAverage());
  };

  const getFinalGrade = (overrideIpaGrade = null) => {
    const ipa = Number.isFinite(overrideIpaGrade) ? overrideIpaGrade : ipaGrade;
    return calculateFinalGrade(getSchoolPart(), ipa);
  };

  const getSimulatedFinalGrade = (overrideIpaGrade = null) => {
    const ipa = Number.isFinite(overrideIpaGrade) ? overrideIpaGrade : ipaGrade;
    return calculateFinalGrade(getSimulatedSchoolPart(), ipa);
  };

  const getRequiredIpaGrade = (targetFinal, useSimulated = false) => {
    const schoolPart = useSimulated ? getSimulatedSchoolPart() : getSchoolPart();
    return calculateRequiredIpa(targetFinal, schoolPart);
  };

  /**
   * Get overall final grade for the entire apprenticeship (Berufsschule)
   * For overview/dashboard display
   * @returns {number|null} Either final CFC grade (if IPA exists) or schoolPart only
   */
  const getOverallFinalGrade = () => {
    // If IPA grade exists, return full CFC grade (50% schoolPart + 50% IPA)
    if (Number.isFinite(ipaGrade)) {
      return getFinalGrade();
    }
    const schoolPart = getSchoolPart();
    if (Number.isFinite(schoolPart)) return schoolPart;
    return getModulesAverage();
  };

  const getRawOverallFinalGrade = () => {
    if (Number.isFinite(ipaGrade)) {
      const schoolPart = getRawSchoolPart();
      if (!Number.isFinite(schoolPart)) return null;
      return (schoolPart * 0.5) + (ipaGrade * 0.5);
    }
    const schoolPart = getRawSchoolPart();
    if (Number.isFinite(schoolPart)) return schoolPart;
    return getRawModulesAverage();
  };

  return {
    // Modules
    getModuleAverage,
    getRawModuleAverage,
    getSimulatedModuleAverage,
    getModulesAverage,
    getRawModulesAverage,
    getSimulatedModulesAverage,
    getRawSimulatedModulesAverage,
    getRequiredModuleGrade,

    // ueK
    getUekAverage,
    getRawUekAverage,
    getSimulatedUekAverage,

    // Final grades
    getSchoolPart,
    getRawSchoolPart,
    getSimulatedSchoolPart,
    getFinalGrade,
    getSimulatedFinalGrade,
    getRequiredIpaGrade,
    getOverallFinalGrade,
    getRawOverallFinalGrade,

    // Utilities
    parseWeight
  };
};
