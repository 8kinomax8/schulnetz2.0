import { useEffect, useState } from 'react';
import { useAuth } from '../hooks';
import { User, Mail, Lock, LogOut, Settings, UserCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import AccountSettings from './AccountSettings';

export default function AuthPanel() {
  const { user, authLoading, authError, signUp, signIn, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [pending, setPending] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (mode !== 'signup' || authError) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSignupSuccess(false);
    }
  }, [mode, authError]);

  const toggleSettings = () => {
    const newState = !showSettings;
    setShowSettings(newState);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setPending(true);
    setSignupSuccess(false);
    setFormError('');
    if (mode === 'signup') {
      if (password !== confirmPassword) {
        // lightweight client-side validation
        setPending(false);
        return setFormError('Die Passwörter stimmen nicht überein');
      }
      const { data, error } = await signUp(email, password, displayName);
      if (!error && data?.user) {
        setSignupSuccess(true);
      }
    } else {
      await signIn(email, password);
    }
    setPending(false);
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (user) {
    const userDisplayName = user.user_metadata?.display_name || user.email?.split('@')[0];
    return (
      <div className="space-y-4 mb-6">
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-green-600 flex items-center justify-center">
                  <User className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="min-w-0 text-left">
                <p className="text-sm font-semibold text-gray-900 truncate">{userDisplayName}</p>
                <p className="text-xs text-green-700 truncate">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleSettings}
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
              >
                <Settings className="h-4 w-4 mr-1" />
                {showSettings ? 'Schließen' : 'Einstellungen'}
              </button>
              <button
                onClick={signOut}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
              >
                <LogOut className="h-4 w-4 mr-1" />
                Abmelden
              </button>
            </div>
          </div>
        </div>
        {showSettings && <AccountSettings user={user} />}
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white shadow-2xl rounded-2xl overflow-hidden border border-gray-100">
        {/* Header with gradient */}
        <div className="bg-gradient-to-br from-indigo-600 to-purple-600 px-8 py-10 text-center">
          <div className="mx-auto h-16 w-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <User className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">
            {mode === 'signup' ? 'Konto erstellen' : 'Willkommen'}
          </h2>
          <p className="text-indigo-100">
            {mode === 'signup'
              ? 'Mitmachen und deine Noten verfolgen'
              : 'Melde dich an, um fortzufahren'}
          </p>
        </div>

        <div className="px-8 pt-8 pb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {signupSuccess && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-green-900">Konto erfolgreich erstellt!</p>
                    <p className="text-sm text-green-700 mt-1">An <strong>{email}</strong> wurde eine Bestätigungs-E-Mail gesendet. Bitte überprüfe dein Postfach, um das Konto zu aktivieren.</p>
                  </div>
                </div>
              </div>
            )}
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 text-left">
                  Anzeigename
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <UserCircle className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Anzeigename"
                    value={displayName}
                    onChange={e => {
                      setDisplayName(e.target.value);
                      if (signupSuccess) setSignupSuccess(false);
                    }}
                    required
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors text-left"
                  />
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                E-Mail-Adresse
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  placeholder="name@beispiel.ch"
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value);
                    if (signupSuccess) setSignupSuccess(false);
                  }}
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Passwort
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    if (signupSuccess) setSignupSuccess(false);
                    if (formError) setFormError('');
                  }}
                  required
                  minLength={6}
                  className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500"
                  aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

              {mode === 'signup' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Passwort bestätigen
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={e => {
                        setConfirmPassword(e.target.value);
                        if (signupSuccess) setSignupSuccess(false);
                        if (formError) setFormError('');
                      }}
                      required
                      minLength={6}
                      className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                    />

                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(s => !s)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500"
                      aria-label={showConfirmPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              )}

              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-700">{formError}</p>
                </div>
              )}

            {authError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-700">{authError}</p>
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
                mode === 'signup' ? "🚀 Konto erstellen" : '🚀 Anmelden'
              )}
            </button>
          </form>
        </div>

        <div className="px-8 py-5 bg-gray-50 border-t border-gray-200">
          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'signup' ? 'login' : 'signup');
                setSignupSuccess(false);
              }}
              className="text-sm text-indigo-600 hover:text-indigo-800 font-semibold transition-colors inline-flex items-center gap-1"
            >
              {mode === 'signup'
                ? '← Bereits ein Konto? Anmelden'
                : "Noch kein Konto? Konto erstellen!"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
