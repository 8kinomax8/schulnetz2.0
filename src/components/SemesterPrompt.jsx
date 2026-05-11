import { useState } from 'react';
import { Book } from 'lucide-react';

export default function SemesterPrompt({ onSelectSemester }) {
  const [semester, setSemester] = useState(1);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSelectSemester(semester);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-indigo-600 to-purple-600 px-8 py-8 text-center">
          <div className="mx-auto h-16 w-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <Book className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Willkommen! 👋
          </h2>
          <p className="text-indigo-100 text-sm">
            Wir legen gerade dieses aktuelle Semester fest
          </p>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="px-8 py-6">
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              In wellem Semester bisch du aktuell?
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                <button
                  key={sem}
                  type="button"
                  onClick={() => setSemester(sem)}
                  className={`py-3 px-4 rounded-lg font-semibold transition-all ${
                    semester === sem
                      ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-lg scale-105'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  S{sem}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-lg shadow-lg hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-[1.02]"
          >
            Weiter
          </button>
        </form>
      </div>
    </div>
  );
}
