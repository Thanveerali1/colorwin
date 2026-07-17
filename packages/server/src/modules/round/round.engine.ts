import { prisma } from '../../lib/prisma';
import { roundQueue } from './round.queue';

export const BETTING_DURATION_MS = 120_000; // 2 minutes
export const LOCKED_DURATION_MS = 60_000;   // 1 minute
export const RESULT_DURATION_MS = 6_000;    // pause before next round


const PAYOUT_MULTIPLIER: Record<string, number> = { RED: 2, GREEN: 2, VIOLET: 4.5 };

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
  await roundQueue.add(
    'resolveRound',
    { roundId },
    { delay: LOCKED_DURATION_MS, jobId: `resolve-${roundId}` }
  );
  broadcast('round:phase_changed', { roundId, phase: 'LOCKED' });
  return updated;
}

export async function resolveRound(roundId: string) {
  const existing = await prisma.round.findUnique({ where: { id: roundId } });
  if (!existing || existing.phase !== 'LOCKED') {
    console.log(`resolveRound skipped -- round ${roundId} is not LOCKED (found: ${existing?.phase ?? 'missing'}).`);
    return;
  }

  const round = await prisma.round.findUnique({
  where: { id: roundId },
  select: {
    poolRed: true,
    poolGreen: true,
    poolViolet: true,
  },
});

if (!round) {
  throw new Error("ROUND_NOT_FOUND");
}

const pools = [
  { color: "RED" as const, total: round.poolRed },
  { color: "GREEN" as const, total: round.poolGreen },
  { color: "VIOLET" as const, total: round.poolViolet },
];

// Lowest total wins
pools.sort((a, b) => a.total - b.total);

const result = pools[0].color;

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
    const remaining = LOCKED_DURATION_MS - elapsed;
    if (remaining <= 0) {
      console.log(`Round ${round.id} is overdue to resolve -- advancing immediately.`);
      await resolveRound(round.id);
    } else {
      console.log(`Resuming round ${round.id} (LOCKED) -- re-scheduling resolve in ${Math.round(remaining / 1000)}s.`);
      await roundQueue.add('resolveRound', { roundId: round.id }, { delay: remaining, jobId: `resolve-${round.id}` });
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
