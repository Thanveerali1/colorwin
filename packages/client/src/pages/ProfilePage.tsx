import { useEffect, useState } from 'react';
import Shell from '../components/layout/Shell';
import { useAuthStore } from '../store/authStore';
import { getTransactions } from '../api/transactions.api';
import type { Transaction, HistoryFilter } from '../api/transactions.api';
import { getMeRequest, resendVerificationRequest } from '../api/auth.api';
import type { MeResponse } from '../api/auth.api';

const TABS: { key: HistoryFilter; label: string }[] = [
  { key: 'bets', label: 'Bets' },
  { key: 'deposits', label: 'Deposits' },
  { key: 'withdrawals', label: 'Withdrawals' },
];

const COLOR_DOT: Record<string, string> = {
  RED: 'bg-red-500',
  GREEN: 'bg-emerald-500',
  VIOLET: 'bg-violet-500',
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function TxRow({ tx }: { tx: Transaction }) {
  const isPositive = tx.type === 'DEPOSIT' || tx.type === 'WIN' || tx.type === 'BET_CANCELLED';
  const sign = isPositive ? '+' : '-';
  const color = isPositive ? 'text-emerald-400' : 'text-white';

  const labelMap: Record<string, string> = {
    DEPOSIT: 'Deposit',
    WITHDRAW: 'Withdrawal',
    BET: 'Bet placed',
    BET_CANCELLED: 'Bet cancelled',
    WIN: 'Round won',
  };

  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-800 last:border-0">
      <div className="flex items-center gap-2">
        {tx.bet && <span className={`w-2.5 h-2.5 rounded-full ${COLOR_DOT[tx.bet.color]}`} />}
        <div>
          <p className="text-sm font-medium">{labelMap[tx.type]}</p>
          <p className="text-xs text-slate-500">{formatTime(tx.createdAt)}</p>
        </div>
      </div>
      <span className={`font-mono text-sm font-semibold ${color}`}>
        {sign}
        {tx.amount.toLocaleString()}
      </span>
    </div>
  );
}

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<HistoryFilter>('bets');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [me, setMe] = useState<MeResponse | null>(null);
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent'>('idle');

  useEffect(() => {
    getMeRequest()
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  useEffect(() => {
    setLoading(true);
    getTransactions(tab)
      .then(setTransactions)
      .catch(() => setTransactions([]))
      .finally(() => setLoading(false));
  }, [tab]);

  async function handleResend() {
    setResendStatus('sending');
    try {
      await resendVerificationRequest();
      setResendStatus('sent');
    } catch {
      setResendStatus('idle');
    }
  }

  return (
    <Shell>
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-2xl font-bold">{user?.name || 'Player'}</h1>
          <p className="text-slate-400 text-sm mt-1">Play-money profile — demo session only.</p>
        </div>

        {me && !me.emailVerified && (
          <div className="bg-amber-400/10 border border-amber-400/40 rounded-2xl p-4 flex flex-col gap-2">
            <p className="text-amber-400 text-sm font-semibold">📧 Verify your email</p>
            <p className="text-slate-300 text-xs">
              We sent a verification link to <strong>{me.email}</strong>. Check your inbox (and spam
              folder) to confirm your address.
            </p>
            <button
              onClick={handleResend}
              disabled={resendStatus !== 'idle'}
              className="self-start bg-amber-400 text-slate-900 text-xs font-bold px-4 py-1.5 rounded-full disabled:opacity-50"
            >
              {resendStatus === 'sending'
                ? 'Sending...'
                : resendStatus === 'sent'
                ? 'Sent — check your inbox'
                : 'Resend verification email'}
            </button>
          </div>
        )}

        <div className="flex bg-slate-800 rounded-xl p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold ${
                tab === t.key ? 'bg-slate-700' : 'text-slate-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 min-h-[200px]">
          {loading ? (
            <p className="text-slate-500 text-sm text-center py-8">Loading...</p>
          ) : transactions.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">Nothing here yet.</p>
          ) : (
            transactions.map((tx) => <TxRow key={tx.id} tx={tx} />)
          )}
        </div>
      </div>
    </Shell>
  );
}