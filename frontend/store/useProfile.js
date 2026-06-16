import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

const initial = {
  age: null,
  height: null,
  weight: null,
  goals: [],
  allergies: [],
  conditions: [],
};

const createProfileStore = () =>
  persist(
    create((set, get) => ({
      ...initial,
      saveProfile: (partial) => set((s) => ({ ...s, ...partial })),
      resetProfile: () => set(initial),
    })),
    {
      name: "profile-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  );

// ensure single instance across Fast Refresh
const useProfile = globalThis.__profileStore || createProfileStore();
if (!globalThis.__profileStore) globalThis.__profileStore = useProfile;

export default useProfile;
