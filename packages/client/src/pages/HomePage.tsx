import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Shell from '../components/layout/Shell';
import { useAuthStore } from '../store/authStore';
import { getActiveRound } from '../api/round.api';
import type { Round } from '../api/round.api';

export default function HomePage() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.accessToken);
  const navigate = useNavigate();
  const [round, setRound] = useState<Round | null>(null);

  useEffect(() => {
    getActiveRound().then(setRound).catch(() => setRound(null));
  }, []);

  const phaseLabel =
    round?.phase === 'BETTING'
      ? 'Bets open'
      : round?.phase === 'LOCKED'
      ? 'Locked — spinning soon'
      : round?.phase === 'RESULT'
      ? 'Showing result'
      : 'Loading...';

  function handlePlayClick() {
    navigate(token ? '/game' : '/auth');
  }

  return (
    <Shell>
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-2xl font-bold">
            {token ? `Welcome back, ${user?.name || 'Player'} 👋` : 'Welcome to ColorWin'}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {token ? phaseLabel : 'A play-money color prediction game. Sign up to start playing.'}
          </p>
        </div>

        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-6 text-center">
          <div className="flex justify-center gap-2 mb-4">
            <span className="w-8 h-8 rounded-lg bg-red-500" />
            <span className="w-8 h-8 rounded-lg bg-emerald-500" />
            <span className="w-8 h-8 rounded-lg bg-blue-500" />
          </div>
          <button
            onClick={handlePlayClick}
            className="bg-amber-400 text-slate-900 font-bold px-6 py-3 rounded-xl w-full"
          >
            {token ? 'Go to live game' : 'Sign up to play'}
          </button>
          {!token && (
            <button
              onClick={() => navigate('/auth')}
              className="text-slate-400 text-xs mt-3 underline"
            >
              Already have an account? Log in
            </button>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="font-semibold mb-2">How it works</h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            Each round runs 3 minutes: 2 minutes to bet on Red, Blue, or Green, then a 1-minute
            lock while the reel spins, then the result reveals and payouts hit your wallet
            instantly.
          </p>
        </div>
      </div>
    </Shell>
  );
}