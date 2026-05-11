import { useState } from 'react';
import { useAuth } from '../hooks';
import { Mail, Lock, Save, AlertCircle, CheckCircle, UserCircle, Eye, EyeOff } from 'lucide-react';

export default function AccountSettings({ user: propUser }) {
  const { user: authUser, updateEmail, updatePassword, updateDisplayName } = useAuth();
  const user = propUser || authUser;

  const [newDisplayName, setNewDisplayName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [displayNamePending, setDisplayNamePending] = useState(false);
  const [emailPending, setEmailPending] = useState(false);
  const [passwordPending, setPasswordPending] = useState(false);
  const [displayNameSuccess, setDisplayNameSuccess] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [displayNameError, setDisplayNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  if (!user) return null;

  const handleUpdateDisplayName = async (e) => {
    e.preventDefault();
    if (!newDisplayName) return;
    
    setDisplayNamePending(true);
    setDisplayNameError('');
    setDisplayNameSuccess(false);
    try {
      await updateDisplayName(newDisplayName);
      setDisplayNameSuccess(true);
      setNewDisplayName('');
      setTimeout(() => setDisplayNameSuccess(false), 5000);
    } catch (err) {
      setDisplayNameError(err.message || 'Fehler bei der Aktualisierung');
    } finally {
      setDisplayNamePending(false);
    }
  };

  const handleUpdateEmail = async (e) => {
    e.preventDefault();
    if (!newEmail || newEmail === user.email) return;
    
    // Prevent multiple rapid submissions
    if (emailPending) return;
    
    setEmailPending(true);
    setEmailError('');
    setEmailSuccess(false);
    try {
      await updateEmail(newEmail);
      setEmailSuccess(true);
      setNewEmail('');
      setTimeout(() => setEmailSuccess(false), 8000);
    } catch (err) {
      console.error('Email update error:', err);
      let errorMessage = err.message || 'Fehler bei der Aktualisierung';
      
      // Better error messages for common issues
      if (errorMessage.includes('already registered') || errorMessage.includes('already exists')) {
        errorMessage = 'Diese E-Mail wird bereits für ein anderes Konto verwendet';
      } else if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
        errorMessage = 'Zu viele Versuche. Bitte warte ein paar Minuten.';
      } else if (err.status === 500 || errorMessage.includes('500')) {
        errorMessage = 'Serverfehler. Bitte überprüfe, ob die E-Mail gültig ist, und versuche es später erneut.';
      }
      
      setEmailError(errorMessage);
    } finally {
      setEmailPending(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword) {
      setPasswordError('Bitte gib dein aktuelles Passwort ein');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setPasswordError('Das Passwort muss mindestens 6 Zeichen lang sein');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Die Passwörter stimmen nicht überein');
      return;
    }

    setPasswordPending(true);
    setPasswordError('');
    setPasswordSuccess(false);
    try {
      await updatePassword(currentPassword, newPassword);
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 5000);
    } catch (err) {
      setPasswordError(err.message || 'Fehler bei der Aktualisierung');
    } finally {
      setPasswordPending(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-6 space-y-6">

      {/* Anzeigename ändern */}
      <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <UserCircle className="h-5 w-5 text-indigo-600" />
          </div>
          <div className="text-left">
            <h3 className="text-lg font-semibold text-gray-900">Anzeigename ändern</h3>
            <p className="text-sm text-gray-500">Aktueller Name: {user.user_metadata?.display_name || 'Nicht definiert'}</p>
          </div>
        </div>

        <form onSubmit={handleUpdateDisplayName} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Neuer Anzeigename
            </label>
            <input
              type="text"
              placeholder="Dein Name"
              value={newDisplayName}
              onChange={e => setNewDisplayName(e.target.value)}
              className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {displayNameError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-700">{displayNameError}</p>
            </div>
          )}

          {displayNameSuccess && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
              <p className="text-sm text-green-700">Anzeigename aktualisiert!</p>
            </div>
          )}

          <button
            type="submit"
            disabled={displayNamePending || !newDisplayName}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {displayNamePending ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Name aktualisieren
              </>
            )}
          </button>
        </form>
      </div>

      {/* E-Mail-Adresse ändern */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Mail className="h-5 w-5 text-indigo-600" />
          </div>
          <div className="text-left">
            <h3 className="text-lg font-semibold text-gray-900">E-Mail-Adresse ändern</h3>
            <p className="text-sm text-gray-500">Aktuelle E-Mail: {user.email}</p>
          </div>
        </div>

        <form onSubmit={handleUpdateEmail} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Neue E-Mail-Adresse
            </label>
            <input
              type="email"
              placeholder="neu@beispiel.ch"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {emailError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-700">{emailError}</p>
            </div>
          )}

          {emailSuccess && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
              <div className="text-sm text-green-700">
                <p className="font-semibold">Bestätigungs-E-Mail gesendet!</p>
                <p className="text-xs mt-1">Bitte überprüfe dein Postfach, um die Adresse zu bestätigen.</p>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={emailPending || !newEmail || newEmail === user.email}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {emailPending ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <>
                <Save className="h-4 w-4" />
                E-Mail aktualisieren
              </>
            )}
          </button>
        </form>
      </div>

      {/* Passwort ändern */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Lock className="h-5 w-5 text-indigo-600" />
          </div>
          <div className="text-left">
            <h3 className="text-lg font-semibold text-gray-900">Passwort ändern</h3>
            <p className="text-sm text-gray-500">Sichere dein Konto mit einem neuen Passwort</p>
          </div>
        </div>

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Aktuelles Passwort
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              required
              className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Neues Passwort
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                minLength={6}
                className="block w-full px-4 pr-10 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(s => !s)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500"
                aria-label={showNewPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
              >
                {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Passwort bestätigen
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                minLength={6}
                className="block w-full px-4 pr-10 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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

          {passwordError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-700">{passwordError}</p>
            </div>
          )}

          {passwordSuccess && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
              <p className="text-sm text-green-700">Passwort erfolgreich aktualisiert!</p>
            </div>
          )}

          <button
            type="submit"
            disabled={passwordPending || !currentPassword || !newPassword || !confirmPassword}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {passwordPending ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Passwort aktualisieren
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
