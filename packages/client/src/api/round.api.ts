import { api } from './axios';

export type RoundPhase = 'BETTING' | 'LOCKED' | 'RESULT';
export type Color = 'RED' | 'GREEN' | 'VIOLET';

export interface Round {
  id: string;
  phase: RoundPhase;
  result: Color | null;
  poolRed: number;
  poolGreen: number;
  poolViolet: number;
  startedAt: string;
  lockedAt: string | null;
  resultAt: string | null;
}

export interface RoundHistoryEntry {
  id: string;
  result: Color;
  startedAt: string;
  resultAt: string | null;
  poolRed: number;
  poolGreen: number;
  poolViolet: number;
}

export interface Bet {
  id: string;
  color: Color;
  amount: number;
  won: boolean | null;
  payout: number | null;
  roundId: string;
}

export async function getActiveRound() {
  const res = await api.get<Round>('/round/active');
  return res.data;
}

export async function getRoundHistoryRequest() {
  const res = await api.get<RoundHistoryEntry[]>('/round/history');
  return res.data;
}

export async function placeBetRequest(color: Color, amount: number) {
  const res = await api.post<Bet>('/round/bet', { color, amount });
  return res.data;
}

export async function cancelBetRequest(betId: string) {
  const res = await api.delete(`/round/bet/${betId}`);
  return res.data;
}
export async function getMyBetRequest() {
  const res = await api.get<Bet | null>('/round/my-bet');
  return res.data;
}