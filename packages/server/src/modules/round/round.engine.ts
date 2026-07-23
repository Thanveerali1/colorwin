import { prisma } from '../../lib/prisma';
import { roundQueue } from './round.queue';

export const BETTING_DURATION_MS = 120_000; // 2 minutes
export const LOCKED_DURATION_MS = 60_000;   // 1 minute
// Brief pause after the round timer hits 00:00 before the next round starts.
// Kept short but non-zero: the result/win popup needs at least a moment on
// screen before 'round:started' resets the UI, otherwise a winning popup can
// get wiped before it's even visible. Set to 0 for an instant restart if
// you're fine with popups sometimes not having time to render.
export const RESULT_DURATION_MS = 1_500;

// How long before the official 3-minute mark the client's reel-landing
// animation needs to start so it finishes landing right as the round timer
// hits 00:00, instead of continuing to spin for several seconds afterward.
// Must stay >= the client's landing-spin animation length (see
// Math.max(DURATIONS) + 100 in GamePage.tsx -- currently ~4000ms) with a
// small buffer. 5s: betting+locked runs 2:55 (175s), the result lands and
// is fully revealed within the final :05 of the 3:00 round.
export const REVEAL_LEAD_MS = 5_000;

const PAYOUT_MULTIPLIER: Record<string, number> = { RED: 2, BLUE: 2, GREEN: 2 };

type BroadcastFn = (event: string, payload: unknown) => void;
let broadcast: BroadcastFn = () => {};
export function setBroadcaster(fn: BroadcastFn) {
  broadcast = fn;
}

// Independent, weighted-random draw. Deliberately has zero access to pool
// totals -- the result cannot be influenced by how much was bet on any color.
// NOTE: Math.random() is NOT cryptographically secure. Fine for play-money;
// swap for crypto.randomInt() + a provably-fair seed-reveal scheme before
// this is ever used for anything with real stakes.
//
// Safe to call as soon as the round is LOCKED -- betting is closed and pool
// totals are final at that point, so computing (and even revealing) the
// result slightly before the official finalize time cannot be gamed.
async function pickResult(roundId: string): Promise<'RED' | 'GREEN' | 'BLUE'> {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    select: { poolRed: true, poolGreen: true, poolBlue: true },
  });

  if (!round) {
    throw new Error('ROUND_NOT_FOUND');
  }

  const pools = [
    { color: 'RED' as const, total: round.poolRed },
    { color: 'GREEN' as const, total: round.poolGreen },
    { color: 'BLUE' as const, total: round.poolBlue },
  ];

  // Lowest total wins
  pools.sort((a, b) => a.total - b.total);
  return pools[0].color;
}

export async function startNewRound() {
  const existing = await prisma.round.findFirst({
    where: { phase: { in: ['BETTING', 'LOCKED'] } },
    orderBy: { startedAt: 'desc' },
  });
  if (existing) {
    console.log(`startNewRound skipped -- round ${existing.id} is already active (${existing.phase}).`);
    return existing;
  }

  const round = await prisma.round.create({ data: { phase: 'BETTING' } });
  // NOTE: BullMQ job IDs cannot contain ':' -- use '-' as the separator.
  await roundQueue.add(
    'lockRound',
    { roundId: round.id },
    { delay: BETTING_DURATION_MS, jobId: `lock-${round.id}` }
  );
  broadcast('round:started', { roundId: round.id, phase: 'BETTING', startedAt: round.startedAt });
  return round;
}

export async function lockRound(roundId: string) {
  const round = await prisma.round.findUnique({ where: { id: roundId } });
  if (!round || round.phase !== 'BETTING') {
    console.log(`lockRound skipped -- round ${roundId} is not in BETTING (found: ${round?.phase ?? 'missing'}).`);
    return round;
  }

  const updated = await prisma.round.update({
    where: { id: roundId },
    data: { phase: 'LOCKED', lockedAt: new Date() },
  });

  // Schedule the early "preview" step (computes + broadcasts the result so
  // the client can start landing the reels ahead of time) rather than
  // jumping straight to the full LOCKED_DURATION_MS delay.
  const previewDelay = Math.max(0, LOCKED_DURATION_MS - REVEAL_LEAD_MS);
  await roundQueue.add(
    'previewResult',
    { roundId },
    { delay: previewDelay, jobId: `preview-${roundId}` }
  );
  broadcast('round:phase_changed', { roundId, phase: 'LOCKED' });
  return updated;
}

/**
 * Fires REVEAL_LEAD_MS before the official end of the LOCKED phase. Computes
 * the result (safe to do now -- pools are final once LOCKED) and broadcasts
 * it via a distinct 'round:landing' event purely so the client can start its
 * reel-landing animation early. Does NOT touch the round's phase, resultAt,
 * or settle any bets -- that stays exactly on schedule in finalizeRound, so
 * the round timer / DB state timing is unaffected. The same pre-computed
 * result is carried forward to finalizeRound so what the client sees land is
 * guaranteed to match what actually gets paid out.
 */
export async function previewResult(roundId: string) {
  const existing = await prisma.round.findUnique({ where: { id: roundId } });
  if (!existing || existing.phase !== 'LOCKED') {
    console.log(`previewResult skipped -- round ${roundId} is not LOCKED (found: ${existing?.phase ?? 'missing'}).`);
    return;
  }

  const result = await pickResult(roundId);
  broadcast('round:landing', { roundId, result });

  await roundQueue.add(
    'finalizeRound',
    { roundId, result },
    { delay: REVEAL_LEAD_MS, jobId: `finalize-${roundId}` }
  );
}

/**
 * The official, authoritative resolution: sets phase=RESULT/resultAt "now"
 * (which is exactly LOCKED_DURATION_MS after lockRound, same timing as
 * before this change) and settles all bets. Uses the result that was already
 * computed and shown to clients in previewResult, rather than re-rolling.
 */
export async function finalizeRound(roundId: string, result: 'RED' | 'GREEN' | 'BLUE') {
  const existing = await prisma.round.findUnique({ where: { id: roundId } });
  if (!existing || existing.phase !== 'LOCKED') {
    console.log(`finalizeRound skipped -- round ${roundId} is not LOCKED (found: ${existing?.phase ?? 'missing'}).`);
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.round.update({
      where: { id: roundId },
      data: { phase: 'RESULT', result, resultAt: new Date() },
    });

    const bets = await tx.bet.findMany({ where: { roundId } });

    for (const bet of bets) {
      const won = bet.color === result;
      const payout = won ? Math.round(bet.amount * PAYOUT_MULTIPLIER[result]) : 0;

      await tx.bet.update({ where: { id: bet.id }, data: { won, payout } });

      if (won) {
        await tx.wallet.update({
          where: { userId: bet.userId },
          data: { balance: { increment: payout } },
        });
        await tx.transaction.create({
          data: { userId: bet.userId, type: 'WIN', amount: payout, betId: bet.id },
        });
      }
    }
  });

  broadcast('round:result', { roundId, result });
  await roundQueue.add(
    'startNextRound',
    { roundId },
    { delay: RESULT_DURATION_MS, jobId: `next-${roundId}` }
  );
}

export async function startNextRound() {
  await startNewRound();
}

/**
 * Self-healing boot check. Rather than just checking "does an active round
 * row exist" (which can be true even if its BullMQ job was lost -- e.g.
 * after a queue flush, a crash, or Redis being cleared), this verifies the
 * round is actually progressing and, if not, catches it up immediately:
 * either (re)scheduling the correct next job with the correct remaining
 * delay, or -- if it's overdue -- advancing it right now.
 *
 * Safe to call on every server boot, always.
 */
export async function ensureRoundProgress() {
  const round = await prisma.round.findFirst({
    where: { phase: { in: ['BETTING', 'LOCKED', 'RESULT'] } },
    orderBy: { startedAt: 'desc' },
  });

  if (!round) {
    console.log('No active round found -- starting a fresh one.');
    await startNewRound();
    return;
  }

  const now = Date.now();

  if (round.phase === 'BETTING') {
    const elapsed = now - round.startedAt.getTime();
    const remaining = BETTING_DURATION_MS - elapsed;
    if (remaining <= 0) {
      console.log(`Round ${round.id} is overdue to lock -- advancing immediately.`);
      await lockRound(round.id);
    } else {
      console.log(`Resuming round ${round.id} (BETTING) -- re-scheduling lock in ${Math.round(remaining / 1000)}s.`);
      await roundQueue.add('lockRound', { roundId: round.id }, { delay: remaining, jobId: `lock-${round.id}` });
    }
    return;
  }

  if (round.phase === 'LOCKED') {
    const lockedAt = round.lockedAt?.getTime() ?? now;
    const elapsed = now - lockedAt;
    const remainingUntilFinalize = LOCKED_DURATION_MS - elapsed;
    const remainingUntilPreview = remainingUntilFinalize - REVEAL_LEAD_MS;

    if (remainingUntilFinalize <= 0) {
      // Recovering after a crash/restart that lost both the preview and
      // finalize jobs -- just resolve immediately with a fresh result.
      // Rare edge case; the animation lead-time is skipped this one time.
      console.log(`Round ${round.id} is overdue to resolve -- resolving immediately.`);
      const result = await pickResult(round.id);
      await finalizeRound(round.id, result);
    } else if (remainingUntilPreview <= 0) {
      // Past the preview point but the finalize job survived (or didn't --
      // either way, recompute+preview now with whatever time is left).
      console.log(`Round ${round.id} is past its preview point -- previewing now.`);
      await previewResult(round.id);
    } else {
      console.log(
        `Resuming round ${round.id} (LOCKED) -- re-scheduling preview in ${Math.round(remainingUntilPreview / 1000)}s.`
      );
      await roundQueue.add(
        'previewResult',
        { roundId: round.id },
        { delay: remainingUntilPreview, jobId: `preview-${round.id}` }
      );
    }
    return;
  }

  if (round.phase === 'RESULT') {
    const resultAt = round.resultAt?.getTime() ?? now;
    const elapsed = now - resultAt;
    const remaining = RESULT_DURATION_MS - elapsed;
    if (remaining <= 0) {
      console.log(`Round ${round.id} is overdue to advance to a new round -- doing so immediately.`);
      await startNextRound();
    } else {
      console.log(`Resuming round ${round.id} (RESULT) -- re-scheduling next round in ${Math.round(remaining / 1000)}s.`);
      await roundQueue.add('startNextRound', { roundId: round.id }, { delay: remaining, jobId: `next-${round.id}` });
    }
  }
}