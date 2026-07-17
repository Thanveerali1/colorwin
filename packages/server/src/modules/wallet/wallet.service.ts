import { prisma } from '../../lib/prisma';

export async function getWallet(userId: string) {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) throw new Error('WALLET_NOT_FOUND');
  return wallet;
}

export async function deposit(userId: string, amount: number) {
  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.update({
      where: { userId },
      data: { balance: { increment: amount } },
    });

    await tx.transaction.create({
      data: { userId, type: 'DEPOSIT', amount },
    });

    return wallet;
  });
}

export async function withdraw(userId: string, amount: number) {
  return prisma.$transaction(async (tx) => {
    // Atomic conditional update: only succeeds if balance >= amount.
    // Closes the race-condition window -- no separate "read balance" step
    // for two concurrent requests to both pass.
    const result = await tx.wallet.updateMany({
      where: { userId, balance: { gte: amount } },
      data: { balance: { decrement: amount } },
    });

    if (result.count === 0) {
      throw new Error('INSUFFICIENT_FUNDS');
    }

    await tx.transaction.create({
      data: { userId, type: 'WITHDRAW', amount },
    });

    return tx.wallet.findUniqueOrThrow({ where: { userId } });
  });
}
