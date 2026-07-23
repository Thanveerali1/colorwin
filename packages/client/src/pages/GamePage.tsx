import { useEffect, useRef, useState } from 'react';
import Shell from '../components/layout/Shell';
import { getSocket } from '../sockets/socket';
import { getActiveRound, placeBetRequest, cancelBetRequest, getMyBetRequest } from '../api/round.api';
import type { Round, Color, Bet } from '../api/round.api';
import Leaderboard from '../components/game/Leaderboard';
import WinPopup from '../components/game/WinPopup';
import HistoryPopup from '../components/game/HistoryPopup';
import { trackEvent } from '../lib/analytics';
import { useWalletStore } from '../store/walletStore';
import {
  unlockAudio,
  isMuted,
  setMuted,
  playReelTick,
  playLeverClunk,
  playClick,
  playWinChime,
} from '../lib/sound';
import { startBgm, stopBgm, updateBgmMuteState } from '../lib/bgm';
import { scheduleTicksForSpin, clearScheduledTicks } from '../lib/reelSync';

const COLORS: { key: Color; label: string; bg: string; mult: string }[] = [
  { key: 'RED', label: 'RED', bg: 'bg-red-500', mult: '2.0x' },
  { key: 'BLUE', label: 'BLUE', bg: 'bg-blue-500', mult: '2.0x' },
  { key: 'GREEN', label: 'GREEN', bg: 'bg-emerald-500', mult: '2.0x' },
];

const CHIP_VALUES = [10, 50, 100, 500, 1000, 2000, 3500];

const BLOCK_HEIGHT = 96;
const REEL_UNIT: Color[] = ['RED', 'BLUE', 'GREEN'];
const REEL_PATTERN: Color[] = Array(12).fill(REEL_UNIT).flat();
const DURATIONS = [3400, 3900, 3600];

// How long before the round's official end the client starts its landing
// animation -- must match the server's REVEAL_LEAD_MS (round.engine.ts) so
// the reels finish landing right as the round timer hits 00:00, instead of
// spinning for several more seconds after. 5s: betting+locked runs 2:55,
// the reel lands and reveals within the final :05 of the same 3:00 clock.
const REVEAL_LEAD_MS = 5_000;

// Idle/shuffle loop speed escalates across the 3-minute round: minute 1 at
// the original baseline speed, minute 2 a bit faster, and minute 3 (the
// LOCKED/spinning-toward-result phase) faster still. Duration is ms per full
// loop of the CSS keyframe (see index.css reel-slow-spin/reel-shuffle,
// travelling the same 288px either way -- only the speed changes).
const SPIN_LOOP_MS = { slow: 500, medium: 380, fast: 260 };

function loopDurationMsFor(phase: Round['phase'] | undefined, secondsLeft: number): number {
  if (phase === 'LOCKED') return SPIN_LOOP_MS.fast; // minute 3
  if (secondsLeft > 120) return SPIN_LOOP_MS.slow; // minute 1 (180s -> 120s remaining)
  return SPIN_LOOP_MS.medium; // minute 2 (120s -> 60s remaining)
}

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
  // One continuous 3-minute (180s) clock for the whole round, regardless of
  // phase. Result reveal lands inside the final REVEAL_LEAD_MS of this same
  // window (see server round.engine.ts) -- there's no separate countdown
  // that starts up after this one reaches 00:00.
  const start = new Date(round.startedAt).getTime();
  const end = start + 180_000;
  return Math.max(0, Math.floor((end - now) / 1000));
}

type ReelState = 'idle' | 'shuffle' | 'spinning' | 'revealed';

interface ReelColumnProps {
  state: ReelState;
  targetIndex: number;
  transitioning: boolean;
  reversed?: boolean;
  durationMs: number;
  resultColor: Color | null;
  loopMs: number;
}

function ReelColumn({ state, targetIndex, transitioning, reversed, durationMs, resultColor, loopMs }: ReelColumnProps) {
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

  const loopStyle = state === 'idle' || state === 'shuffle' ? { animationDuration: `${loopMs}ms` } : undefined;

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
            : loopStyle
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
  const [muted, setMutedState] = useState(false);

  const fetchBalance = useWalletStore((s) => s.fetchBalance);

  const loopTickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const spinTickTimeoutsRef = useRef<number[]>([]);
  const bgmStartedRef = useRef(false);
  // Tracks which round has already had its landing animation triggered by
  // 'round:landing', so the 'round:result' handler knows whether to fall
  // back to landing late (e.g. client connected mid-round and missed it)
  // or just confirm/settle without re-triggering the animation.
  const landedRoundIdRef = useRef<string | null>(null);

  useEffect(() => {
    setMutedState(isMuted());
    return () => {
      stopBgm();
      if (loopTickIntervalRef.current) clearInterval(loopTickIntervalRef.current);
      clearScheduledTicks(spinTickTimeoutsRef.current);
    };
  }, []);

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
    unlockAudio();
    updateBgmMuteState();
  }

  function handleUserGesture() {
    unlockAudio();
    if (!bgmStartedRef.current) {
      bgmStartedRef.current = true;
      startBgm();
    }
  }

  const loopMs = loopDurationMsFor(round?.phase, secondsLeft);

  useEffect(() => {
    if (reelState === 'idle' || reelState === 'shuffle') {
      const intervalMs = loopMs / REEL_UNIT.length;
      loopTickIntervalRef.current = setInterval(() => playReelTick(), intervalMs);
    } else if (loopTickIntervalRef.current) {
      clearInterval(loopTickIntervalRef.current);
      loopTickIntervalRef.current = null;
    }
    return () => {
      if (loopTickIntervalRef.current) {
        clearInterval(loopTickIntervalRef.current);
        loopTickIntervalRef.current = null;
      }
    };
  }, [reelState, loopMs]);

  function landReelsOn(color: Color) {
    setLeverPulling(true);
    playLeverClunk();
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

        clearScheduledTicks(spinTickTimeoutsRef.current);
        const allIds: number[] = [];
        [t0, t1, t2].forEach((target, i) => {
          const ids = scheduleTicksForSpin(target * BLOCK_HEIGHT, DURATIONS[i], BLOCK_HEIGHT, playReelTick);
          allIds.push(...ids);
        });
        spinTickTimeoutsRef.current = allIds;
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
      landedRoundIdRef.current = null;
    });

    socket.on('round:phase_changed', (data: { roundId: string; phase: 'LOCKED' }) => {
      setRound((prev) =>
        prev && prev.id === data.roundId
          ? { ...prev, phase: 'LOCKED', lockedAt: new Date().toISOString() }
          : prev
      );
      setReelState('shuffle');
    });

    // Fires ~REVEAL_LEAD_MS before the round's official end. Starts the
    // landing animation early so it finishes right as the round timer hits
    // 00:00, instead of continuing to spin after the countdown ends. Does
    // NOT touch round.phase -- the timer keeps counting down from the
    // existing BETTING/LOCKED calculation until the real 'round:result'
    // arrives at the correct time.
    socket.on('round:landing', (data: { roundId: string; result: Color }) => {
      landedRoundIdRef.current = data.roundId;
      landReelsOn(data.result);
    });

    socket.on('round:result', (data: { roundId: string; result: Color }) => {
      setRound((prev) =>
        prev && prev.id === data.roundId
          ? { ...prev, phase: 'RESULT', result: data.result, resultAt: new Date().toISOString() }
          : prev
      );

      // Normal path: 'round:landing' already started the animation ~4s ago
      // and it has finished landing by now -- nothing more to trigger.
      // Fallback path: this client missed 'round:landing' (e.g. connected
      // mid-round), so land the reels now, same as the old behavior.
      const alreadyLanded = landedRoundIdRef.current === data.roundId;
      if (!alreadyLanded) {
        landReelsOn(data.result);
      }

      setMyBets((currentBets) => {
        const winningBet = currentBets.find((b) => b.color === data.result);
        if (winningBet) {
          const amount = Math.round(winningBet.amount * 2);
          const popupDelay = alreadyLanded ? 0 : Math.max(...DURATIONS) + 300;
          setTimeout(() => {
            setWinPopup({ amount, color: data.result });
            playWinChime();
            fetchBalance();
          }, popupDelay);
          trackEvent('round_won', { color: data.result, amount });
        }
        return currentBets;
      });
    });

    return () => {
      socket.off('round:started');
      socket.off('round:phase_changed');
      socket.off('round:landing');
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
      fetchBalance();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not place bet.');
    }
  }

  async function handleCancelBet(betId: string) {
    try {
      await cancelBetRequest(betId);
      setMyBets((prev) => prev.filter((b) => b.id !== betId));
      fetchBalance();
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

  // Once the reels have actually landed on the result, show "Result" right
  // away -- don't wait for the server's official phase flip, which now
  // happens up to REVEAL_LEAD_MS later (see round.engine.ts). Keeps the
  // label in sync with what's visually on screen.
  const resultShowing = reelState === 'revealed' || round.phase === 'RESULT';

  const phaseLabel = resultShowing
    ? 'Result'
    : round.phase === 'BETTING'
    ? 'Bets open'
    : 'Locked — spinning';

  const phaseColor = resultShowing
    ? 'text-violet-400'
    : round.phase === 'BETTING'
    ? 'text-emerald-400'
    : 'text-amber-400';

  return (
    <Shell>
      <div className="flex flex-col gap-5" onClickCapture={handleUserGesture}>
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
              onClick={toggleMute}
              className="text-xs bg-slate-800 border border-slate-700 rounded-full w-8 h-8 flex items-center justify-center"
              title={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? '🔇' : '🔊'}
            </button>
            <button
              onClick={() => setShowHistory(true)}
              className="text-xs bg-slate-800 border border-slate-700 rounded-full px-3 py-1.5 font-semibold text-slate-300"
            >
              History
            </button>
          </div>
        </div>

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
                loopMs={loopMs}
              />
              <ReelColumn
                state={reelState}
                targetIndex={targets[1]}
                transitioning={transitioning}
                reversed
                durationMs={DURATIONS[1]}
                resultColor={revealedColor}
                loopMs={loopMs}
              />
              <ReelColumn
                state={reelState}
                targetIndex={targets[2]}
                transitioning={transitioning}
                durationMs={DURATIONS[2]}
                resultColor={revealedColor}
                loopMs={loopMs}
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

        <div className="grid grid-cols-3 gap-2">
          {COLORS.map((c) => (
            <button
              key={c.key}
              disabled={!bettingOpen || hasBetThisRound}
              onClick={() => {
                setSelectedColor(c.key);
                playClick();
              }}
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
              onClick={() => {
                setSelectedChip(v);
                playClick();
              }}
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