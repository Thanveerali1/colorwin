import { api } from './axios';

export interface Transaction {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAW' | 'BET' | 'BET_CANCELLED' | 'WIN';
  amount: number;
  createdAt: string;
  bet?: { color: 'RED' | 'BLUE' | 'GREEN'; roundId: string } | null;
}

export type HistoryFilter = 'all' | 'bets' | 'deposits' | 'withdrawals';

export async function getTransactions(filter: HistoryFilter = 'all') {
  const res = await api.get<Transaction[]>('/transactions', { params: { filter } });
  return res.data;
}