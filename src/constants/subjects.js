/**
 * Matières BM par type et catégorie
 */
export const BM_SUBJECTS = {
  TAL: {
    grundlagen: ['Deutsch', 'Englisch', 'Französisch', 'Mathematik'],
    schwerpunkt: ['Mathematik Schwerpunktbereich', 'Naturwissenschaften'],
    erganzung: ['Geschichte und Politik', 'Wirtschaft und Recht'],
    interdisziplinar: ['Interdisziplinäres Arbeiten in den Fächern']
  },
  DL: {
    grundlagen: ['Deutsch', 'Englisch', 'Französisch', 'Mathematik'],
    schwerpunkt: ['Finanz- und Rechnungswesen', 'Wirtschaft und Recht Schwerpunktbereich'],
    erganzung: ['Geschichte und Politik', 'Wirtschaft und Recht'],
    interdisziplinar: ['Interdisziplinäres Arbeiten in den Fächern']
  }
};

/**
 * Matières d'examen par type BM
 */
export const EXAM_SUBJECTS = {
  TAL: ['Deutsch', 'Englisch', 'Französisch', 'Mathematik', 'Mathematik Schwerpunktbereich', 'Naturwissenschaften'],
  DL: ['Deutsch', 'Englisch', 'Französisch', 'Mathematik', 'Finanz- und Rechnungswesen', 'Wirtschaft und Recht Schwerpunktbereich']
};

/**
 * Abschlussprüfungen selon D654 V4 (Beginn vor 2026).
 * Les notes d'examen composées sont la moyenne des Abschlussprüfungen
 * de la branche, ensuite arrondie au demi-point.
 */
export const EXAM_COMPONENTS = {
  TAL: {
    'Deutsch': [
      { key: 'written', label: 'Schriftlich', duration: '150 Min.' },
      { key: 'oral', label: 'Mündlich', duration: '15-20 Min.' }
    ],
    'Französisch': [
      { key: 'oral', label: 'Mündlich', duration: '15-20 Min.' }
    ],
    'Englisch': [
      { key: 'written', label: 'Schriftlich', duration: '120 Min.' },
      { key: 'oral', label: 'Mündlich', duration: '15-20 Min.' }
    ],
    'Mathematik': [
      { key: 'noAids', label: 'Ohne Hilfsmittel', duration: '75 Min.' },
      { key: 'withAids', label: 'Mit Hilfsmitteln', duration: '75 Min.' }
    ],
    'Mathematik Schwerpunktbereich': [
      { key: 'noAids', label: 'Ohne Hilfsmittel', duration: '90 Min.' },
      { key: 'withAids', label: 'Mit Hilfsmitteln', duration: '90 Min.' }
    ],
    'Naturwissenschaften': [
      { key: 'chemistry', label: 'Chemie', duration: '40 Min.' },
      { key: 'physics', label: 'Physik', duration: '80 Min.' }
    ]
  },
  DL: {
    'Deutsch': [
      { key: 'written', label: 'Schriftlich', duration: '150 Min.' },
      { key: 'oral', label: 'Mündlich', duration: '15-20 Min.' }
    ],
    'Französisch': [
      { key: 'oral', label: 'Mündlich', duration: '15-20 Min.' }
    ],
    'Englisch': [
      { key: 'written', label: 'Schriftlich', duration: '120 Min.' },
      { key: 'oral', label: 'Mündlich', duration: '15-20 Min.' }
    ],
    'Mathematik': [
      { key: 'written', label: 'Schriftlich', duration: '120 Min.' }
    ],
    'Finanz- und Rechnungswesen': [
      { key: 'written', label: 'Schriftlich', duration: '180 Min.' }
    ],
    'Wirtschaft und Recht Schwerpunktbereich': [
      { key: 'written', label: 'Schriftlich', duration: '120 Min.' }
    ]
  }
};

/**
 * Lektionentafel - Semestres où chaque matière est enseignée
 */
export const LEKTIONENTAFEL = {
  TAL: {
    'Deutsch': [1, 2, 5, 6, 7, 8],
    'Englisch': [3, 4, 5, 6, 7, 8],
    'Französisch': [1, 2, 3],
    'Mathematik': [1, 2, 3, 4],
    'Mathematik Schwerpunktbereich': [4, 5, 6, 7, 8],
    'Naturwissenschaften': [3, 4, 5, 6, 7, 8],
    'Geschichte und Politik': [4, 5, 6],
    'Wirtschaft und Recht': [1, 2],
    'Interdisziplinäres Arbeiten in den Fächern': [1, 2, 3, 4, 5, 6, 7, 8]
  },
  DL: {
    'Deutsch': [1, 2, 3, 4, 5, 6, 7, 8],
    'Englisch': [3, 4, 5, 6, 7, 8],
    'Französisch': [1, 2, 3],
    'Mathematik': [1, 2, 3, 4],
    'Finanz- und Rechnungswesen': [3, 4, 5, 6, 7, 8],
    'Wirtschaft und Recht Schwerpunktbereich': [4, 5, 6, 7, 8],
    'Wirtschaft und Recht': [1, 2],
    'Geschichte und Politik': [3, 4, 5],
    'Interdisziplinäres Arbeiten in den Fächern': [1, 2, 3, 4, 5, 6, 7, 8]
  }
};
