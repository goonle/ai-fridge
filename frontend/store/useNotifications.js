// store/useNotifications.js
import { create } from "zustand";
const key = (itemId, stage) => `${itemId}:${stage}`;

export const useNotifications = create((set, get) => ({
  // id -> { snoozeUntil: number|null, dismissed: boolean }
  state: {},

  remain: (itemId, stage, ms = 24*60*60*1000) => set((s) => ({
    state: {
      ...s.state,
      [key(itemId, stage)]: { ...(s.state[key(itemId, stage)] || {}), snoozeUntil: Date.now() + ms, dismissed: false },
    },
  })),

  finish: (itemId, stage) => set((s) => ({
    state: { ...s.state, [key(itemId, stage)]: { snoozeUntil: null, dismissed: true } },
  })),

  resetForItem: (itemId) => set((s) => {
    const next = { ...s.state };
    Object.keys(next).forEach(k => { if (k.startsWith(itemId + ":")) delete next[k]; });
    return { state: next };
  }),
}));
