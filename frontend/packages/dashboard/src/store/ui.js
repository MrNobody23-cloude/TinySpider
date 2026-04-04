import { create } from 'zustand';

export const useBotStore = create((set) => ({
    showBots: false,
    toggleBots: () => set((state) => ({ showBots: !state.showBots })),
    setShowBots: (showBots) => set({ showBots })
}));
