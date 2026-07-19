import { useEffect, useState } from 'react';
import { getRoundHistoryRequest } from '../../api/round.api';
import type { RoundHistoryEntry, Color } from '../../api/round.api';

interface HistoryPopupProps {
  onClose: () => void;
}

function blockBg(c: Color) {
  return c === 'RED' ? 'bg-red-500' : c === 'BLUE' ? 'bg-blue-500' : 'bg-emerald-500';
}

function formatTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function HistoryPopup({ onClose }: HistoryPopupProps) {
  const [history, setHistory] = useState<RoundHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRoundHistoryRequest()
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm max-h-[75vh] flex flex-col animate-pop-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="font-bold text-lg">Last 100 rounds</h2>
          <button onClick={onClose} className="text-slate-400 text-xl leading-none px-2">
            ✕
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-3">
          {loading ? (
            <p className="text-slate-500 text-sm text-center py-8">Loading...</p>
          ) : history.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">No completed rounds yet.</p>
          ) : (
            <div className="flex flex-col">
              {history.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between py-2.5 border-b border-slate-800 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-6 h-6 rounded-md ${blockBg(
                        r.result
                      )} flex items-center justify-center text-[10px] font-bold text-white`}
                    >
                      {r.result[0]}
                    </span>
                    <span className="text-xs text-slate-500">{formatTime(r.resultAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}