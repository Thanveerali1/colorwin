import { api } from './axios';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  totalWon: number;
}

export async function getLeaderboard() {
  const res = await api.get<LeaderboardEntry[]>('/leaderboard');
  return res.data;
}
