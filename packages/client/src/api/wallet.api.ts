import { api } from './axios';

export interface Wallet {
  id: string;
  balance: number;
  userId: string;
}

export async function getWallet() {
  const res = await api.get<Wallet>('/wallet/me');
  return res.data;
}

export async function depositRequest(amount: number) {
  const res = await api.post<Wallet>('/wallet/deposit', { amount });
  return res.data;
}

export async function withdrawRequest(amount: number) {
  const res = await api.post<Wallet>('/wallet/withdraw', { amount });
  return res.data;
}
