import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  signupRequest,
  loginRequest,
  googleLoginRequest,
  requestResetRequest,
  resetPasswordRequest,
} from '../api/auth.api';
import { useAuthStore } from '../store/authStore';
import { identifyUser, trackEvent } from '../lib/analytics';

declare global {
  interface Window {
    google: any;
  }
}

// Decodes the JWT payload only (no signature verification) purely to pull
// the userId for analytics identification -- never used for auth decisions.
function getUserIdFromToken(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.userId || null;
  } catch {
    return null;
  }
}

function getPasswordChecks(password: string) {
  return [
    { label: 'Starts with a letter', valid: /^[A-Za-z]/.test(password) },
    { label: 'At least 8 characters', valid: password.length >= 8 },
    { label: 'At least one uppercase letter', valid: /[A-Z]/.test(password) },
    { label: 'At least one lowercase letter', valid: /[a-z]/.test(password) },
    { label: 'At least one number', valid: /[0-9]/.test(password) },
    { label: 'At least one symbol', valid: /[^A-Za-z0-9]/.test(password) },
  ];
}

type Mode = 'login' | 'signup' | 'forgot' | 'reset';

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('login');

  // Login / signup fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot / reset fields
  const [resetEmail, setResetEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetMessage, setResetMessage] = useState('');

  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  const googleDivRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.google || !googleDivRef.current) return;

    window.google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      callback: async (response: { credential: string }) => {
        setError('');
        setLoading(true);
        try {
          const data = await googleLoginRequest(response.credential);
          setAuth(data.accessToken, data.refreshToken, { name: data.name });

          const userId = getUserIdFromToken(data.accessToken);
          if (userId) identifyUser(userId, { name: data.name, auth_method: 'google' });
          trackEvent('google_signin_used');

          navigate('/');
        } catch {
          setError('Google sign-in failed.');
        } finally {
          setLoading(false);
        }
      },
    });

    window.google.accounts.id.renderButton(googleDivRef.current, {
      theme: 'filled_black',
      size: 'large',
      width: 320,
      shape: 'pill',
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data =
        mode === 'signup'
          ? await signupRequest(name, email, password)
          : await loginRequest(email, password);

      const resolvedName = name || email.split('@')[0];
      setAuth(data.accessToken, data.refreshToken, { name: resolvedName });

      const userId = getUserIdFromToken(data.accessToken);
      if (userId) identifyUser(userId, { name: resolvedName, auth_method: 'password' });
      trackEvent(mode === 'signup' ? 'signup_completed' : 'login_completed');

      navigate('/');
    } catch (err: any) {
      const data = err.response?.data;
      if (data?.error === 'VALIDATION_ERROR' && data?.details?.fieldErrors?.password) {
        setError(data.details.fieldErrors.password.join(', '));
      } else {
        setError(data?.error || 'Something went wrong');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestReset(e: React.FormEvent) {
    e.preventDefault();
    setResetError('');
    setResetMessage('');
    setLoading(true);
    try {
      await requestResetRequest(resetEmail);
      setResetMessage('If that email exists, a 6-digit code has been sent.');
      setMode('reset');
    } catch {
      setResetError('Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setResetError('');
    setLoading(true);
    try {
      await resetPasswordRequest(resetEmail, otp, newPassword);
      setResetMessage('Password reset! You can now log in.');
      setTimeout(() => {
        setMode('login');
        setOtp('');
        setNewPassword('');
        setResetMessage('');
      }, 2000);
    } catch (err: any) {
      const errCode = err.response?.data?.error;
      const errMap: Record<string, string> = {
        INVALID_OTP: 'Incorrect code.',
        OTP_EXPIRED: 'Code expired. Request a new one.',
        TOO_MANY_ATTEMPTS: 'Too many attempts. Request a new code.',
      };
      setResetError(errMap[errCode] || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  const showTabsAndGoogle = mode === 'login' || mode === 'signup';

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex justify-center gap-2 mb-6">
          <span className="w-3 h-3 rounded-full bg-red-500" />
          <span className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="w-3 h-3 rounded-full bg-blue-500" />
        </div>
        <h1 className="text-2xl font-bold text-center mb-1">ColorWin</h1>
        <p className="text-slate-400 text-sm text-center mb-6">Play-money color prediction demo</p>

        {showTabsAndGoogle && (
          <>
            <div className="flex bg-slate-800 rounded-xl p-1 mb-5">
              <button
                className={`flex-1 py-2 rounded-lg text-sm font-semibold ${mode === 'login' ? 'bg-slate-700' : 'text-slate-400'}`}
                onClick={() => setMode('login')}
                type="button"
              >
                Log in
              </button>
              <button
                className={`flex-1 py-2 rounded-lg text-sm font-semibold ${mode === 'signup' ? 'bg-slate-700' : 'text-slate-400'}`}
                onClick={() => setMode('signup')}
                type="button"
              >
                Sign up
              </button>
            </div>

            <div ref={googleDivRef} className="flex justify-center mb-4" />

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-slate-800" />
              <span className="text-slate-500 text-xs">or</span>
              <div className="flex-1 h-px bg-slate-800" />
            </div>
          </>
        )}

        {(mode === 'login' || mode === 'signup') && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {mode === 'signup' && (
              <input
                type="text"
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-base outline-none focus:border-slate-500"
                required
              />
            )}
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-base outline-none focus:border-slate-500"
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-base outline-none focus:border-slate-500"
              required
              minLength={8}
            />

            {mode === 'login' && (
              <button
                type="button"
                onClick={() => setMode('forgot')}
                className="text-slate-400 text-xs text-left -mt-1 underline"
              >
                Forgot password?
              </button>
            )}

            {mode === 'signup' && password.length > 0 && (
              <div className="flex flex-col gap-1 -mt-1 px-1">
                {getPasswordChecks(password).map((check) => (
                  <p
                    key={check.label}
                    className={`text-xs flex items-center gap-1.5 ${
                      check.valid ? 'text-emerald-400' : 'text-slate-500'
                    }`}
                  >
                    {check.valid ? '✓' : '○'} {check.label}
                  </p>
                ))}
              </div>
            )}

            {error && <p className="text-red-400 text-xs">{error}</p>}

            <button
              type="submit"
              disabled={loading || (mode === 'signup' && !getPasswordChecks(password).every((c) => c.valid))}
              className="bg-amber-400 text-slate-900 font-bold py-2.5 rounded-lg mt-2 disabled:opacity-50"
            >
              {loading ? 'Please wait...' : mode === 'signup' ? 'Create account' : 'Log in'}
            </button>
          </form>
        )}

        {mode === 'forgot' && (
          <form onSubmit={handleRequestReset} className="flex flex-col gap-3">
            <p className="text-slate-400 text-sm">Enter your email and we'll send you a reset code.</p>
            <input
              type="email"
              placeholder="Email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-base outline-none focus:border-slate-500"
              required
            />
            {resetError && <p className="text-red-400 text-xs">{resetError}</p>}
            <button
              type="submit"
              disabled={loading}
              className="bg-amber-400 text-slate-900 font-bold py-2.5 rounded-lg disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send reset code'}
            </button>
            <button
              type="button"
              onClick={() => setMode('login')}
              className="text-slate-400 text-xs underline"
            >
              Back to login
            </button>
          </form>
        )}

        {mode === 'reset' && (
          <form onSubmit={handleResetPassword} className="flex flex-col gap-3">
            {resetMessage && <p className="text-emerald-400 text-xs">{resetMessage}</p>}
            <input
              type="text"
              placeholder="6-digit code"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-base font-mono tracking-widest text-center outline-none focus:border-slate-500"
              maxLength={6}
              required
            />
            <input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-base outline-none focus:border-slate-500"
              required
              minLength={8}
            />
            <div className="flex flex-col gap-1 -mt-1 px-1">
              {getPasswordChecks(newPassword).map((check) => (
                <p
                  key={check.label}
                  className={`text-xs flex items-center gap-1.5 ${
                    check.valid ? 'text-emerald-400' : 'text-slate-500'
                  }`}
                >
                  {check.valid ? '✓' : '○'} {check.label}
                </p>
              ))}
            </div>
            {resetError && <p className="text-red-400 text-xs">{resetError}</p>}
            <button
              type="submit"
              disabled={loading || otp.length !== 6 || !getPasswordChecks(newPassword).every((c) => c.valid)}
              className="bg-amber-400 text-slate-900 font-bold py-2.5 rounded-lg disabled:opacity-50"
            >
              {loading ? 'Resetting...' : 'Reset password'}
            </button>
            <button
              type="button"
              onClick={() => setMode('login')}
              className="text-slate-400 text-xs underline"
            >
              Back to login
            </button>
          </form>
        )}

        <p className="text-slate-600 text-[11px] text-center leading-relaxed mt-5">
          By continuing, you agree to ColorWin's{' '}
          <Link to="/terms" className="text-slate-400 underline">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link to="/privacy" className="text-slate-400 underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}