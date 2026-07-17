import { prisma } from '../../lib/prisma';

type HistoryFilter = 'all' | 'bets' | 'deposits' | 'withdrawals';

export async function getTransactionHistory(userId: string, filter: HistoryFilter) {
  const typeMap: Record<Exclude<HistoryFilter, 'all'>, string[]> = {
    bets: ['BET', 'BET_CANCELLED', 'WIN'],
    deposits: ['DEPOSIT'],
    withdrawals: ['WITHDRAW'],
  };

  const where =
    filter === 'all'
      ? { userId }
      : { userId, type: { in: typeMap[filter] as any } };

  return prisma.transaction.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      bet: {
        select: { color: true, roundId: true },
      },
    },
  });
}
