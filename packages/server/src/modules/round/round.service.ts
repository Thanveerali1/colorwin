import { prisma } from '../../lib/prisma';
import type { PlaceBetInput } from './round.schema';

export async function getActiveRound() {
  return prisma.round.findFirst({
    where: { phase: { in: ['BETTING', 'LOCKED', 'RESULT'] } },
    orderBy: { startedAt: 'desc' },
  });
}

export async function getRoundHistory(limit = 100) {
  return prisma.round.findMany({
    where: { phase: 'RESULT' },
    orderBy: { startedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      result: true,
      startedAt: true,
      resultAt: true,
      poolRed: true,
      poolBlue: true,
      poolGreen: true,
    },
  });
}

export async function getMyBetForRound(userId: string, roundId: string) {
  return prisma.bet.findFirst({ where: { userId, roundId } });
}

export async function placeBet(userId: string, input: PlaceBetInput) {
  const round = await getActiveRound();
  if (!round || round.phase !== 'BETTING') {
    throw new Error('BETTING_CLOSED');
  }

  // One bet per user per round.
  const existingBet = await prisma.bet.findFirst({
    where: { userId, roundId: round.id },
  });
  if (existingBet) {
    throw new Error('BET_ALREADY_PLACED');
  }

  return prisma.$transaction(async (tx) => {
    const walletUpdate = await tx.wallet.updateMany({
      where: { userId, balance: { gte: input.amount } },
      data: { balance: { decrement: input.amount } },
    });

    if (walletUpdate.count === 0) {
      throw new Error('INSUFFICIENT_FUNDS');
    }

    const bet = await tx.bet.create({
      data: { userId, roundId: round.id, color: input.color, amount: input.amount },
    });

    await tx.transaction.create({
      data: { userId, type: 'BET', amount: input.amount, betId: bet.id },
    });

    const poolField =
      input.color === 'RED' ? 'poolRed' : input.color === 'BLUE' ? 'poolBlue' : 'poolGreen';

    await tx.round.update({
      where: { id: round.id },
      data: { [poolField]: { increment: input.amount } },
    });

    return bet;
  });
}

export async function cancelBet(userId: string, betId: string) {
  return prisma.$transaction(async (tx) => {
    const bet = await tx.bet.findUnique({ where: { id: betId } });
    if (!bet || bet.userId !== userId) {
      throw new Error('BET_NOT_FOUND');
    }

    const round = await tx.round.findUnique({ where: { id: bet.roundId } });
    if (!round || round.phase !== 'BETTING') {
      throw new Error('CANCEL_WINDOW_CLOSED');
    }

    await tx.wallet.update({
      where: { userId },
      data: { balance: { increment: bet.amount } },
    });

    await tx.transaction.create({
      data: { userId, type: 'BET_CANCELLED', amount: bet.amount },
    });

    const poolField =
      bet.color === 'RED' ? 'poolRed' : bet.color === 'BLUE' ? 'poolBlue' : 'poolGreen';

    await tx.round.update({
      where: { id: bet.roundId },
      data: { [poolField]: { decrement: bet.amount } },
    });

    await tx.bet.delete({ where: { id: betId } });

    return { refunded: bet.amount };
  });
}