import { create } from 'zustand';
import { getWallet } from '../api/wallet.api';

interface WalletState {
  balance: number | null;
  fetchBalance: () => Promise<void>;
  setBalance: (balance: number) => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  balance: null,
  fetchBalance: async () => {
    try {
      const wallet = await getWallet();
      set({ balance: wallet.balance });
    } catch {
      set({ balance: null });
    }
  },
  setBalance: (balance) => set({ balance }),
}));