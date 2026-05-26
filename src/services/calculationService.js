/**
 * Service de calculs pour les moyennes et notes
 */

/**
 * Calcule la moyenne pondérée d'un ensemble de notes
 * @param {Array} grades - Tableau de notes avec {grade, weight}
 * @returns {number|null} Moyenne pondérée ou null si pas de notes
 */
export const calculateWeightedAverage = (grades) => {
  if (!grades || grades.length === 0) return null;
  const totalWeight = grades.reduce((sum, g) => sum + g.weight, 0);
  const weightedSum = grades.reduce((sum, g) => sum + (g.grade * g.weight), 0);
  return totalWeight > 0 ? weightedSum / totalWeight : null;
};

/**
 * Arrondit une valeur au demi-point ou point entier le plus proche
 * @param {number} value - Valeur à arrondir
 * @returns {number} Valeur arrondie
 */
export const roundToHalfOrWhole = (value) => {
  if (!Number.isFinite(value)) return null;
  return Math.floor((value * 2) + 0.5 + Number.EPSILON) / 2;
};

/**
 * Arrondit une valeur au dixième le plus proche
 * @param {number} value - Valeur à arrondir
 * @returns {number} Valeur arrondie au dixième
 */
export const roundToTenth = (value) => {
  if (!Number.isFinite(value)) return null;
  return Math.round((value + Number.EPSILON) * 10) / 10;
};

/**
 * Calcule la moyenne semestrielle d'une matière
 * @param {Array} grades - Notes de la matière
 * @returns {number|null} Moyenne arrondie ou null
 */
export const calculateSemesterAverage = (grades) => {
  const avg = calculateWeightedAverage(normalizeWeightedGrades(grades));
  return avg === null ? null : roundToHalfOrWhole(avg);
};

/**
 * Calcule l'Erfahrungsnote (note d'expérience) basée sur les moyennes semestrielles
 * @param {Object} semesterGrades - Object avec les notes par semestre {1: 5.5, 2: 5.0, ...}
 * @returns {number|null} Erfahrungsnote arrondie ou null
 */
export const calculateErfahrungsnote = (semesterGrades) => {
  if (!semesterGrades) return null;
  const values = Object.values(semesterGrades);
  if (values.length === 0) return null;
  const avg = values.reduce((sum, g) => sum + g, 0) / values.length;
  return roundToHalfOrWhole(avg);
};

/**
 * Calcule la note requise pour atteindre une moyenne cible
 * @param {Array} currentGrades - Notes actuelles
 * @param {number} targetAverage - Moyenne cible
 * @param {number} nextWeight - Pondération du prochain contrôle
 * @returns {number|null} Note requise ou null
 */
export const calculateRequiredGrade = (currentGrades, targetAverage, nextWeight = 1) => {
  const normalizedGrades = normalizeWeightedGrades(currentGrades);
  if (normalizedGrades.length === 0) return null;

  const parsedNextWeight = parseWeight(nextWeight);
  if (!Number.isFinite(parsedNextWeight) || parsedNextWeight <= 0) return null;
  
  const currentTotalWeight = normalizedGrades.reduce((sum, g) => sum + g.weight, 0);
  const totalWeight = currentTotalWeight + parsedNextWeight;
  const currentSum = normalizedGrades.reduce((sum, g) => sum + (g.grade * g.weight), 0);
  
  return (targetAverage * totalWeight - currentSum) / parsedNextWeight;
};

/**
 * Calcule la note requise avec parsing de ponderations
 * @param {Array} currentGrades - Notes actuelles
 * @param {number} targetAverage - Moyenne cible
 * @param {number|string} nextWeight - Pond. du prochain controle
 * @returns {number|null} Note requise ou null
 */
export const calculateRequiredWeightedGrade = (currentGrades, targetAverage, nextWeight = 1) => {
  const normalizedGrades = normalizeWeightedGrades(currentGrades);
  if (normalizedGrades.length === 0) return null;

  const parsedNextWeight = parseWeight(nextWeight);
  if (!Number.isFinite(parsedNextWeight)) return null;

  const currentTotalWeight = normalizedGrades.reduce((sum, g) => sum + g.weight, 0);
  const totalWeight = currentTotalWeight + parsedNextWeight;
  const currentSum = normalizedGrades.reduce((sum, g) => sum + (g.grade * g.weight), 0);

  return (targetAverage * totalWeight - currentSum) / parsedNextWeight;
};

/**
 * Simule une moyenne avec des contrôles planifiés
 * @param {Array} currentGrades - Notes actuelles
 * @param {Array} plannedControls - Contrôles planifiés
 * @returns {number|null} Moyenne simulée
 */
export const simulateAverage = (currentGrades, plannedControls) => {
  const allGrades = normalizeWeightedGrades([...(currentGrades || []), ...(plannedControls || [])]);
  return calculateWeightedAverage(allGrades);
};

/**
 * Parse une pondération en format texte vers un nombre
 * @param {string|number} weight - Pondération (ex: "1/2", "50%", "1.5")
 * @returns {number} Pondération en nombre décimal
 */
export const parseWeight = (weight) => {
  if (typeof weight === 'number') return weight;
  if (typeof weight !== 'string') return parseFloat(weight);
  
  if (weight.includes('/')) {
    const [num, den] = weight.split('/').map(n => parseFloat(n.trim()));
    return num / den;
  }
  if (weight.includes('%')) {
    return parseFloat(weight.replace('%', '').trim()) / 100;
  }
  return parseFloat(weight);
};

/**
 * Calcule le statut de promotion semestrielle (règles BM1)
 * @param {Object} semesterGrades - Notes semestrielles par matière
 * @param {string} bmType - Type de BM (TAL, WMU, etc.)
 * @returns {Object} Statut avec {average, deficit, insufficientCount, isPromoted}
 */
export const calculatePromotionStatus = (semesterGrades) => {
  if (!semesterGrades) {
    return { average: null, deficit: null, insufficientCount: null, isPromoted: null };
  }

  // Exclude IDAF from calculation
  const gradesWithoutIDAF = Object.entries(semesterGrades)
    .filter(([subject]) => subject !== 'Interdisziplinäres Arbeiten in den Fächern');

  if (gradesWithoutIDAF.length === 0) {
    return { average: null, deficit: null, insufficientCount: null, isPromoted: null };
  }

  // Overall average (rounded to tenth, not half-point)
  const sum = gradesWithoutIDAF.reduce((acc, [, grade]) => acc + grade, 0);
  const average = roundToTenth(sum / gradesWithoutIDAF.length);

  // Total deficit
  const deficit = gradesWithoutIDAF.reduce((acc, [, grade]) => {
    return grade < 4 ? acc + (4 - grade) : acc;
  }, 0);

  // Number of insufficient grades (< 4)
  const insufficientCount = gradesWithoutIDAF.filter(([, grade]) => grade < 4).length;

  // Promotion conditions (BM1)
  const condition1 = average >= 4.0;
  const condition2 = deficit <= 2.0;
  const condition3 = insufficientCount <= 2;
  const isPromoted = condition1 && condition2 && condition3;

  return {
    average,
    deficit: parseFloat(deficit.toFixed(1)),
    insufficientCount,
    isPromoted,
    conditions: {
      averageOk: condition1,
      deficitOk: condition2,
      insufficientOk: condition3
    }
  };
};

const normalizeWeightedGrades = (grades) => {
  if (!grades || grades.length === 0) return [];
  return grades
    .map((g) => {
      const grade = parseFloat(g.grade ?? g);
      const weight = parseWeight(g.weight ?? 1);
      if (!Number.isFinite(grade) || !Number.isFinite(weight)) return null;
      return { grade, weight };
    })
    .filter(Boolean);
};

// normalizeGrades removed (unused)

/**
 * Calcule la note d'Abschlussprüfung pour Naturwissenschaften (Chimie + Physique)
 * Formule d'après D1077 V5 : N_NW = ((P_Ch · 0.5 + P_Ph) · 5) / 150 + 1.
 * Si l'UI fournit déjà des notes suisses (1-6), cela revient à une moyenne
 * pondérée 0.5:1 entre Chimie et Physique.
 */
export const calculateNaturwissenschaftExamGrade = (chemieGrade, physiqueGrade) => {
  const ch = parseFloat(chemieGrade);
  const ph = parseFloat(physiqueGrade);

  if (!Number.isFinite(ch) || !Number.isFinite(ph)) return null;
  if (ch < 1 || ch > 6 || ph < 1 || ph > 6) return null;

  return roundToHalfOrWhole(((0.5 * ch) + ph) / 1.5);
};

/**
 * Maturprüfungsnote = moyenne des Abschlussprüfungen d'une branche,
 * puis arrondie au demi-point.
 */
export const calculateMaturExamGrade = (examGrades) => {
  const values = (examGrades || [])
    .map((grade) => parseFloat(grade))
    .filter(Number.isFinite);
  if (values.length === 0) return null;
  const avg = values.reduce((sum, grade) => sum + grade, 0) / values.length;
  return roundToHalfOrWhole(avg);
};

/**
 * Maturnote Fach = (Erfahrungsnote + Maturprüfungsnote) / 2,
 * puis arrondie au demi-point.
 */
export const calculateMaturnoteWithExam = (erfahrungsnote, examGrade) => {
  const erf = parseFloat(erfahrungsnote);
  const exam = parseFloat(examGrade);
  if (!Number.isFinite(erf) || !Number.isFinite(exam)) return null;
  return roundToHalfOrWhole((erf + exam) / 2);
};

/**
 * Gesamtnote BM: moyenne de toutes les notes comptantes, arrondie au dixième.
 */
export const calculateBmOverallAverage = (maturnotes) => {
  const values = (maturnotes || []).map(Number).filter(Number.isFinite);
  if (values.length === 0) return null;
  return roundToTenth(values.reduce((sum, value) => sum + value, 0) / values.length);
};

/**
 * Calcule la moyenne d'un module (ponderee) et arrondit au demi-point
 * @param {Array} grades - Notes du module avec {grade, weight}
 * @returns {number|null} Moyenne arrondie ou null
 */
export const calculateModuleAverage = (grades) => {
  const normalizedGrades = normalizeWeightedGrades(grades);
  const avg = calculateWeightedAverage(normalizedGrades);
  return avg === null ? null : roundToHalfOrWhole(avg);
};

export const calculateRawModuleAverage = (grades) => {
  const normalizedGrades = normalizeWeightedGrades(grades);
  return calculateWeightedAverage(normalizedGrades);
};

/**
 * Calcule la moyenne arithmetique des modules puis arrondit au demi-point
 * @param {number[]} moduleAverages - Tableau des moyennes de module
 * @returns {number|null} Moyenne arrondie ou null
 */
export const calculateModulesAverage = (moduleAverages) => {
  const values = (moduleAverages || []).filter((value) => Number.isFinite(value));
  if (values.length === 0) return null;
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return roundToHalfOrWhole(avg);
};

export const calculateRawModulesAverage = (moduleAverages) => {
  const values = (moduleAverages || []).filter((value) => Number.isFinite(value));
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

/**
 * Calcule la moyenne des modules depuis un objet de modules
 * @param {Object} modules - { moduleId: [{grade, weight}, ...] }
 * @returns {number|null} Moyenne arrondie ou null
 */
export const calculateModulesAverageFromModules = (modules) => {
  const moduleAverages = Object.values(modules || {})
    .map((grades) => calculateRawModuleAverage(grades))
    .filter((value) => Number.isFinite(value));
  return calculateModulesAverage(moduleAverages);
};

export const calculateRawModulesAverageFromModules = (modules) => {
  const moduleAverages = Object.values(modules || {})
    .map((grades) => calculateRawModuleAverage(grades))
    .filter((value) => Number.isFinite(value));
  return calculateRawModulesAverage(moduleAverages);
};

/**
 * Calcule la moyenne des notes d'ueK et arrondit au demi-point
 * @param {Array} uekGrades - Notes d'ueK
 * @returns {number|null} Moyenne arrondie ou null
 */
export const calculateUekAverage = (uekGrades) => {
  const normalizedGrades = normalizeWeightedGrades(uekGrades);
  if (normalizedGrades.length === 0) return null;
  const avg = calculateWeightedAverage(normalizedGrades);
  return avg === null ? null : roundToHalfOrWhole(avg);
};

export const calculateRawUekAverage = (uekGrades) => {
  const normalizedGrades = normalizeWeightedGrades(uekGrades);
  return calculateWeightedAverage(normalizedGrades);
};

/**
 * Simule la moyenne d'un module avec des notes planifiees
 * @param {Array} currentGrades - Notes actuelles
 * @param {Array} plannedGrades - Notes planifiees
 * @returns {number|null} Moyenne arrondie ou null
 */
export const simulateModuleAverage = (currentGrades, plannedGrades) => {
  const mergedGrades = normalizeWeightedGrades([...(currentGrades || []), ...(plannedGrades || [])]);
  const avg = calculateWeightedAverage(mergedGrades);
  return avg === null ? null : roundToHalfOrWhole(avg);
};

/**
 * Simule la moyenne d'ueK avec des notes planifiees
 * @param {Array} currentGrades - Notes actuelles
 * @param {Array} plannedGrades - Notes planifiees
 * @returns {number|null} Moyenne arrondie ou null
 */
export const simulateUekAverage = (currentGrades, plannedGrades) => {
  const normalizedGrades = normalizeWeightedGrades([...(currentGrades || []), ...(plannedGrades || [])]);
  if (normalizedGrades.length === 0) return null;
  const avg = calculateWeightedAverage(normalizedGrades);
  return avg === null ? null : roundToHalfOrWhole(avg);
};

/**
 * Calcule la partie ecole (80% modules, 20% ueK), arrondie au demi-point
 * @param {number|null} modulesAverage - Moyenne modules arrondie a 0.5
 * @param {number|null} uekAverage - Moyenne ueK arrondie a 0.5
 * @returns {number|null} Partie ecole arrondie ou null (null if either is missing)
 */
export const calculateSchoolPart = (modulesAverage, uekAverage) => {
  if (!Number.isFinite(modulesAverage) || !Number.isFinite(uekAverage)) return null;
  return roundToHalfOrWhole((modulesAverage * 0.8) + (uekAverage * 0.2));
};

/**
 * Calcule la note finale CFC (50% ecole, 50% IPA), arrondie au dixieme
 * @param {number|null} schoolPart - Partie ecole arrondie a 0.1
 * @param {number|null} ipaGrade - Note IPA
 * @returns {number|null} Note finale arrondie ou null
 */
export const calculateFinalGrade = (schoolPart, ipaGrade) => {
  if (!Number.isFinite(schoolPart) || !Number.isFinite(ipaGrade)) return null;
  return roundToTenth((schoolPart * 0.5) + (ipaGrade * 0.5));
};

/**
 * Calcule la note IPA requise pour atteindre une cible
 * @param {number} targetFinal - Note finale cible
 * @param {number|null} schoolPart - Partie ecole arrondie a 0.1
 * @returns {number|null} Note IPA requise ou null
 */
export const calculateRequiredIpa = (targetFinal, schoolPart) => {
  if (!Number.isFinite(targetFinal) || !Number.isFinite(schoolPart)) return null;
  return (targetFinal * 2) - schoolPart;
};

/**
 * Calcule le statut de réussite du certificat final (Bestehen) sur la base des notes de maturité.
 * Les règles de réussite nécessitent 9 notes comptantes.
 * @param {number[]} maturnotes - Tableau des notes de maturité finales (arrondies à 0.5)
 * @returns {Object} Statut de réussite
 */
export const calculateFinalCertificationStatus = (maturnotes) => {
  const validNotes = (maturnotes || []).filter(Number.isFinite);
  
  if (validNotes.length === 0) {
    return { average: null, deficit: null, insufficientCount: null, isPassed: null };
  }

  // Gesamtnote: Moyenne arithmétique arrondie à 0.1
  const sum = validNotes.reduce((acc, grade) => acc + grade, 0);
  const average = roundToTenth(sum / validNotes.length);

  // Nombre de notes insuffisantes (< 4.0)
  const insufficientCount = validNotes.filter(grade => grade < 4.0).length;

  // Somme des écarts par rapport à 4.0
  const deficit = validNotes.reduce((acc, grade) => {
    return grade < 4.0 ? acc + (4.0 - grade) : acc;
  }, 0);

  // Conditions de réussite
  const condition1 = average >= 4.0;
  const condition2 = insufficientCount <= 2;
  const condition3 = deficit <= 2.0;
  
  // Normalement l'étudiant doit avoir exactement 9 notes pour que ce soit officiel,
  // mais on donne le résultat sur les notes actuelles s'il y en a.
  const isPassed = condition1 && condition2 && condition3;

  return {
    average,
    deficit: parseFloat(deficit.toFixed(1)),
    insufficientCount,
    isPassed,
    hasAllNotes: validNotes.length === 9,
    conditions: {
      averageOk: condition1,
      insufficientOk: condition2,
      deficitOk: condition3
    }
  };
};
