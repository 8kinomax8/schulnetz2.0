import { useState } from 'react';
import { Settings, CheckCircle } from 'lucide-react';

export default function OnboardingSetup({ onComplete }) {
  const [currentSemester, setCurrentSemester] = useState(1);
  const [bmType, setBmType] = useState('TAL');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setPending(true);
    setError(null);

    try {
      await onComplete({ currentSemester: parseInt(currentSemester), bmType });
    } catch (err) {
      setError(err.message || 'Fehler beim Speichern der Einstellungen');
      setPending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white shadow-2xl rounded-2xl overflow-hidden border border-gray-100">
          {/* Header */}
          <div className="bg-gradient-to-br from-indigo-600 to-purple-600 px-8 py-10 text-center">
            <div className="mx-auto h-16 w-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-4 shadow-lg">
              <Settings className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">Willkommen! 👋</h2>
            <p className="text-indigo-100">
              Lass uns dein Profil einrichten
            </p>
          </div>

          <div className="px-8 pt-8 pb-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  Aktuelles Semester
                </label>
                <select
                  value={currentSemester}
                  onChange={(e) => setCurrentSemester(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors text-base"
                >
                  {Array.from({ length: 8 }, (_, i) => i + 1).map((semester) => (
                    <option key={semester} value={semester}>
                      Semester {semester}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-2">
                  Wähle das Semester, in dem du dich gerade befindest.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  BM-Typ (Option)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      value: 'TAL',
                      label: 'TAL',
                      description: 'Technik, Architektur & Life Sciences'
                    },
                    {
                      value: 'DL',
                      label: 'DL',
                      description: 'Dienstleistungen & Lehrberufe'
                    }
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setBmType(option.value)}
                      className={`p-4 border-2 rounded-lg transition-all transform hover:scale-105 ${
                        bmType === option.value
                          ? 'border-indigo-600 bg-indigo-50 shadow-md'
                          : 'border-gray-300 bg-white hover:border-gray-400'
                      }`}
                    >
                      <div className="font-bold text-lg text-gray-900">
                        {option.label}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {option.description}
                      </div>
                      {bmType === option.value && (
                        <CheckCircle className="h-5 w-5 text-indigo-600 mt-2" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={pending}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-lg text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02]"
              >
                {pending ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  '✨ Profil erstellen'
                )}
              </button>

              <p className="text-xs text-center text-gray-600">
                Diese Einstellungen kannst du später jederzeit ändern.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
