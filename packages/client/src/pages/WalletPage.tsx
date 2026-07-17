import { useEffect, useState } from 'react';
import Shell from '../components/layout/Shell';
import { getWallet, depositRequest, withdrawRequest } from '../api/wallet.api';

export default function WalletPage() {
  const [balance, setBalance] = useState<number | null>(null);
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function refreshBalance() {
    const wallet = await getWallet();
    setBalance(wallet.balance);
  }

  useEffect(() => {
    refreshBalance().catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const numAmount = Math.floor(Number(amount));
    if (!numAmount || numAmount <= 0) {
      setError('Enter a valid amount.');
      return;
    }

    setLoading(true);
    try {
      const wallet =
        mode === 'deposit' ? await depositRequest(numAmount) : await withdrawRequest(numAmount);
      setBalance(wallet.balance);
      setAmount('');
    } catch (err: any) {
      setError(
        err.response?.data?.error === 'INSUFFICIENT_FUNDS'
          ? 'Withdrawal exceeds your balance.'
          : 'Something went wrong.'
      );
    } finally {
      setLoading(false);
    }
  }

  const quickAmounts = [100, 500, 1000, 2500];

  return (
    <Shell>
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-2xl font-bold">Wallet</h1>
          <p className="text-slate-400 text-sm mt-1">Play coins only — nothing here is real money.</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center">
          <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Balance</p>
          <p className="text-3xl font-mono font-bold text-amber-400">
            🪙 {balance !== null ? balance.toLocaleString() : '...'}
          </p>
        </div>

        <div className="flex bg-slate-800 rounded-xl p-1">
          <button
            onClick={() => setMode('deposit')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold ${mode === 'deposit' ? 'bg-slate-700' : 'text-slate-400'}`}
          >
            Deposit
          </button>
          <button
            onClick={() => setMode('withdraw')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold ${mode === 'withdraw' ? 'bg-slate-700' : 'text-slate-400'}`}
          >
            Withdraw
          </button>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-3">
          <label className="text-xs uppercase tracking-wide text-slate-500">Amount (Play Coins)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 500"
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 font-mono text-base outline-none focus:border-slate-500"
          />
          <div className="flex gap-2 flex-wrap">
            {quickAmounts.map((v) => (
              <button
                type="button"
                key={v}
                onClick={() => setAmount(String(v))}
                className="bg-slate-800 border border-slate-700 rounded-full px-3 py-1 text-xs font-mono"
              >
                +{v}
              </button>
            ))}
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="bg-amber-400 text-slate-900 font-bold py-2.5 rounded-lg mt-2 disabled:opacity-50"
          >
            {loading ? 'Please wait...' : mode === 'deposit' ? 'Deposit Play Coins' : 'Withdraw Play Coins'}
          </button>
        </form>
      </div>
    </Shell>
  );
}
