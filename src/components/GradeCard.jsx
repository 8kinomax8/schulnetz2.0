import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { formatSwissDate } from '../utils';

/**
 * Component to display and manage grades for a subject.
 */
export default function GradeCard({ 
  subject, 
  title = subject,
  grades = [], 
  onAddGrade, 
  onRemoveGrade, 
  semesterAverage, 
  exactAverage = null,
  fixedWeight = null,
  hideWeightInput = false,
  containerClassName = '',
  titleActions = null,
  gradeStep = '0.5',
  gradeDecimals = 1
}) {
  const [newGrade, setNewGrade] = useState('');
  const [weight, setWeight] = useState('1');
  const [newDate, setNewDate] = useState('');
  const [newName, setNewName] = useState('');

  const handleAdd = () => {
    if (!newGrade || (!hideWeightInput && !weight)) return;
    const rawGrade = parseFloat(newGrade);
    if (!Number.isFinite(rawGrade)) return;
    const clampedGrade = Math.min(6, Math.max(1, rawGrade));
    // Format date to Swiss format if provided
    const formattedDate = newDate ? formatSwissDate(newDate) : null;
    onAddGrade(subject, clampedGrade, fixedWeight ?? weight, formattedDate, newName || null);
    setNewGrade('');
    setWeight('1');
    setNewDate('');
    setNewName('');
  };

  // eslint-disable-next-line no-unused-vars
  const totalWeight = grades.reduce((sum, g) => sum + g.weight, 0);

  const formatGrade = (grade) => {
    if (!Number.isFinite(grade)) return '-';
    return grade
      .toFixed(gradeDecimals)
      .replace(/(\.\d*?)0+$/, '$1')
      .replace(/\.$/, '');
  };

  return (
    <div className={`border-2 border-blue-200 rounded-lg p-3 sm:p-4 bg-gradient-to-r from-blue-50 to-indigo-50 overflow-hidden max-w-full ${containerClassName}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0 mr-2">
          <h3 className="font-semibold text-gray-800 text-sm truncate">{title}</h3>
          {titleActions && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {titleActions}
            </div>
          )}
        </div>
        {Number.isFinite(semesterAverage) && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-gray-600">Ø:</span>
            <span className={`font-bold text-lg ${
              semesterAverage >= 5.5 ? 'text-green-700' :
              semesterAverage >= 4.0 ? 'text-blue-700' :
              'text-red-700'
            }`}>
              {semesterAverage.toFixed(1)}
              {Number.isFinite(exactAverage) && (
                <span className="ml-1 text-xs font-semibold text-gray-500">
                  ({exactAverage.toFixed(2)})
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      {grades.length > 0 && (
        <div className="mb-3 space-y-1">

          <div className="overflow-x-auto -mx-1 px-1">
            {grades.map((g) => (
              <div
                key={g.id}
                className="flex items-center text-xs bg-white rounded p-1.5 sm:p-2 border mb-1 min-w-0"
              >
                <span className="font-semibold flex-shrink-0">{formatGrade(g.grade)}</span>
                <span className="text-gray-400 hidden sm:inline mx-0.5">×</span>
                <span className="text-gray-400 hidden sm:inline flex-shrink-0">{g.displayWeight || g.weight}</span>
                <span className="text-gray-400 hidden sm:inline ml-2 flex-shrink-0 text-xs">{g.date ? `(${g.date})` : ''}</span>
                <span className="text-gray-700 flex-1 truncate italic text-xs ml-2 min-w-0">{g.name || ''}</span>
                <button
                  onClick={() => onRemoveGrade(subject, g.id)}
                  className="text-red-600 hover:text-red-800 flex-shrink-0 p-0.5 ml-1"
                >
                  <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}



      <div className="border-t border-blue-200 pt-3">
        <label className="block text-xs text-gray-700 mb-2 font-semibold">
          Note hinzufügen
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            type="number"
            step={gradeStep}
            min="1"
            max="6"
            placeholder="Note"
            value={newGrade}
            onChange={(e) => setNewGrade(e.target.value)}
            onFocus={(e) => e.target.select()}
            className="w-20 p-2 border border-gray-300 rounded text-sm"
          />
          <input
            type="text"
            placeholder="Gewicht"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            onFocus={(e) => e.target.select()}
            className={`${hideWeightInput ? 'hidden' : 'w-10'} p-2 border border-gray-300 rounded text-sm text-center`}
          />
          <input
            type="text"
            placeholder="DD.MM.YYYY"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            onFocus={(e) => e.target.type = 'date'}
            onBlur={(e) => { if (!e.target.value) e.target.type = 'text'; }}
            className="hidden sm:block w-28 p-2 border border-gray-300 rounded text-sm"
          />
          <input
            type="text"
            placeholder="Thema"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 min-w-16 p-2 border border-gray-300 rounded text-sm"
          />
          <button
            onClick={handleAdd}
            className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
