/**
 * Service API pour l'analyse des bulletins et screenshots SAL
 */

import { formatSwissDate } from '../utils';
import { supabase } from './supabaseClient';

/**
 * Convertit un fichier en base64
 * @param {File} file - Fichier à convertir
 * @returns {Promise<string>} Base64 data
 */
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Normalise le nom d'une matière selon la Lektionentafel
 * @param {string} name - Nom brut de la matière
 * @param {Set} validSubjects - Set des matières valides
 * @returns {string|null} Nom canonique ou null si invalide
 */
export const normalizeSubjectName = (name, validSubjects) => {
  if (!name) return null;
  const raw = String(name).trim();
  
  // Ignore numeric codes (e.g.: 129-INP, 202-MAT)
  if (/^\s*\d/.test(raw)) return null;
  
  const n = raw.toLowerCase();
  let canon = null;
  
  // Common mappings
  if (n.startsWith('idaf') || n === 'idaf' || n.includes('interdisziplin')) {
    canon = 'Interdisziplinäres Arbeiten in den Fächern';
  } else if (n === 'frw' || n.includes('finanz')) {
    canon = 'Finanz- und Rechnungswesen';
  } else if (n === 'wr' || n.includes('wirtschaft und recht')) {
    canon = 'Wirtschaft und Recht';
  } else if (n.startsWith('geschichte')) {
    canon = 'Geschichte und Politik';
  } else if (n.startsWith('mathematik')) {
    canon = 'Mathematik';
  } else if (n.startsWith('deutsch')) {
    canon = 'Deutsch';
  } else if (n.startsWith('englisch')) {
    canon = 'Englisch';
  } else if (n.startsWith('franz')) {
    canon = 'Französisch';
  } else if (n.includes('natur')) {
    canon = 'Naturwissenschaften';
  }
  
  if (canon) return validSubjects.has(canon) ? canon : null;
  
  // Try an exact match
  const candidate = raw.replace(/\s+/g, ' ');
  return validSubjects.has(candidate) ? candidate : null;
};

/**
 * Analyse un bulletin ou screenshot SAL via l'API
 * @param {File} file - Fichier image/PDF à analyser
 * @param {string} scanType - Type de scan ('SAL' ou 'Bulletin')
 * @returns {Promise<Object>} Résultat de l'analyse
 */
export const analyzeBulletin = async (file, scanType = 'Bulletin') => {
  try {
    const base64Data = await fileToBase64(file);
    
    // Validate file type
    const mimeType = file.type || 'image/jpeg';
    if (!mimeType.startsWith('image/') && mimeType !== 'application/pdf') {
      throw new Error(`Unsupported file type: ${mimeType}. Only images and PDFs are accepted.`);
    }
    
    // Get authentication token
    const { data, error: sessionError } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    
    if (!token) {
      throw new Error('Authentication required. Please log in to scan documents.');
    }
    
    // Build data URI in correct format: data:image/type;base64,ABC123...
    const dataUri = `data:${mimeType};base64,${base64Data}`;
    console.log(`🔵 Sending scan request (type: ${scanType}, mimeType: ${mimeType}, size: ${base64Data.length} bytes)`);
    
    const response = await fetch('/api/scan', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        image: dataUri,
        scanType
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      const errorMsg = errorData.error || `HTTP ${response.status}`;
      console.error(`❌ API error (${response.status}):`, errorMsg);
      throw new Error(errorMsg);
    }

    const data_response = await response.json();
    
    if (!data_response.content || !data_response.content[0] || !data_response.content[0].text) {
      throw new Error('Invalid API response: ' + JSON.stringify(data_response));
    }
    
    const textContent = data_response.content[0].text;
    const cleanText = textContent.replace(/```json|```/g, '').trim();
    const result = JSON.parse(cleanText);

    return result;
  } catch (error) {
    console.error('Analysis error:', error);
    throw error;
  }
};

/**
 * Traite le résultat d'un scan SAL et retourne les contrôles à ajouter
 * @param {Object} result - Résultat de l'API
 * @param {Object} currentSubjects - Matières actuelles
 * @param {Set} validSubjects - Set des matières valides
 * @returns {Object} {updatedSubjects, addedControls}
 */
export const processSALScan = (result, currentSubjects, validSubjects) => {
  const newSubjects = { ...currentSubjects };
  const addedControls = [];

  const normalizeNumber = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const cleaned = String(value).replace(',', '.');
    const parsed = parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  };

  if (!result.controls) {
    return { updatedSubjects: newSubjects, addedControls };
  }

  result.controls.forEach((control) => {
    const canon = normalizeSubjectName(control.subject, validSubjects);
    if (!canon) return;

    // Validate grade is present and valid
    const normalizedGrade = normalizeNumber(control.grade);
    if (normalizedGrade === null || normalizedGrade === 0) {
      console.log(`⏭️  Skipping ${control.subject} - no grade provided`);
      return; // Skip controls without a grade
    }

    const normalizedDate = control.date ? formatSwissDate(control.date) : '';
    const normalizedWeight = Math.max(1, Math.round(normalizeNumber(control.weight) || 1));
    const controlId = `${canon}-${normalizedDate}-${normalizedGrade}`;
    
    // Check if this assessment already exists
    const existingGrades = newSubjects[canon] || [];
    const alreadyExists = existingGrades.some(g => 
      g.controlId === controlId || 
      (formatSwissDate(g.date) === normalizedDate && Math.abs(g.grade - normalizedGrade) < 0.01)
    );
    
    if (!alreadyExists) {
      if (!newSubjects[canon]) newSubjects[canon] = [];
      newSubjects[canon] = [...newSubjects[canon], {
        grade: normalizedGrade,
        weight: normalizedWeight,
        displayWeight: normalizedWeight.toString(),
        date: normalizedDate,
        name: control.name || '',
        controlId,
        id: Date.now() + Math.random()
      }];
      addedControls.push({
        subject: canon,
        grade: normalizedGrade,
        weight: normalizedWeight,
        date: normalizedDate,
        name: control.name || ''
      });
    }
  });

  return { updatedSubjects: newSubjects, addedControls };
};

/**
 * Traite le résultat d'un scan de bulletin et retourne les notes semestrielles
 * Supporte maintenant plusieurs semestres dans un même bulletin
 * @param {Object} result - Résultat de l'API
 * @param {Object} currentSemesterGrades - Notes semestrielles actuelles
 * @param {Set} validSubjects - Set des matières valides
 * @param {number} currentSemester - Semestre actuel (fallback si pas spécifié)
 * @returns {Object} {updatedSemesterGrades, semestersList}
 */
export const processBulletinScan = (result, currentSemesterGrades, validSubjects, currentSemester) => {
  const normalizeNumber = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const cleaned = String(value).replace(',', '.');
    const parsed = parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const updatedSemesterGrades = { ...currentSemesterGrades };
  const semestersList = []; // List of {semester, mappedGrades}

  // Support both old format (single semester) and new format (multiple semesters)
  const semesters = result.semesters || (result.grades ? [{ semester: result.semester ?? currentSemester, grades: result.grades }] : []);

  semesters.forEach(semesterData => {
    const semester = semesterData.semester ?? currentSemester;
    const grades = semesterData.grades || {};
    const mappedGrades = {};

    Object.entries(grades).forEach(([k, v]) => {
      const canon = normalizeSubjectName(k, validSubjects);
      if (!canon) return;
      const normalizedGrade = normalizeNumber(v);
      if (normalizedGrade !== null) {
        mappedGrades[canon] = normalizedGrade;
      }
    });

    // Update semester grades
    Object.entries(mappedGrades).forEach(([subject, grade]) => {
      if (!updatedSemesterGrades[subject]) {
        updatedSemesterGrades[subject] = {};
      }
      updatedSemesterGrades[subject][semester] = grade;
    });

    // Add to list if grades found
    if (Object.keys(mappedGrades).length > 0) {
      semestersList.push({ semester, mappedGrades });
    }
  });

  return { updatedSemesterGrades, semestersList };
};
