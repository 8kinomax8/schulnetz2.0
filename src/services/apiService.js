/**
 * Service API pour l'analyse des bulletins et screenshots SAL
 */

import { formatSwissDate } from '../utils';
import { supabase } from './supabaseClient';

/**
 * Cache para rastrear el estado del rate limiting
 */
let rateLimitState = {
  remaining15m: null,
  remaining24h: null,
  limit15m: 3,
  limit24h: 6,
  lastUpdate: null
};

/**
 * Obtiene el estado actual del rate limiting
 */
export const getRateLimitState = () => rateLimitState;

/**
 * Actualiza el estado del rate limiting basado en headers de respuesta
 */
const updateRateLimitState = (headers) => {
  const remaining15m = headers.get('x-ratelimit-remaining-15m');
  const remaining24h = headers.get('x-ratelimit-remaining-24h');
  const limit15m = headers.get('x-ratelimit-limit-15m');
  const limit24h = headers.get('x-ratelimit-limit-24h');
  
  if (remaining15m !== null) {
    rateLimitState.remaining15m = parseInt(remaining15m, 10);
  }
  if (remaining24h !== null) {
    rateLimitState.remaining24h = parseInt(remaining24h, 10);
  }
  if (limit15m !== null) {
    rateLimitState.limit15m = parseInt(limit15m, 10);
  }
  if (limit24h !== null) {
    rateLimitState.limit24h = parseInt(limit24h, 10);
  }
  rateLimitState.lastUpdate = new Date();
};

/**
 * Convertit un fichier en base64
 * @param {File} file - Fichier à convertir
 * @returns {Promise<string>} Base64 data
 */
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    // Check file size upfront (5MB limit for FileReader to be safe)
    const MAX_FILEREADER_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_FILEREADER_SIZE) {
      reject(new Error(`Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum: ${(MAX_FILEREADER_SIZE / 1024 / 1024).toFixed(0)} MB. Merci de compresser le fichier ou de fournir une version plus petite.`));
      return;
    }

    const reader = new FileReader();
    
    // Add timeout protection (30 seconds)
    const timeoutId = setTimeout(() => {
      reader.abort();
      reject(new Error('Délai d\'attente dépassé lors de la lecture du fichier. Le fichier peut être trop volumineux ou corrompu.'));
    }, 30000);

    // Add error handler
    reader.onerror = () => {
      clearTimeout(timeoutId);
      let errorMsg = 'Erreur lors de la lecture du fichier.';
      const errorName = reader.error?.name;
      
      console.error(`FileReader error: ${errorName}`, reader.error);
      
      if (errorName === 'NotReadableError') {
        errorMsg = 'Le fichier ne peut pas être lu. Il peut être corrompu, protégé ou mal formaté. Essayez de:\n' +
                   '• Télécharger une nouvelle copie du fichier\n' +
                   '• Convertir le PDF en image (JPG/PNG)\n' +
                   '• Compresser le fichier PDF';
      } else if (errorName === 'SecurityError') {
        errorMsg = 'Erreur de sécurité lors de la lecture du fichier. Cela peut arriver avec certains fichiers PDF protégés.';
      } else if (errorName === 'EncodingError') {
        errorMsg = 'Erreur d\'encodage du fichier. Le fichier peut être mal formaté.';
      }
      reject(new Error(errorMsg));
    };

    // Add abort handler
    reader.onabort = () => {
      clearTimeout(timeoutId);
      reject(new Error('La lecture du fichier a été annulée.'));
    };

    reader.onload = () => {
      clearTimeout(timeoutId);
      try {
        const base64Part = reader.result.split(',')[1];
        if (!base64Part) {
          throw new Error('Impossible d\'extraire les données base64 du fichier.');
        }
        resolve(base64Part);
      } catch (e) {
        reject(new Error(`Erreur lors du traitement du fichier: ${e.message}`));
      }
    };

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
 * Extrait et parse du JSON depuis un texte brut (gère le markdown ou les commentaires additionnels)
 * @param {string} text - Texte brut de l'API Claude
 * @returns {Object} Objet parsé
 */
const parseCleanJson = (text) => {
  if (!text) {
    throw new Error('Aucun texte fourni pour le parsing JSON.');
  }

  const trimmed = text.trim();
  
  // Essai de parsing direct
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    // Si échec, extraction de la portion entre le premier { ou [ et le dernier } ou ]
    const firstBrace = trimmed.indexOf('{');
    const firstBracket = trimmed.indexOf('[');
    
    let startIndex = -1;
    let isObject = true;
    
    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      startIndex = firstBrace;
      isObject = true;
    } else if (firstBracket !== -1) {
      startIndex = firstBracket;
      isObject = false;
    }
    
    if (startIndex !== -1) {
      const closingChar = isObject ? '}' : ']';
      const endIndex = trimmed.lastIndexOf(closingChar);
      
      if (endIndex !== -1 && endIndex > startIndex) {
        const candidate = trimmed.slice(startIndex, endIndex + 1);
        try {
          return JSON.parse(candidate);
        } catch {
          console.error('[API] Failed parsing JSON candidate:', candidate);
        }
      }
    }
    
    // Si tout échoue, on affiche le texte reçu pour faciliter le debug
    console.error('[API] Raw text received from Claude that failed parsing:', text);
    throw new Error(`Erreur d'analyse des données JSON : ${e.message}`);
  }
};

/**
 * Analyse un bulletin ou screenshot SAL via l'API
 * @param {File} file - Fichier image/PDF à analyser
 * @param {string} scanType - Type de scan ('SAL', 'BULLETIN' ou 'EFZ_SAL')
 * @returns {Promise<Object>} Résultat de l'analyse
 */
export const analyzeBulletin = async (file, scanType = 'BULLETIN') => {
  try {
    // Validate file type first
    const mimeType = file.type || 'image/jpeg';
    if (!mimeType.startsWith('image/') && mimeType !== 'application/pdf') {
      throw new Error(`Format de fichier non supporté: ${mimeType}. Acceptés: images (JPG, PNG, WebP) ou PDF.`);
    }

    // Validate file size before attempting conversion
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB - safe limit for FileReader
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum: ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)} MB. Merci de compresser le fichier ou de fournir une version plus petite.`);
    }

    const base64Data = await fileToBase64(file);
    
    // Get authentication token
    const { data } = await supabase.auth.getSession();
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

    // Update rate limit state from headers
    updateRateLimitState(response.headers);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      const errorMsg = errorData.error || `HTTP ${response.status}`;
      
      // Handle 429 rate limit error
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        const error = new Error(errorMsg);
        error.code = 'RATE_LIMIT_EXCEEDED';
        error.retryAfter = retryAfter ? parseInt(retryAfter, 10) : null;
        error.rateLimitState = rateLimitState;
        console.error(`❌ Rate limit exceeded (${response.status}):`, errorMsg);
        throw error;
      }
      
      console.error(`❌ API error (${response.status}):`, errorMsg);
      throw new Error(errorMsg);
    }

    const data_response = await response.json();
    
    if (!data_response.content || !data_response.content[0] || !data_response.content[0].text) {
      throw new Error('Invalid API response: ' + JSON.stringify(data_response));
    }
    
    const textContent = data_response.content[0].text;
    const result = parseCleanJson(textContent);

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
