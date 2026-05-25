import React, { useRef, useEffect } from 'react';
import { Upload, Camera } from 'lucide-react';
import { formatSwissDate } from '../utils';

/**
 * Komponente zum Aazeige vom Resultat vo ere Zeugniss- oder SAL-Analyse.
 */
export default function BulletinAnalysis({
  isAnalyzing,
  analysisResult,
  onFileUpload,
  activeTab
}) {
  const containerRef = useRef(null);

  // Gestionnaire pour coller une image
  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let item of items) {
        let file = null;

        // Vérifier si c'est une image
        if (item.type.startsWith('image/')) {
          file = item.getAsFile();
        }
        // Vérifier si c'est un PDF
        else if (item.type === 'application/pdf') {
          file = item.getAsFile();
        }

        if (file) {
          e.preventDefault();
          // Créer un événement synthétique pour réutiliser handleFileUpload
          const event = {
            target: {
              files: [file]
            }
          };
          onFileUpload(event, activeTab);
          break;
        }
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('paste', handlePaste);
      return () => container.removeEventListener('paste', handlePaste);
    }
  }, [activeTab, onFileUpload]);

  return (
    <div 
      ref={containerRef}
      className={`rounded-lg shadow-sm p-6 mb-6 border-2 ${activeTab === 'current' ? 'bg-blue-50 border-blue-200' : 'bg-purple-50 border-purple-200'}`}
      tabIndex={0}
    > 
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {activeTab === 'current' ? (
            <>
              <Camera className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-800">
                Scan SAL
              </h3>
            </>
          ) : (
            <>
              <Camera className="w-5 h-5 text-purple-600" />
                <h3 className="text-lg font-semibold text-gray-800">
                Zeugniss scanne
              </h3>
            </>
          )}
        </div>
      </div>

      <div className="mb-4">
        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
          <div className="flex flex-col items-center justify-center pt-5 pb-6 px-4">
              {activeTab === 'current' ? (
                <>
                  <Camera className="w-10 h-10 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600 text-center">
                    Nur Bilddateien (JPG, PNG)<br />
                    <span className="text-xs text-gray-500">oder Cmd+V / Ctrl+V zum Einfügen</span>
                  </p>
                </>
              ) : (
                <>
                  <Camera className="w-10 h-10 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600 text-center">
                    Bilddatei (JPG, PNG) oder PDF<br />
                    <span className="text-xs text-gray-500">oder Cmd+V / Ctrl+V zum Einfügen</span>
                  </p>
                </>
              )}
          </div>
            <input
              type="file"
              className="hidden"
              accept={activeTab === 'current' ? 'image/*' : 'image/*,application/pdf'}
              onChange={(e) => onFileUpload(e, activeTab)}
              disabled={isAnalyzing}
            />
        </label>
      </div>

      {isAnalyzing && (
        <div className="flex items-center justify-center p-4 bg-blue-50 rounded-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
          <span className="text-blue-600">Analyse läuft ...</span>
        </div>
      )}

      {analysisResult && (
        <div className="mt-4">
          {analysisResult.error ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
              <strong>Fehler:</strong> {analysisResult.error}
            </div>
          ) : analysisResult.controls ? (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="font-semibold text-green-800 mb-2">
                ✅ {analysisResult.message}
              </div>
              {analysisResult.controls.length > 0 && (
                <div className="space-y-2 text-sm text-green-700">
                  {analysisResult.controls.map((control, idx) => (
                    <div key={idx} className="bg-white rounded p-2">
                      {/* Mobile: 2 lignes */}
                      <div className="md:hidden">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-green-800 text-xs">{control.subject}</span>
                          <span className="font-bold text-green-700 text-lg">{control.grade}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-700 truncate flex-1 mr-2">{control.name}</span>
                          <span className="text-gray-500 whitespace-nowrap">{formatSwissDate(control.date)}</span>
                        </div>
                      </div>
                      {/* Desktop: 1 ligne */}
                      <div className="hidden md:flex items-center justify-between">
                        <span className="font-medium text-green-800 w-48 flex-shrink-0">{control.subject}</span>
                        <span className="text-gray-700 flex-1 px-4 text-left">{control.name}</span>
                        <span className="font-bold text-green-700 w-16 text-right flex-shrink-0">{control.grade}</span>
                        <span className="text-gray-500 text-xs w-24 text-right flex-shrink-0">{formatSwissDate(control.date)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : analysisResult.grades ? (
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="font-semibold text-purple-800 mb-2">
                ✅ Zeugniss S{analysisResult.semester} analysiert
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(analysisResult.grades).map(([subject, grade]) => (
                  <div key={subject} className="flex justify-between bg-white rounded p-2">
                    <span className="text-gray-700">{subject}</span>
                    <span className="font-bold text-purple-700">{grade.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
