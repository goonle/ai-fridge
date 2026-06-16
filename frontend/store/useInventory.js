// useInventory.js
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

const initial = {
  pantry: [
    { id: "p1", name: "Pasta", qty: 1, daysLeft: 30 },
    { id: "p2", name: "Canned Beans", qty: 3, daysLeft: 120 },
  ],
  fridge: [
    { id: "f1", name: "Tomato", qty: 2, daysLeft: 3 },
    { id: "f2", name: "Lettuce", qty: 1, daysLeft: 5 },
    { id: "f3", name: "Milk", qty: 1, daysLeft: 7 },
  ],
  freezer: [
    { id: "z1", name: "Beef", qty: 1, daysLeft: 45 },
    { id: "z2", name: "Frozen Veg", qty: 2, daysLeft: 60 },
  ],
};

const nowISO = () => new Date().toISOString();

const clampNonNeg = (n) => Math.max(0, n);

const sumQty = (list) => list.reduce((acc, x) => acc + (x.qty || 0), 0);
const sumAllQty = (s) =>
  sumQty(s.pantry) + sumQty(s.fridge) + sumQty(s.freezer);

// helpers
const mapDec = (list, id, count) =>
  list
    .map((x) =>
      x.id === id ? { ...x, qty: clampNonNeg((x.qty || 0) - count) } : x,
    )
    .filter((x) => (x.qty || 0) > 0);

const mapRm = (list, id) => list.filter((x) => x.id !== id);

const findItemSnapshot = (s, id) => {
  const all = [...s.pantry, ...s.fridge, ...s.freezer];
  return all.find((x) => x.id === id);
};

const monthKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const atRisk = (items, threshold) =>
  items.filter((x) => (x.daysLeft ?? 0) <= threshold);

// MAIN STORE
const useInventory = create(
  persist(
    (set, get) => ({
      ...initial,
      hash: 0,
      history: [
        // { id, action: "added"|"consumed"|"discarded"|"deleted", qty, ts, month, itemSnapshot }
      ],
      atRiskThreshold: 3,

      addItems: (arr) =>
        set((s) => {
          const byLoc = { pantry: [], fridge: [], freezer: [] };
          arr.forEach((it) => byLoc[it.storage || "fridge"]?.push(it));
          const events = arr.map((it) => ({
            id: it.id,
            action: "added",
            qty: it.qty || 1,
            ts: nowISO(),
            month: monthKey(),
            itemSnapshot: { ...it },
          }));
          return {
            pantry: [...s.pantry, ...byLoc.pantry],
            fridge: [...s.fridge, ...byLoc.fridge],
            freezer: [...s.freezer, ...byLoc.freezer],
            history: [...s.history, ...events],
            hash: s.hash + 1,
          };
        }),

      consumeItem: (id, count = 1) =>
        set((s) => {
          const snap = findItemSnapshot(s, id);
          if (!snap) return s;
          const qty = Math.min(count, snap.qty || 0);
          const next = {
            pantry: mapDec(s.pantry, id, qty),
            fridge: mapDec(s.fridge, id, qty),
            freezer: mapDec(s.freezer, id, qty),
          };
          return {
            ...next,
            history: [
              ...s.history,
              {
                id,
                action: "consumed",
                qty,
                ts: nowISO(),
                month: monthKey(),
                itemSnapshot: { ...snap },
              },
            ],
            hash: s.hash + 1,
          };
        }),

      discardItem: (id, count = 1) =>
        set((s) => {
          const snap = findItemSnapshot(s, id);
          if (!snap) return s;
          const qty = Math.min(count, snap.qty || 0);
          const next = {
            pantry: mapDec(s.pantry, id, qty),
            fridge: mapDec(s.fridge, id, qty),
            freezer: mapDec(s.freezer, id, qty),
          };
          return {
            ...next,
            history: [
              ...s.history,
              {
                id,
                action: "discarded",
                qty,
                ts: nowISO(),
                month: monthKey(),
                itemSnapshot: { ...snap },
              },
            ],
            hash: s.hash + 1,
          };
        }),

      // hard remove (rare)
      deleteItem: (id) =>
        set((s) => {
          const snap = findItemSnapshot(s, id);
          const next = {
            pantry: mapRm(s.pantry, id),
            fridge: mapRm(s.fridge, id),
            freezer: mapRm(s.freezer, id),
          };
          return {
            ...next,
            history: [
              ...s.history,
              {
                id,
                action: "deleted",
                qty: snap?.qty ?? 0,
                ts: nowISO(),
                month: monthKey(),
                itemSnapshot: snap ? { ...snap } : null,
              },
            ],
            hash: s.hash + 1,
          };
        }),

      // Derived stats for current month
      getMonthlyStats: () => {
        const s = get();
        const m = monthKey();
        const consumed = s.history.filter(
          (e) => e.month === m && e.action === "consumed",
        );
        const discarded = s.history.filter(
          (e) => e.month === m && e.action === "discarded",
        );

        const usedItems = consumed.reduce((a, e) => a + (e.qty || 0), 0);
        const discardedItems = discarded.reduce((a, e) => a + (e.qty || 0), 0);

        // Target: all items you *attempt* to manage this month
        // You can define it differently; here we include consumed + discarded + currently at-risk.
        const allNow = [...s.pantry, ...s.fridge, ...s.freezer];
        const atRiskNow = atRisk(allNow, s.atRiskThreshold);
        const atRiskQty = atRiskNow.reduce((a, x) => a + (x.qty || 0), 0);

        const targetItems = usedItems + discardedItems + atRiskQty;

        return {
          usedItems,
          discardedItems,
          atRiskNowQty: atRiskQty,
          targetItems,
          percent: targetItems > 0 ? usedItems / targetItems : 0,
          totalInInventory: sumAllQty(s),
        };
      },
    }),
    {
      name: "inventory-storage", // 저장소 키 이름
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export default useInventory;
