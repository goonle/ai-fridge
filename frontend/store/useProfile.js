import { create } from "zustand";

const initial = {
  age: null,
  height: null,
  weight: null,
  goals: [],
  allergies: [],
  conditions: [],
};

const createProfileStore = () =>
  create((set, get) => ({
    ...initial,
    saveProfile: (partial) => set((s) => ({ ...s, ...partial })),
    resetProfile: () => set(initial),
  }));

// ensure single instance across Fast Refresh
const useProfile = globalThis.__profileStore || createProfileStore();
if (!globalThis.__profileStore) globalThis.__profileStore = useProfile;

export default useProfile;