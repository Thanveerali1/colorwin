import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { verifyEmailRequest } from '../api/auth.api';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'checking' | 'success' | 'error'>('checking');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      return;
    }
    verifyEmailRequest(token)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'));
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
        <div className="flex justify-center gap-2 mb-6">
          <span className="w-3 h-3 rounded-full bg-red-500" />
          <span className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="w-3 h-3 rounded-full bg-violet-500" />
        </div>

        {status === 'checking' && <p className="text-slate-400">Verifying your email...</p>}

        {status === 'success' && (
          <>
            <div className="text-4xl mb-3">✅</div>
            <h1 className="text-xl font-bold mb-2">Email verified!</h1>
            <p className="text-slate-400 text-sm mb-6">Your email address has been confirmed.</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-4xl mb-3">⚠️</div>
            <h1 className="text-xl font-bold mb-2">Link invalid or expired</h1>
            <p className="text-slate-400 text-sm mb-6">
              This verification link is no longer valid. You can request a new one from your profile.
            </p>
          </>
        )}

        <Link
          to="/"
          className="inline-block bg-amber-400 text-slate-900 font-bold px-6 py-2.5 rounded-lg text-sm"
        >
          Go to ColorWin
        </Link>
      </div>
    </div>
  );
}