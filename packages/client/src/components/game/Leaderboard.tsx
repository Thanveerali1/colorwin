import { useEffect, useState } from 'react';
import { getLeaderboard } from '../../api/leaderboard.api';
import type { LeaderboardEntry } from '../../api/leaderboard.api';
import { getSocket } from '../../sockets/socket';

const MEDAL = ['🥇', '🥈', '🥉'];

function RankRow({ entry, index }: { entry: LeaderboardEntry; index: number }) {
  return (
    <div
      className="flex items-center justify-between py-2.5 px-1 border-b border-slate-800 last:border-0 animate-in"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="flex items-center gap-3">
        <span className="w-7 text-center font-mono text-sm text-slate-400">
          {MEDAL[index] || `#${entry.rank}`}
        </span>
        <span className="text-sm font-medium">{entry.name}</span>
      </div>
      <span className="font-mono text-sm font-bold text-amber-400">
        🪙{entry.totalWon.toLocaleString()}
      </span>
    </div>
  );
}

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  function refresh() {
    getLeaderboard()
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refresh();

    const socket = getSocket();
    socket.on('round:result', refresh);

    const interval = setInterval(refresh, 60_000);

    return () => {
      socket.off('round:result', refresh);
      clearInterval(interval);
    };
  }, []);

  const visible = expanded ? entries : entries.slice(0, 5);

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />

      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm flex items-center gap-1.5">
          🏆 Top Winners <span className="text-slate-500 font-normal text-xs">(last 24h)</span>
        </h3>
        {entries.length > 5 && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-xs text-amber-400 font-semibold"
          >
            {expanded ? 'Show less' : `Show all ${entries.length}`}
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-slate-500 text-xs text-center py-6">Loading...</p>
      ) : entries.length === 0 ? (
        <p className="text-slate-500 text-xs text-center py-6">
          No wins yet in the last 24 hours — be the first!
        </p>
      ) : (
        <div className={expanded ? 'max-h-80 overflow-y-auto pr-1' : ''}>
          {visible.map((entry, i) => (
            <RankRow key={entry.userId} entry={entry} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
