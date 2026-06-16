// app/notifications.js
import { useEffect, useMemo } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Pressable } from "react-native";
import { useRouter } from "expo-router";                 // ✅ add this
import useInventory from "../store/useInventory";
import { useNotifications } from "../store/useNotifications";

const stageOf = (d) => {
  if (d <= 0) return "expired";
  if (d === 1) return "tomorrow";
  if (d <= 3) return "soon";
  if (d <= 7) return "notice";
  return "none";
};

const shouldShow = (item, notifState) => {
  const stage = stageOf(item.daysLeft ?? 9999);
  if (stage === "none") return { show: false };
  const k = `${item.id}:${stage}`;
  const st = notifState[k];
  if (!st) return { show: true, stage };
  if (st.dismissed) return { show: false, stage };
  if (st.snoozeUntil && Date.now() < st.snoozeUntil) return { show: false, stage };
  return { show: true, stage };
};

export default function Notifications() {
  const router = useRouter();                             // ✅ create router
  const { pantry, fridge, freezer, hash } = useInventory();
  const { state, remain, finish } = useNotifications();

  const items = useMemo(() => [...pantry, ...fridge, ...freezer], [pantry, fridge, freezer]);

  const rows = useMemo(() => {
    return items
      .map((it) => {
        const stage = stageOf(it.daysLeft ?? 9999);
        const vis = shouldShow(it, state);
        if (!vis.show) return null;

        const title =
          stage === "expired" ? `${it.name} has expired` :
            stage === "tomorrow" ? `${it.name} will expire tomorrow` :
              stage === "soon" ? `${it.name} expires in ${it.daysLeft} days` :
                stage === "notice" ? `${it.name} expires in ${it.daysLeft} days` :
                  null;

        return title ? { id: `${it.id}:${stage}`, itemId: it.id, stage, title, time: "Today" } : null;
      })
      .filter(Boolean);
  }, [items, state, hash]);

  const renderItem = ({ item }) => (
    <View style={styles.item}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.time}>{item.time}</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={[styles.actionBtn, styles.remain]} onPress={() => remain(item.itemId, item.stage)}>
          <Text style={styles.actionText}>Remain</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.finished]} onPress={() => finish(item.itemId, item.stage)}>
          <Text style={styles.actionText}>Finished</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.wrap}>
      {/* Back button */}
      <Pressable style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backIcon}>←</Text>
        <Text style={styles.backText}>Home</Text>
      </Pressable>

      <Text style={styles.h1}>Notifications</Text>

      <FlatList
        data={rows}
        keyExtractor={(x) => x.id}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={{ color: "#666", marginTop: 12 }}>No notifications 🎉</Text>}
        contentContainerStyle={{ paddingBottom: 16 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, backgroundColor: "#F7F8F7" },

  // header + back
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#e0e0e0",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  backIcon: { fontSize: 16, marginRight: 6, color: "#333", fontWeight: "bold" },
  backText: { fontSize: 15, fontWeight: "600", color: "#333" },

  h1: { fontSize: 22, fontWeight: "800", marginBottom: 8 },

  // list rows
  item: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  title: { fontWeight: "700" },
  time: { color: "#666", marginTop: 4 },

  actions: { flexDirection: "row", marginLeft: 10 },
  actionBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, marginLeft: 6 },
  remain: { backgroundColor: "#4a90e2" },
  finished: { backgroundColor: "#50c878" },
  actionText: { color: "#fff", fontWeight: "600" },
});
