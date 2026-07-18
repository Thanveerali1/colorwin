import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const STORAGE_KEY = 'colorwin-cookie-consent';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(STORAGE_KEY);
    if (!consent) {
      setVisible(true);
    }
  }, []);

  function accept() {
    localStorage.setItem(STORAGE_KEY, 'accepted');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-700 px-5 py-4">
      <div className="max-w-lg mx-auto flex flex-col sm:flex-row sm:items-center gap-3">
        <p className="text-xs text-slate-300 leading-relaxed flex-1">
          ColorWin uses your browser's local storage to keep you signed in, and PostHog for basic
          product analytics (page views and in-app actions — no session recording). Google Sign-In (if
          you use it) is subject to Google's own cookie policy. We don't use advertising cookies.{' '}
          <Link to="/privacy" className="text-amber-400 underline">
            Learn more
          </Link>
        </p>
        <button
          onClick={accept}
          className="bg-amber-400 text-slate-900 font-bold text-sm px-5 py-2 rounded-full whitespace-nowrap self-start sm:self-auto"
        >
          Got it
        </button>
      </div>
    </div>
  );
}