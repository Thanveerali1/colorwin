// Computes exact tick times for the reel's final landing spin by solving the
// same cubic-bezier curve used in its CSS transition (see GamePage.tsx's
// ReelColumn: `cubic-bezier(0.12,0.85,0.15,1)`). Rather than ticking at a
// fixed interval, this finds the real time at which the animated position
// crosses each block-height boundary, so the tick rate naturally matches the
// visual deceleration -- fast at the start, spreading out as it lands.

const BEZIER_X1 = 0.12;
const BEZIER_Y1 = 0.85;
const BEZIER_X2 = 0.15;
const BEZIER_Y2 = 1;

function bezierY(t: number, y1: number, y2: number): number {
  const mt = 1 - t;
  return 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t;
}

function bezierX(t: number, x1: number, x2: number): number {
  const mt = 1 - t;
  return 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t;
}

function bezierYDerivative(t: number, y1: number, y2: number): number {
  const mt = 1 - t;
  return 3 * mt * mt * y1 + 6 * mt * t * (y2 - y1) + 3 * t * t * (1 - y2);
}

/** Solves for the bezier parameter t at which progress (y) reaches targetY. */
function solveTForY(targetY: number, y1: number, y2: number): number {
  let t = targetY; // reasonable initial guess
  for (let i = 0; i < 8; i++) {
    const y = bezierY(t, y1, y2) - targetY;
    const dy = bezierYDerivative(t, y1, y2);
    if (Math.abs(dy) < 1e-6) break;
    t -= y / dy;
    t = Math.min(1, Math.max(0, t));
  }
  return t;
}

/**
 * Schedules a tick callback at the exact moment the reel's animated position
 * crosses each block-height boundary, given the same distance/duration used
 * for the CSS transition. Returns timeout IDs so callers can cancel them if
 * needed (e.g. a new round starts before the spin finishes).
 */
export function scheduleTicksForSpin(
  distancePx: number,
  durationMs: number,
  blockHeightPx: number,
  onTick: () => void
): number[] {
  const totalBlocks = Math.floor(distancePx / blockHeightPx);
  const ids: number[] = [];

  for (let k = 1; k <= totalBlocks; k++) {
    const targetY = (k * blockHeightPx) / distancePx;
    if (targetY >= 1) continue;

    const t = solveTForY(targetY, BEZIER_Y1, BEZIER_Y2);
    const xFraction = bezierX(t, BEZIER_X1, BEZIER_X2);
    const timeMs = xFraction * durationMs;

    const id = window.setTimeout(onTick, Math.max(0, timeMs));
    ids.push(id);
  }

  return ids;
}

export function clearScheduledTicks(ids: number[]) {
  ids.forEach((id) => window.clearTimeout(id));
}