import { roundToHalfOrWhole } from '../services/calculationService';

/**
 * Calcule la moyenne des notes
 * @param {number[]} grades - Tableau de notes
 * @returns {number} Moyenne arrondie à 2 décimales
 */
export const calculateAverage = (grades) => {
  if (!grades || grades.length === 0) return 0;
  const validGrades = grades.filter(g => g > 0);
  if (validGrades.length === 0) return 0;
  const sum = validGrades.reduce((acc, grade) => acc + grade, 0);
  return Math.round((sum / validGrades.length) * 100) / 100;
};

/**
 * Arrondit une note selon les règles BM (0.5)
 * @param {number} grade - Note à arrondir
 * @returns {number} Note arrondie
 */
export const roundGrade = (grade) => {
  return roundToHalfOrWhole(grade);
};

/**
 * Vérifie si une note est valide (entre 1 et 6)
 * @param {number} grade - Note à vérifier
 * @returns {boolean}
 */
export const isValidGrade = (grade) => {
  return grade >= 1 && grade <= 6;
};

/**
 * Formatte une note pour l'affichage
 * @param {number} grade - Note à formatter
 * @returns {string} Note formatée
 */
export const formatGrade = (grade) => {
  if (!grade || grade === 0) return '-';
  return grade.toFixed(2);
};

/**
 * Formatte une date au format suisse (DD.MM.YYYY)
 * @param {string|Date} date - Date à formater
 * @returns {string} Date formatée
 */
export const formatSwissDate = (date) => {
  if (!date) return '';
  
  try {
    // Handle various date formats
    let d;
    if (date instanceof Date) {
      d = date;
    } else if (typeof date === 'string') {
      // Remove time portion if present (e.g., "2025-12-18T00:00:00.000Z")
      const dateOnly = date.split('T')[0];
      
      // Check if already in DD.MM.YYYY format
      if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(date)) {
        return date;
      }
      
      // Parse ISO format (YYYY-MM-DD)
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
        const [year, month, day] = dateOnly.split('-');
        return `${day}.${month}.${year}`;
      }
      
      // Try to parse as date
      d = new Date(date);
    }
    
    if (d && !isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}.${month}.${year}`;
    }
    
    return date; // Return original if can't parse
  } catch {
    return date;
  }
};
