// app/storage.js
import React, { useMemo, useState, useEffect } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, ScrollView, Platform } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import ItemRow from "../components/ItemRow";              // your component
import ItemActionModal from "../components/ItemActionModal";
import useInventory from "../store/useInventory";

export default function Storage() {
  const router = useRouter();
  const { type } = useLocalSearchParams(); // "pantry" | "fridge" | "freezer"
  const { pantry, fridge, freezer, consumeItem, deleteItem } = useInventory();

  // Open/collapse per section (defaults)
  const [open, setOpen] = useState({ pantry: true, fridge: true, freezer: true });

  // Open the section the user tapped from Home
  useEffect(() => {
    if (!type) return;
    const t = String(type).toLowerCase();
    setOpen({
      pantry: t === "pantry",
      fridge: t === "fridge",
      freezer: t === "freezer",
    });
  }, [type]);

  const [active, setActive] = useState(null);

  const all = useMemo(() => [...pantry, ...fridge, ...freezer], [pantry, fridge, freezer]);

  const soonPct = useMemo(() => {
    if (!all.length) return 0;
    const soon = all.filter((x) => {
      const d = typeof x.daysLeft === "number" ? x.daysLeft : Number.POSITIVE_INFINITY;
      return d > 0 && d <= 5;
    }).length;
    return Math.round((soon / all.length) * 100);
  }, [all]);

  const Section = ({ title, data, keyName }) => {
    const count = data.length;
    return (
      <View style={{ marginBottom: 10 }}>
        <Pressable
          onPress={() => setOpen((o) => ({ ...o, [keyName]: !o[keyName] }))}
          style={styles.sectionHeader}
        >
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionMeta}>
            {count} {open[keyName] ? "▾" : "▸"}
          </Text>
        </Pressable>
        {open[keyName] ? (
          <FlatList
            data={data}
            keyExtractor={(x) => x.id}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            renderItem={({ item }) => <ItemRow item={item} onPress={() => setActive(item)} />}
            scrollEnabled={false}          // 👈 expand inside parent scroll
            style={{ flexGrow: 0 }}
            removeClippedSubviews={false}
            contentContainerStyle={{ paddingBottom: 4 }}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>No items here yet.</Text>
              </View>
            }
          />
        ) : (
          <View style={{ height: 4 }} />
        )}
      </View>
    );
  };

  return (
    <View style={styles.wrap}>
      <Pressable style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backIcon}>←</Text>
        <Text style={styles.backText}>Home</Text>
      </Pressable>

      <Text style={styles.h1}>Storage</Text>

      <View style={styles.card}>
        <View>
          <Text style={styles.sub}>Expiring soon (≤ 5 days)</Text>
          <Text style={styles.pct}>{soonPct}%</Text>
        </View>
        <View style={styles.allPill}><Text style={styles.allPillText}>{all.length} items total</Text></View>
      </View>

      {/* only sections scroll */}
      <ScrollView style={styles.sectionsScroll} contentContainerStyle={styles.sectionsContent}>
        <Section title="Pantry (shelf)" data={pantry} keyName="pantry" />
        <Section title="Fridge (upper)" data={fridge} keyName="fridge" />
        <Section title="Freezer (bottom)" data={freezer} keyName="freezer" />
      </ScrollView>

      <ItemActionModal
        visible={!!active}
        item={active}
        onClose={() => setActive(null)}
        onConsume={(item, n) => { consumeItem(item.id, n); setActive(null); }}
        onDelete={(item) => { deleteItem(item.id); setActive(null); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // palette aligned with new Home
  // wrap: { flex: 1, padding: 16, backgroundColor: "#F4F6F5" },
  wrap: {
    flex: 1,
    minHeight: 0,                // 👈 allow children to shrink (RN Web)
    padding: 16,
    backgroundColor: "#F4F6F5",
    ...(Platform.OS === "web" ? { overflow: "hidden" } : null), // 👈 prevent window scroll
  },

  h1: { fontSize: 22, fontWeight: "800", marginBottom: 8 },

  // back chip
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

  // overview card
  card: {
    backgroundColor: "#EAF6EE",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  sub: { color: "#2E7D32", fontWeight: "700" },
  pct: { color: "#2E7D32", fontWeight: "800", fontSize: 18 },

  allPill: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#CFE6D5",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  allPillText: { color: "#2E7D32", fontWeight: "700" },

  // section header
  sectionHeader: {
    marginTop: 12,
    marginBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: { fontWeight: "800", fontSize: 16, color: "#0E0E0E" },
  sectionMeta: { color: "#6B7280", fontWeight: "700" },

  sectionsScroll: {
    flex: 1,
    minHeight: 0,                // 👈 critical for nested scroll area
  },
  sectionsContent: { paddingBottom: 32 },

  // inline row (if you don’t use ItemRow)
  rowCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
    flexDirection: "row",
    alignItems: "center",
  },
  itemName: { fontWeight: "800" },
  itemMeta: { color: "#667", marginTop: 4 },

  pill: {
    backgroundColor: "#2E7D32",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillText: { color: "#fff", fontWeight: "800" },

  emptyBox: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E6E8EA",
  },
  emptyText: { color: "#667" },
  scroll: { flex: 1, backgroundColor: "#F4F6F5" },
  scrollContent: { padding: 16, paddingBottom: 32 },
});
