import React from 'react';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

/**
 * Komponente zum Aazeige vom Promotionsstatus (BM1).
 */
export default function PromotionStatus({ promotionStatus, title = "Promotionsstatus" }) {
  if (!promotionStatus || promotionStatus.average === null) {
    return null;
  }

  const { average, deficit, insufficientCount, isPromoted, conditions } = promotionStatus;

  const getStatusIcon = (isOk) => {
    if (isOk) return <CheckCircle className="w-5 h-5 text-green-600" />;
    return <XCircle className="w-5 h-5 text-red-600" />;
  };

  const getStatusColor = (isOk) => {
    return isOk ? 'bg-green-50 border-green-300 text-green-800' : 'bg-red-50 border-red-300 text-red-800';
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <h3 className="text-base sm:text-lg font-semibold text-gray-800">{title}</h3>
        <div className={`px-3 py-1.5 rounded-full font-bold text-sm whitespace-nowrap ${
          isPromoted 
            ? 'bg-green-100 text-green-800' 
            : 'bg-red-100 text-red-800'
        }`}>
          {isPromoted ? '✅ Befördert' : '❌ Nicht befördert'}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Condition 1: Overall average */}
        <div className={`border-2 rounded-lg p-4 ${getStatusColor(conditions.averageOk)}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">Gesamtdurchschnitt</span>
            {getStatusIcon(conditions.averageOk)}
          </div>
          <div className="text-2xl font-bold">{average.toFixed(1)}</div>
          <div className="text-xs mt-1">
            {conditions.averageOk ? '≥ 4.0 ✓' : '< 4.0 ✗'}
          </div>
          <div className="text-xs text-gray-600 mt-1">
            (IDAF ausgenommen, auf Zehntel gerundet)
          </div>
        </div>

        {/* Condition 2: Total deficit */}
        <div className={`border-2 rounded-lg p-4 ${getStatusColor(conditions.deficitOk)}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">Gesamtdefizit</span>
            {getStatusIcon(conditions.deficitOk)}
          </div>
          <div className="text-2xl font-bold">{deficit.toFixed(1)}</div>
          <div className="text-xs mt-1">
            {conditions.deficitOk ? '≤ 2.0 ✓' : '> 2.0 ✗'}
          </div>
          <div className="text-xs text-gray-600 mt-1">
            Σ(4.0 - Note) für Noten &lt; 4
          </div>
        </div>

        {/* Condition 3: Insufficient grades */}
        <div className={`border-2 rounded-lg p-4 ${getStatusColor(conditions.insufficientOk)}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">Ungenügende Noten</span>
            {getStatusIcon(conditions.insufficientOk)}
          </div>
          <div className="text-2xl font-bold">{insufficientCount}</div>
          <div className="text-xs mt-1">
            {conditions.insufficientOk ? '≤ 2 ✓' : '> 2 ✗'}
          </div>
          <div className="text-xs text-gray-600 mt-1">
            Anzahl Noten &lt; 4.0
          </div>
        </div>
      </div>

      {!isPromoted && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-300 rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-800">
            <strong>Warnung:</strong> Die Promotionsbedingungen sind nicht erfüllt.
            {!conditions.averageOk && ' Durchschnitt zu tief.'}
            {!conditions.deficitOk && ' Defizit zu hoch.'}
            {!conditions.insufficientOk && ' Zu viele ungenügende Noten.'}
          </div>
        </div>
      )}
    </div>
  );
}
