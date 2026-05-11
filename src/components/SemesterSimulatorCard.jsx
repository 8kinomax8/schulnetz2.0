import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { roundToHalfOrWhole } from '../services/calculationService';

/**
 * Component to simulate a semester average with planned assessments.
 */
export default function SemesterSimulatorCard({
  subject,
  currentGrades,
  plannedControls,
  onAddPlan,
  onRemovePlan,
  currentAverage,
  simulatedAverage,
  goalGrade,
  onGoalChange,
  computeRequired
}) {
  const [grade, setGrade] = useState('');
  const [weight, setWeight] = useState('1');
  const [assumedWeight, setAssumedWeight] = useState('1');

  const parseWeight = (w) => {
    if (typeof w !== 'string') return parseFloat(w);
    if (w.includes('/')) {
      const [num, den] = w.split('/').map(n => parseFloat(n.trim()));
      return num / den;
    }
    if (w.includes('%')) {
      return parseFloat(w.replace('%', '').trim()) / 100;
    }
    return parseFloat(w);
  };

  const handleAdd = () => {
    if (!grade || !weight) return;
    const pw = parseWeight(weight);
    if (!isNaN(pw)) {
      onAddPlan(parseFloat(grade), pw);
      setGrade('');
      setWeight('1');
    }
  };

  // eslint-disable-next-line no-unused-vars
  const totalCurrentWeight = currentGrades.reduce((sum, g) => sum + g.weight, 0);
  const totalPlannedWeight = (plannedControls || []).reduce((sum, p) => sum + parseFloat(p.weight), 0);
  const requiredWithPlans = computeRequired(parseWeight(assumedWeight));

  return (
    <div className="border-2 border-blue-200 rounded-lg p-4 bg-gradient-to-r from-blue-50 to-cyan-50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800 text-sm">{subject}</h3>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600">Ziel:</span>
            <input
              type="number"
              step="0.5"
              min="1"
              max="6"
              value={goalGrade}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                if (!isNaN(value)) {
                  // Clamp between 1 and 6, then round to nearest 0.5
                  const clamped = Math.min(6, Math.max(1, value));
                  const rounded = roundToHalfOrWhole(clamped);
                  onGoalChange(rounded);
                }
              }}
              className="w-16 p-1 border border-indigo-300 rounded text-sm font-bold text-center"
            />
          </div>
          <div className="text-xs text-gray-500 italic">
            (Berechnet für {(goalGrade - 0.25).toFixed(2)})
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
        <div>
          <div className="text-gray-600">Aktueller Schnitt</div>
          <div className="font-bold text-lg text-blue-900">
            {currentAverage?.toFixed(1) || '-'}
          </div>
          <div className="text-gray-500 text-xs">
            ({currentGrades.length} Noten)
          </div>
        </div>
        <div>
          <div className="text-gray-600">Benötigte Note</div>
          <div className={`font-bold text-lg ${
            requiredWithPlans && (requiredWithPlans < 1 || requiredWithPlans > 6)
              ? 'text-orange-600'
              : requiredWithPlans && requiredWithPlans <= 4
                ? 'text-green-600'
                : 'text-blue-900'
          }`}>
            {requiredWithPlans?.toFixed(1) || '-'}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-gray-500 text-xs">Gewicht:</span>
            <input
              type="text"
              value={assumedWeight}
              onChange={(e) => setAssumedWeight(e.target.value)}
              className="w-20 p-1 border border-gray-300 rounded text-xs"
            />
          </div>
        </div>
      </div>

      {requiredWithPlans && (requiredWithPlans < 1 || requiredWithPlans > 6) && (
        <div className="mb-3 p-2 bg-orange-100 rounded text-xs text-orange-800">
          ⚠️ Ziel {requiredWithPlans < 1 ? 'bereits erreicht' : 'nicht erreichbar'}
        </div>
      )}

      <div className="border-t border-blue-200 pt-3 mt-3">
        <label className="block text-xs text-gray-700 mb-2 font-semibold">
          Geplante Prüfung hinzufügen
        </label>
        <div className="flex gap-2 mb-2">
          <input
            type="number"
            step="0.5"
            min="1"
            max="6"
            placeholder="Note"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            className="flex-1 p-2 border border-gray-300 rounded text-sm"
          />
          <input
            type="text"
            placeholder="Gewicht"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="w-24 p-2 border border-gray-300 rounded text-sm"
          />
          <button
            onClick={handleAdd}
            className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {plannedControls?.length > 0 && (
          <div className="mb-3">
            <div className="text-xs text-gray-600 mb-1">
              Geplante Nachweise (Σ Gewicht: {totalPlannedWeight.toFixed(1)})
            </div>
            <ul className="space-y-1">
              {plannedControls.map(p => (
                <li
                  key={p.id}
                  className="flex items-center justify-between text-xs bg-white rounded p-2 border"
                >
                  <span>Note {p.grade.toFixed(1)} × {p.weight}</span>
                  <button
                    onClick={() => onRemovePlan(p.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {simulatedAverage && (
          <div className={`text-center p-3 rounded-lg font-bold ${
            roundToHalfOrWhole(simulatedAverage) >= goalGrade
              ? 'bg-green-100 text-green-800'
              : 'bg-orange-100 text-orange-800'
          }`}>
            Simulierter Durchschnitt: {simulatedAverage.toFixed(2)} → {roundToHalfOrWhole(simulatedAverage).toFixed(1)}
          </div>
        )}
      </div>
    </div>
  );
}
