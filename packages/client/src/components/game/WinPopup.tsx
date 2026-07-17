import { useEffect, useState } from 'react';
import type { Color } from '../../api/round.api';

interface WinPopupProps {
  amount: number;
  color: Color;
  onClose: () => void;
}

const COLOR_STYLES: Record<Color, { bg: string; border: string; glow: string }> = {
  RED: { bg: 'bg-red-500', border: 'border-red-500', glow: 'shadow-red-500/50' },
  GREEN: { bg: 'bg-emerald-500', border: 'border-emerald-500', glow: 'shadow-emerald-500/50' },
  VIOLET: { bg: 'bg-violet-500', border: 'border-violet-500', glow: 'shadow-violet-500/50' },
};

const CONFETTI_COLORS = ['#FFC247', '#FF3B5C', '#00D98B', '#B24BF3', '#ffffff'];

function ConfettiPiece({ index }: { index: number }) {
  const left = Math.random() * 100;
  const delay = Math.random() * 0.4;
  const duration = 1.2 + Math.random() * 0.8;
  const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length];
  const size = 6 + Math.random() * 6;

  return (
    <span
      className="absolute top-0 animate-confetti"
      style={{
        left: `${left}%`,
        width: size,
        height: size * 0.4,
        backgroundColor: color,
        animationDelay: `${delay}s`,
        animationDuration: `${duration}s`,
        borderRadius: 2,
      }}
    />
  );
}

export default function WinPopup({ amount, color, onClose }: WinPopupProps) {
  const [visible, setVisible] = useState(true);
  const style = COLOR_STYLES[color];

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }, 4500);
    return () => clearTimeout(timer);
  }, [onClose]);

  function handleDismiss() {
    setVisible(false);
    setTimeout(onClose, 300);
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={handleDismiss}
    >
      <div
        className={`relative overflow-hidden bg-slate-900 border-2 ${style.border} rounded-3xl px-8 py-10 text-center max-w-xs w-[85%] shadow-2xl ${style.glow} animate-pop-in`}
        onClick={(e) => e.stopPropagation()}
      >
        {Array.from({ length: 24 }).map((_, i) => (
          <ConfettiPiece key={i} index={i} />
        ))}

        <div className={`w-16 h-16 rounded-full ${style.bg} mx-auto mb-4 flex items-center justify-center text-3xl`}>
          🏆
        </div>

        <p className="text-slate-400 text-sm font-semibold uppercase tracking-wide mb-1">
          You won on {color}!
        </p>
        <p className="font-mono text-4xl font-extrabold text-amber-400 mb-1">
          +🪙{amount.toLocaleString()}
        </p>
        <p className="text-slate-500 text-xs mb-6">Added to your wallet</p>

        <button
          onClick={handleDismiss}
          className="bg-amber-400 text-slate-900 font-bold px-6 py-2 rounded-full text-sm"
        >
          Nice!
        </button>
      </div>
    </div>
  );
}
