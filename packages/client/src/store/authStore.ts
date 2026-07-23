import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { resetAnalyticsIdentity } from '../lib/analytics';

interface User {
  name: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  setAuth: (accessToken: string, refreshToken: string, user: User) => void;
  setAccessToken: (accessToken: string) => void;
  updateUser: (patch: Partial<User>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setAuth: (accessToken, refreshToken, user) => set({ accessToken, refreshToken, user }),
      setAccessToken: (accessToken) => set({ accessToken }),
      updateUser: (patch) => set((state) => ({ user: state.user ? { ...state.user, ...patch } : state.user })),
      logout: () => {
        resetAnalyticsIdentity();
        set({ accessToken: null, refreshToken: null, user: null });
      },
    }),
    { name: 'colorwin-auth' }
  )
);