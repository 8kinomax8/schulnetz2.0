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
 * Compresse une image en redimensionnant et en réduisant la qualité
 * Gère aussi les Live Photos iOS (HEIC/HEIF) en les convertissant en JPEG
 * @param {File} file - Fichier image à compresser
 * @returns {Promise<string>} Base64 data compressée
 */
const compressImage = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const MAX_DIMENSION = 8000;
    const QUALITY = 0.75; // 75% quality for JPG compression
    
    // Log file info for debugging
    const isHeic = file.type === 'image/heic' || file.type === 'image/heif' || 
                   file.name.toLowerCase().endsWith('.heic') || 
                   file.name.toLowerCase().endsWith('.heif');
    if (isHeic) {
      console.log(`📱 Détecté: Live Photo iOS (HEIC/HEIF) - Conversion en JPEG automatique`);
    }

    reader.onload = (e) => {
      try {
        const img = new Image();
        
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            // Scale down if image is larger than MAX_DIMENSION
            if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
              const scale = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
              width = Math.floor(width * scale);
              height = Math.floor(height * scale);
              console.log(`📸 Redimensionnement: ${img.width}x${img.height} → ${width}x${height}`);
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d', { alpha: false });
            
            if (!ctx) {
              throw new Error('Impossible d\'accéder au contexte canvas pour la compression.');
            }

            // Draw image with white background to handle transparency
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);

            // Convert to base64 with compression
            const dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
            const base64Part = dataUrl.split(',')[1];
            
            if (!base64Part) {
              throw new Error('Impossible d\'extraire les données base64 de l\'image compressée.');
            }

            const originalSize = file.size;
            const compressedSize = Math.round(base64Part.length * 0.75);
            const reduction = Math.round((1 - compressedSize / originalSize) * 100);
            console.log(`✅ Image compressée: ${(originalSize / 1024).toFixed(1)} KB → ${(compressedSize / 1024).toFixed(1)} KB (-${reduction}%)`);
            resolve(base64Part);
          } catch (canvasError) {
            reject(new Error(`Erreur lors de la conversion canvas: ${canvasError.message}`));
          }
        };

        img.onerror = () => {
          // Try alternative approach for Live Photos
          if (isHeic) {
            console.warn('⚠️ Impossível carregar Live Photo como imagem, tentando abordagem alternativa...');
            // For HEIC files that fail to load, still try to use the original data
            // This is a fallback that may work in some cases
            const blob = new Blob([e.target.result], { type: 'image/jpeg' });
            const alternativeUrl = URL.createObjectURL(blob);
            const retryImg = new Image();
            
            retryImg.onload = () => {
              // Try again with the converted URL
              const canvas = document.createElement('canvas');
              canvas.width = retryImg.width;
              canvas.height = retryImg.height;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(retryImg, 0, 0);
              const dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
              const base64Part = dataUrl.split(',')[1];
              URL.revokeObjectURL(alternativeUrl);
              resolve(base64Part);
            };
            
            retryImg.onerror = () => {
              URL.revokeObjectURL(alternativeUrl);
              reject(new Error('Live Photo iOS: Impossible de convertir automatiquement. Essayez de sauvegarder la photo en JPEG sur votre iPhone (Photos > Éditer > Format > Compatibilité).'));
            };
            
            retryImg.src = alternativeUrl;
          } else {
            reject(new Error('Impossible de charger l\'image pour la compression. L\'image peut être corrompue ou dans un format non supporté.'));
          }
        };

        // Set a timeout for image loading
        const loadTimeout = setTimeout(() => {
          img.onerror?.();
        }, 5000);

        img.onload = function() {
          clearTimeout(loadTimeout);
          img.onload.call(this);
        };

        img.src = e.target.result;
      } catch (e) {
        reject(new Error(`Erreur lors de la compression de l'image: ${e.message}`));
      }
    };

    reader.onerror = () => {
      if (isHeic) {
        console.error('❌ FileReader a échoué sur Live Photo HEIC. Type MIME:', file.type);
        reject(new Error('Live Photo iOS: Le fichier HEIC ne peut pas être lu directement. Essayez de:\n' +
                        '✓ Sauvegarder la photo en JPEG sur votre iPhone\n' +
                        '✓ Utiliser une capture d\'écran ou une photo régulière'));
      } else {
        reject(new Error('Impossible de lire le fichier image.'));
      }
    };

    // Add a general timeout for FileReader
    const readerTimeout = setTimeout(() => {
      reader.abort();
      if (isHeic) {
        reject(new Error('Délai d\'attente dépassé pour la lecture du Live Photo. Convertissez la photo en JPEG sur votre iPhone.'));
      } else {
        reject(new Error('Délai d\'attente dépassé lors de la lecture du fichier image.'));
      }
    }, 10000);

    reader.onabort = () => {
      clearTimeout(readerTimeout);
      reject(new Error('La lecture du fichier image a été annulée.'));
    };

    reader.readAsDataURL(file);
  });
};

/**
 * Convertit un fichier en base64 avec optimisations pour images
 * @param {File} file - Fichier à convertir
 * @returns {Promise<string>} Base64 data
 */
const fileToBase64 = (file) => {
  return new Promise(async (resolve, reject) => {
    // Check file size upfront
    const MAX_FILEREADER_SIZE = 3 * 1024 * 1024; // 3MB limit
    if (file.size > MAX_FILEREADER_SIZE) {
      reject(new Error(`Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum: ${(MAX_FILEREADER_SIZE / 1024 / 1024).toFixed(0)} MB. Merci de compresser le fichier ou de fournir une version plus petite.`));
      return;
    }

    // For images, use canvas compression to reduce size
    if (file.type && file.type.startsWith('image/')) {
      try {
        console.log(`🖼️ Compressing image: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
        const compressed = await compressImage(file);
        resolve(compressed);
        return;
      } catch (e) {
        console.warn('Image compression failed, falling back to direct conversion:', e.message);
        // Fall through to direct conversion if compression fails
      }
    }

    // Direct FileReader conversion (for PDFs, or if compression failed)
    const reader = new FileReader();
    
    // Add timeout protection (20 seconds for PDFs)
    const timeoutId = setTimeout(() => {
      reader.abort();
      reject(new Error('Délai d\'attente dépassé lors de la lecture du fichier. Le fichier peut être trop volumineux, corrompu ou non supporté par votre navigateur.'));
    }, 20000);

    // Add error handler
    reader.onerror = () => {
      clearTimeout(timeoutId);
      let errorMsg = 'Erreur lors de la lecture du fichier.';
      const errorName = reader.error?.name;
      
      console.error(`FileReader error: ${errorName}`, reader.error);
      
      if (errorName === 'NotReadableError') {
        // Check if it's likely a Live Photo
        const isLikelyLivePhoto = file.type === 'image/heic' || 
                                  file.type === 'image/heif' || 
                                  file.name?.toLowerCase().endsWith('.heic') || 
                                  file.name?.toLowerCase().endsWith('.heif');
        
        if (isLikelyLivePhoto) {
          errorMsg = '📱 Live Photo iOS détecté\n\nLa conversion automatique a échoué.\n\n' +
                     'Solutions:\n' +
                     '✓ Sur iPhone: Photos > Éditer > Formats > Compatibilité\n' +
                     '✓ Puis sélectionnez à nouveau la photo sauvegardée en JPEG\n' +
                     '✓ Ou: Prenez une capture d\'écran du bulletin au lieu d\'une photo';
        } else {
          errorMsg = 'Le fichier ne peut pas être lu par votre navigateur.\n\n' +
                     'Solutions:\n' +
                     '✓ Essayez un autre navigateur (Chrome, Safari, Firefox)\n' +
                     '✓ Vérifiez que le fichier n\'est pas protégé\n' +
                     '✓ Convertissez le PDF en image JPG/PNG\n' +
                     '✓ Redémarrez votre appareil et réessayez';
        }
      } else if (errorName === 'SecurityError') {
        errorMsg = 'Erreur de sécurité. Le fichier peut être protégé ou provenir d\'une source non sûre. ' +
                   'Essayez de convertir le fichier ou utilisez un autre navigateur.';
      } else if (errorName === 'EncodingError') {
        errorMsg = 'Erreur d\'encodage du fichier. Le fichier peut être mal formaté. Réessayez ou convertissez en image.';
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

    // Validate file size before attempting conversion (3MB limit)
    const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB - safe limit
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum: ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)} MB. Pour les images, elles seront automatiquement compressées et redimensionnées.`);
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

  // Track which codes are üK (start with "ueK_" or are exactly "ueK")
  const isUekCode = (code) => {
    const normalized = String(code).toLowerCase();
    return normalized === 'uek' || normalized.startsWith('uek_');
  };

  const updatedSemesterGrades = { ...currentSemesterGrades };
  const semestersList = []; // List of {semester, mappedGrades}
  const previousUekGrades = []; // Extract üK from bulletin with ID and grades per semester

  // Support both old format (single semester) and new format (multiple semesters)
  const semesters = result.semesters || (result.grades ? [{ semester: result.semester ?? currentSemester, grades: result.grades }] : []);

  // First pass: collect all üK codes from all semesters
  const uekCodesFromBulletin = new Set();
  semesters.forEach(semesterData => {
    const grades = semesterData.grades || {};
    Object.keys(grades).forEach(k => {
      if (isUekCode(k)) {
        uekCodesFromBulletin.add(k);
      }
    });
  });

  // Second pass: process grades
  semesters.forEach(semesterData => {
    const semester = semesterData.semester ?? currentSemester;
    const grades = semesterData.grades || {};
    const mappedGrades = {};
    const uekGradesForSemester = {};

    Object.entries(grades).forEach(([k, v]) => {
      const normalizedGrade = normalizeNumber(v);
      if (normalizedGrade === null) return;

      // Check if this is a üK entry
      if (isUekCode(k)) {
        uekGradesForSemester[k] = normalizedGrade;
      } else {
        // Regular module - try to map or use as-is if it's a generated code (M###)
        const isGeneratedModuleCode = /^M\d{3}$/i.test(k);
        const canon = isGeneratedModuleCode ? k : normalizeSubjectName(k, validSubjects);
        
        if (!canon) return; // Skip if not a generated code and can't be normalized
        mappedGrades[canon] = normalizedGrade;
      }
    });

    // Update semester grades for regular modules
    Object.entries(mappedGrades).forEach(([subject, grade]) => {
      if (!updatedSemesterGrades[subject]) {
        updatedSemesterGrades[subject] = {};
      }
      updatedSemesterGrades[subject][semester] = grade;
    });

    // Add to list if grades found
    if (Object.keys(mappedGrades).length > 0 || Object.keys(uekGradesForSemester).length > 0) {
      semestersList.push({ semester, mappedGrades, uekGradesForSemester });
    }
  });

  // Build previousUekGrades from collected üK data
  uekCodesFromBulletin.forEach(uekCode => {
    const gradesPerSemester = {};
    semesters.forEach(semesterData => {
      const semester = semesterData.semester ?? currentSemester;
      const grades = semesterData.grades || {};
      if (grades[uekCode] !== undefined && grades[uekCode] !== null) {
        const normalizedGrade = normalizeNumber(grades[uekCode]);
        if (normalizedGrade !== null) {
          gradesPerSemester[semester] = normalizedGrade;
        }
      }
    });

    if (Object.keys(gradesPerSemester).length > 0) {
      // Extract a better display name from the code
      let displayName = uekCode;
      if (uekCode.toLowerCase().startsWith('uek_')) {
        // Extract the descriptive part (e.g., "ueK_Linux" → "Linux")
        displayName = uekCode.substring(4);
      } else if (uekCode.toLowerCase() === 'uek') {
        displayName = 'Übungskurs';
      }
      
      previousUekGrades.push({
        id: Date.now() + Math.random(), // Unique ID for this entry
        code: uekCode,
        name: displayName,
        grades: gradesPerSemester // { semester: grade, ... }
      });
    }
  });

  return { updatedSemesterGrades, semestersList, previousUekGrades };
};
