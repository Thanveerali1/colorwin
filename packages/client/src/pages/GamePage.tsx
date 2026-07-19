import { useEffect, useState } from 'react';
import Shell from '../components/layout/Shell';
import { getSocket } from '../sockets/socket';
import { getActiveRound, placeBetRequest, cancelBetRequest, getMyBetRequest } from '../api/round.api';
import type { Round, Color, Bet } from '../api/round.api';
import Leaderboard from '../components/game/Leaderboard';
import WinPopup from '../components/game/WinPopup';
import HistoryPopup from '../components/game/HistoryPopup';
import { trackEvent } from '../lib/analytics';

const COLORS: { key: Color; label: string; bg: string; mult: string }[] = [
  { key: 'RED', label: 'RED', bg: 'bg-red-500', mult: '2.0x' },
  { key: 'BLUE', label: 'BLUE', bg: 'bg-blue-500', mult: '2.0x' },
  { key: 'GREEN', label: 'GREEN', bg: 'bg-emerald-500', mult: '2.0x' },
];

const CHIP_VALUES = [10, 50, 100, 500, 1000, 2000, 3500];

const BLOCK_HEIGHT = 96;
const REEL_UNIT: Color[] = ['RED', 'BLUE', 'GREEN'];
const REEL_PATTERN: Color[] = Array(12).fill(REEL_UNIT).flat();
const DURATIONS = [3400, 3900, 3600]; // slight stagger so reels don't stop in perfect unison

function blockBg(c: Color) {
  return c === 'RED' ? 'bg-red-500' : c === 'BLUE' ? 'bg-blue-500' : 'bg-emerald-500';
}

function pickLandingIndex(color: Color, minIndex: number): number {
  let idx = REEL_PATTERN.length - 3;
  while (idx > minIndex) {
    if (REEL_PATTERN[idx] === color) return idx;
    idx--;
  }
  return REEL_PATTERN.findIndex((c) => c === color);
}

function phaseDurationLeft(round: Round | null): number {
  if (!round) return 0;
  const now = Date.now();

  if (round.phase === 'BETTING' || round.phase === 'LOCKED') {
    const start = new Date(round.startedAt).getTime();
    const end = start + 180_000; // one continuous 3-minute countdown
    return Math.max(0, Math.floor((end - now) / 1000));
  }

  if (round.phase === 'RESULT' && round.resultAt) {
    const end = new Date(round.resultAt).getTime() + 6_000;
    return Math.max(0, Math.floor((end - now) / 1000));
  }

  return 0;
}

type ReelState = 'idle' | 'shuffle' | 'spinning' | 'revealed';

interface ReelColumnProps {
  state: ReelState;
  targetIndex: number;
  transitioning: boolean;
  reversed?: boolean;
  durationMs: number;
  resultColor: Color | null;
}

function ReelColumn({ state, targetIndex, transitioning, reversed, durationMs, resultColor }: ReelColumnProps) {
  const flipStyle = reversed ? { transform: 'scaleY(-1)' as const } : undefined;

  if (state === 'revealed' && resultColor) {
    return (
      <div
        className={`w-full h-full flex items-center justify-center font-bold text-2xl text-white ${blockBg(
          resultColor
        )} animate-reveal-glow`}
      >
        {resultColor[0]}
      </div>
    );
  }

  const spinClass =
    state === 'idle' ? 'animate-reel-slow-spin' : state === 'shuffle' ? 'animate-reel-shuffle' : '';

  return (
    <div className="w-full h-full overflow-hidden" style={flipStyle}>
      <div
        className={spinClass}
        style={
          state === 'spinning'
            ? {
                transform: `translateY(-${targetIndex * BLOCK_HEIGHT}px)`,
                transition: transitioning
                  ? `transform ${durationMs}ms cubic-bezier(0.12,0.85,0.15,1)`
                  : 'none',
              }
            : undefined
        }
      >
        {REEL_PATTERN.map((c, i) => (
          <div
            key={i}
            className={`h-24 flex items-center justify-center font-bold text-2xl text-white ${blockBg(c)}`}
            style={flipStyle}
          >
            {c[0]}
          </div>
        ))}
      </div>
    </div>
  );
}

function Gear({ size, spinning, dir }: { size: number; spinning: boolean; dir: 'cw' | 'ccw' }) {
  const spinClass = spinning
    ? dir === 'cw'
      ? 'animate-gear-fast-cw'
      : 'animate-gear-fast-ccw'
    : dir === 'cw'
    ? 'animate-gear-slow-cw'
    : 'animate-gear-slow-ccw';

  return (
    <span
      className={`inline-block text-slate-500 ${spinClass}`}
      style={{ fontSize: size, lineHeight: 1 }}
    >
      ⚙️
    </span>
  );
}

export default function GamePage() {
  const [round, setRound] = useState<Round | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [selectedColor, setSelectedColor] = useState<Color | null>(null);
  const [selectedChip, setSelectedChip] = useState(50);
  const [myBets, setMyBets] = useState<Bet[]>([]);
  const [error, setError] = useState('');

  const [reelState, setReelState] = useState<ReelState>('idle');
  const [targets, setTargets] = useState<[number, number, number]>([0, 0, 0]);
  const [transitioning, setTransitioning] = useState(false);
  const [revealedColor, setRevealedColor] = useState<Color | null>(null);
  const [leverPulling, setLeverPulling] = useState(false);

  const [winPopup, setWinPopup] = useState<{ amount: number; color: Color } | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  function landReelsOn(color: Color) {
    setLeverPulling(true);
    setTimeout(() => setLeverPulling(false), 1300);

    const t0 = pickLandingIndex(color, 20);
    const t1 = pickLandingIndex(color, 15);
    const t2 = pickLandingIndex(color, 25);

    setReelState('spinning');
    setTransitioning(false);
    setTargets([0, 0, 0]);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTransitioning(true);
        setTargets([t0, t1, t2]);
      });
    });

    setTimeout(() => {
      setRevealedColor(color);
      setReelState('revealed');
    }, Math.max(...DURATIONS) + 100);
  }

  useEffect(() => {
    getActiveRound().then((r) => {
      setRound(r);
      if (r.phase === 'BETTING') {
        setReelState('idle');
      } else if (r.phase === 'LOCKED') {
        setReelState('shuffle');
      } else if (r.phase === 'RESULT' && r.result) {
        setRevealedColor(r.result);
        setReelState('revealed');
      }
    });

    getMyBetRequest().then((bet) => {
      if (bet) setMyBets([bet]);
    });

    const socket = getSocket();

    socket.on('round:started', (data: { roundId: string; startedAt: string }) => {
      setRound({
        id: data.roundId,
        phase: 'BETTING',
        result: null,
        poolRed: 0,
        poolBlue: 0,
        poolGreen: 0,
        startedAt: data.startedAt,
        lockedAt: null,
        resultAt: null,
      });
      setMyBets([]);
      setReelState('idle');
      setRevealedColor(null);
      setTransitioning(false);
      setTargets([0, 0, 0]);
      setWinPopup(null);
    });

    socket.on('round:phase_changed', (data: { roundId: string; phase: 'LOCKED' }) => {
      setRound((prev) =>
        prev && prev.id === data.roundId
          ? { ...prev, phase: 'LOCKED', lockedAt: new Date().toISOString() }
          : prev
      );
      setReelState('shuffle');
    });

    socket.on('round:result', (data: { roundId: string; result: Color }) => {
      setRound((prev) =>
        prev && prev.id === data.roundId
          ? { ...prev, phase: 'RESULT', result: data.result, resultAt: new Date().toISOString() }
          : prev
      );
      landReelsOn(data.result);

      setMyBets((currentBets) => {
        const winningBet = currentBets.find((b) => b.color === data.result);
        if (winningBet) {
          // All three colors pay 2x now.
          const amount = Math.round(winningBet.amount * 2);
          setTimeout(() => {
            setWinPopup({ amount, color: data.result });
          }, Math.max(...DURATIONS) + 300);
          trackEvent('round_won', { color: data.result, amount });
        }
        return currentBets;
      });
    });

    return () => {
      socket.off('round:started');
      socket.off('round:phase_changed');
      socket.off('round:result');
    };
  }, []);

  useEffect(() => {
    setSecondsLeft(phaseDurationLeft(round));
    const interval = setInterval(() => setSecondsLeft(phaseDurationLeft(round)), 1000);
    return () => clearInterval(interval);
  }, [round?.phase, round?.startedAt, round?.lockedAt, round?.resultAt]);

  async function handlePlaceBet() {
    if (!selectedColor || !round || round.phase !== 'BETTING') return;
    if (myBets.length > 0) {
      setError('You can only place one bet per round.');
      return;
    }
    setError('');
    try {
      const bet = await placeBetRequest(selectedColor, selectedChip);
      setMyBets((prev) => [...prev, bet]);
      trackEvent('bet_placed', { color: selectedColor, amount: selectedChip });
      setSelectedColor(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not place bet.');
    }
  }

  async function handleCancelBet(betId: string) {
    try {
      await cancelBetRequest(betId);
      setMyBets((prev) => prev.filter((b) => b.id !== betId));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not cancel bet.');
    }
  }

  if (!round) {
    return (
      <Shell>
        <p className="text-slate-400 text-center py-10">Loading round...</p>
      </Shell>
    );
  }

  const bettingOpen = round.phase === 'BETTING';
  const hasBetThisRound = myBets.length > 0;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');
  const gearsSpinning = reelState === 'shuffle' || reelState === 'spinning';

  const phaseLabel =
    round.phase === 'BETTING' ? 'Bets open' : round.phase === 'LOCKED' ? 'Locked — spinning' : 'Result';

  const phaseColor =
    round.phase === 'BETTING'
      ? 'text-emerald-400'
      : round.phase === 'LOCKED'
      ? 'text-amber-400'
      : 'text-blue-400';

  return (
    <Shell>
      <div className="flex flex-col gap-5">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4 flex items-center justify-between">
          <div>
            <p className={`font-bold text-sm ${phaseColor}`}>{phaseLabel}</p>
            <p className="text-xs text-slate-500">Round #{round.id.slice(0, 6)}</p>
          </div>
          <div className="flex items-center gap-3">
            <p className="font-mono text-2xl font-bold">
              {mm}:{ss}
            </p>
            <button
              onClick={() => setShowHistory(true)}
              className="text-xs bg-slate-800 border border-slate-700 rounded-full px-3 py-1.5 font-semibold text-slate-300"
            >
              History
            </button>
          </div>
        </div>

        {/* Slot machine cabinet */}
        <div className="relative pr-11">
          <div className="relative rounded-[26px] border-4 border-slate-700 bg-gradient-to-b from-slate-800 via-slate-900 to-black p-4 shadow-2xl">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Gear size={18} spinning={gearsSpinning} dir="cw" />
              <span className="font-black tracking-[0.2em] text-amber-400 text-sm animate-marquee-glow">
                COLORWIN
              </span>
              <Gear size={18} spinning={gearsSpinning} dir="ccw" />
            </div>

            <div className="relative h-24 rounded-2xl overflow-hidden border-2 border-slate-950 bg-black grid grid-cols-3 gap-px shadow-inner">
              <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-black to-transparent z-10 pointer-events-none" />
              <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-black to-transparent z-10 pointer-events-none" />
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/30 z-10 -translate-y-1/2 pointer-events-none" />

              <ReelColumn
                state={reelState}
                targetIndex={targets[0]}
                transitioning={transitioning}
                durationMs={DURATIONS[0]}
                resultColor={revealedColor}
              />
              <ReelColumn
                state={reelState}
                targetIndex={targets[1]}
                transitioning={transitioning}
                reversed
                durationMs={DURATIONS[1]}
                resultColor={revealedColor}
              />
              <ReelColumn
                state={reelState}
                targetIndex={targets[2]}
                transitioning={transitioning}
                durationMs={DURATIONS[2]}
                resultColor={revealedColor}
              />
            </div>

            <div className="flex justify-between mt-3 px-2">
              <span className="w-2 h-2 rounded-full bg-slate-600 shadow-inner" />
              <span className="w-2 h-2 rounded-full bg-slate-600 shadow-inner" />
              <span className="w-2 h-2 rounded-full bg-slate-600 shadow-inner" />
              <span className="w-2 h-2 rounded-full bg-slate-600 shadow-inner" />
            </div>
          </div>

          <div className="absolute top-3 right-0 flex flex-col items-center">
            <div className="relative w-2 h-20 bg-gradient-to-b from-slate-500 to-slate-700 rounded-full">
              <div
                className={`absolute -left-3 -top-1 w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-red-700 border-2 border-red-900 shadow-lg ${
                  leverPulling ? 'animate-lever-pull' : ''
                }`}
              />
            </div>
            <div className="w-7 h-3 bg-slate-700 rounded-b-lg -mt-0.5 border border-slate-600" />
          </div>
        </div>

        {/* Bet color buttons */}
        <div className="grid grid-cols-3 gap-2">
          {COLORS.map((c) => (
            <button
              key={c.key}
              disabled={!bettingOpen || hasBetThisRound}
              onClick={() => setSelectedColor(c.key)}
              className={`${c.bg} rounded-xl py-4 text-center font-bold text-sm text-white disabled:opacity-30 ${
                selectedColor === c.key ? 'ring-2 ring-white' : ''
              }`}
            >
              {c.label}
              <span className="block text-[11px] font-mono opacity-80 mt-0.5">{c.mult}</span>
            </button>
          ))}
        </div>

        <div className="flex gap-2 flex-wrap">
          {CHIP_VALUES.map((v) => (
            <button
              key={v}
              disabled={!bettingOpen || hasBetThisRound}
              onClick={() => setSelectedChip(v)}
              className={`rounded-full px-3 py-1.5 text-xs font-mono border disabled:opacity-30 ${
                selectedChip === v
                  ? 'bg-amber-400 text-slate-900 border-amber-400'
                  : 'bg-slate-800 text-white border-slate-700'
              }`}
            >
              🪙{v}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2">
          <span className="text-slate-400 text-sm">🪙</span>
          <input
            type="number"
            min={1}
            max={100000}
            disabled={!bettingOpen || hasBetThisRound}
            placeholder="Enter custom amount"
            value={selectedChip || ''}
            onChange={(e) => {
              const val = Math.floor(Number(e.target.value));
              setSelectedChip(val > 0 ? val : 0);
            }}
            className="bg-transparent flex-1 text-base font-mono outline-none disabled:opacity-30"
          />
        </div>

        {error && <p className="text-red-400 text-xs text-center">{error}</p>}

        <button
          disabled={!bettingOpen || !selectedColor || hasBetThisRound || !selectedChip || selectedChip <= 0}
          onClick={handlePlaceBet}
          className="bg-amber-400 text-slate-900 font-bold py-3 rounded-xl disabled:opacity-30"
        >
          {hasBetThisRound
            ? 'One bet per round — already placed'
            : `Place bet — 🪙${selectedChip} on ${selectedColor || '—'}`}
        </button>

        <div>
          <h3 className="font-semibold text-sm mb-2">Your bets this round</h3>
          {myBets.length === 0 ? (
            <p className="text-slate-500 text-xs">No bets placed this round.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {myBets.map((b) => (
                <div
                  key={b.id}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 flex items-center justify-between text-sm"
                >
                  <span>
                    {b.color} · 🪙{b.amount}
                  </span>
                  {bettingOpen ? (
                    <button onClick={() => handleCancelBet(b.id)} className="text-amber-400 text-xs">
                      Cancel
                    </button>
                  ) : (
                    <span className="text-slate-500 text-xs">Locked</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <Leaderboard />
      </div>

      {winPopup && (
        <WinPopup amount={winPopup.amount} color={winPopup.color} onClose={() => setWinPopup(null)} />
      )}

      {showHistory && <HistoryPopup onClose={() => setShowHistory(false)} />}
    </Shell>
  );
}