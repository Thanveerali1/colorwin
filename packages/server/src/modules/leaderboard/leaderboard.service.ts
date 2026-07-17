import { prisma } from '../../lib/prisma';

export async function getTopWinners(limit = 100) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const grouped = await prisma.transaction.groupBy({
    by: ['userId'],
    where: { type: 'WIN', createdAt: { gte: since } },
    _sum: { amount: true },
    orderBy: { _sum: { amount: 'desc' } },
    take: limit,
  });

  const userIds = grouped.map((g) => g.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });
  const nameMap = new Map(users.map((u) => [u.id, u.name]));

  return grouped.map((g, i) => ({
    rank: i + 1,
    userId: g.userId,
    name: nameMap.get(g.userId) || 'Player',
    totalWon: g._sum.amount || 0,
  }));
}
