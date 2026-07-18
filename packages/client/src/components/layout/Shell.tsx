import { ReactNode, useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { getWallet } from '../../api/wallet.api';

interface ShellProps {
  children: ReactNode;
}

export default function Shell({ children }: ShellProps) {
  const [balance, setBalance] = useState<number | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const token = useAuthStore((s) => s.accessToken);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    if (!token) {
      setBalance(null);
      return;
    }
    getWallet()
      .then((w) => setBalance(w.balance))
      .catch(() => setBalance(null));
  }, [location.pathname, token]);

  const navItems = [
    { path: '/', label: 'Home' },
    { path: '/game', label: 'Play' },
    { path: '/wallet', label: 'Wallet' },
    { path: '/profile', label: 'Profile' },
  ];

  function handleNav(path: string) {
    if (!token && path !== '/') {
      navigate('/auth');
      return;
    }
    navigate(path);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <header className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
        <div className="flex items-center gap-2 font-bold text-lg">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 -ml-1" />
          <span className="w-2.5 h-2.5 rounded-full bg-violet-500 -ml-1 mr-1" />
          ColorWin
        </div>
        <div className="flex items-center gap-3">
          {token ? (
            <>
              <span className="bg-slate-800 border border-slate-700 rounded-full px-3 py-1 text-sm font-mono text-amber-400">
                🪙 {balance !== null ? balance.toLocaleString() : '...'}
              </span>
              <button
                onClick={() => {
                  logout();
                  navigate('/');
                }}
                className="text-xs text-slate-400 hover:text-white"
              >
                Logout
              </button>
            </>
          ) : (
            <button
              onClick={() => navigate('/auth')}
              className="bg-amber-400 text-slate-900 text-xs font-bold px-4 py-1.5 rounded-full"
            >
              Log in
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-lg w-full mx-auto p-5">
        {children}
        <div className="flex justify-center gap-4 pt-6 pb-2">
          <Link to="/privacy" className="text-slate-600 text-[11px] hover:text-slate-400">
            Privacy Policy
          </Link>
          <Link to="/terms" className="text-slate-600 text-[11px] hover:text-slate-400">
            Terms of Service
          </Link>
        </div>
      </main>

      <nav className="border-t border-slate-800 bg-slate-900 flex sticky bottom-0 pb-[env(safe-area-inset-bottom)]">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => handleNav(item.path)}
            className={`flex-1 py-3 text-sm font-medium ${
              location.pathname === item.path ? 'text-amber-400' : 'text-slate-500'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}