// app/index.js
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import {
  MaterialCommunityIcons,
  MaterialIcons,
  Ionicons,
} from "@expo/vector-icons";
import SavingsGauge from "../components/SavingsGauge"; // your component
import useInventory from "../store/useInventory";

export default function HomeScreen() {
  const router = useRouter();
  const { consumeItem } = useInventory();

  // 👇 Home-only hide state (id -> true)
  const [hidden, setHidden] = useState({});
  const { saved, baseline } = useMemo(
    () => ({ saved: 38.5, baseline: 150 }),
    [],
  );

  const hideOnce = (id) => setHidden((h) => ({ ...h, [id]: true }));

  // Example data – replace with your real expiring items
  const { pantry, fridge, freezer } = useInventory();

  const upcoming = useMemo(() => {
    return [...pantry, ...fridge, ...freezer]
      .filter((it) => it.daysLeft <= 7)
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [pantry, fridge, freezer]);

  // Only show items not hidden on this page
  const visibleUpcoming = useMemo(
    () => upcoming.filter((it) => !hidden[it.id]),
    [upcoming, hidden],
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#F4F6F5" }}
      contentContainerStyle={styles.wrap}
    >
      {/* Top bar: logo + avatar */}
      <View style={styles.topBar}>
        <View style={styles.brandWrap}>
          <Image
            source={require("../assets/logo.png")}
            style={styles.logo}
            resizeMode="contain"
            accessible
            accessibilityLabel="K.AI logo"
          />
        </View>
        <TouchableOpacity
          onPress={() => router.push("profile")}
          style={styles.avatar}
        >
          <MaterialCommunityIcons
            name="account-circle"
            size={28}
            color="#0E0E0E"
          />
        </TouchableOpacity>
      </View>

      {/* Savings Gauge (NEW) */}
      {/* <SavingsGauge
        saved={saved}
        baseline={baseline}
        // onPress={() => router.push("insights")} // e.g., route to savings dashboard
      /> */}

      {/* Primary CTA */}
      <TouchableOpacity
        style={styles.primaryCTA}
        activeOpacity={0.9}
        onPress={() =>
          router.push({ pathname: "camera", params: { type: "receipt" } })
        }
      >
        <View style={styles.cameraBadge}>
          <MaterialIcons name="photo-camera" size={22} color="#fff" />
        </View>
        <Text style={styles.primaryText}>Scan Receipt</Text>
      </TouchableOpacity>

      <View style={styles.separator} />

      {/* Upcoming Expiries */}
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => router.push("notifications")}
        activeOpacity={0.7}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <MaterialCommunityIcons
            name="bell-outline"
            size={18}
            color="#0E0E0E"
          />
          <Text style={styles.sectionTitle}>Upcoming Expiries</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#0E0E0E" />
      </TouchableOpacity>

      <View style={{ gap: 10 }}>
        {visibleUpcoming.map((it) => (
          <View key={it.id} style={styles.expiryRow}>
            <MaterialCommunityIcons
              name={it.icon}
              size={20}
              color="#0E0E0E"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.expiryName}>{it.name}</Text>

            <Text style={[styles.expiryDays, { color: it.color }]}>
              {it.days} {it.days === 1 ? "day" : "days"}
            </Text>

            <View style={{ flexDirection: "row", gap: 10, marginLeft: 8 }}>
              {/* X — hide only on Home */}
              <TouchableOpacity
                style={styles.iconPill}
                onPress={() => hideOnce(it.id)}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={16}
                  color="#0E0E0E"
                />
              </TouchableOpacity>

              {/* ✓ — also hide only on Home (no global state) need to change it */}
              <TouchableOpacity
                style={styles.iconPill}
                onPress={() => {
                  hideOnce(it.id);
                  consumeItem(it.id);
                }}
              >
                <MaterialCommunityIcons
                  name="check"
                  size={16}
                  color="#0E0E0E"
                />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.separator} />

      {/* Manage Your Food */}
      <View style={styles.sectionHeaderStatic}>
        <Text style={styles.sectionTitle}>Manage Your Food</Text>
        <MaterialCommunityIcons
          name="silverware-fork-knife"
          size={16}
          color="#0E0E0E"
        />
      </View>
      <View style={styles.grid}>
        <Tile
          title="Pantry"
          icon="archive-outline"
          onPress={() =>
            router.push({ pathname: "storage", params: { type: "pantry" } })
          }
        />
        <Tile
          title="Fridge"
          icon="fridge-outline"
          onPress={() =>
            router.push({ pathname: "storage", params: { type: "fridge" } })
          }
        />
      </View>

      <View style={styles.separator} />

      {/* Tools */}
      <View style={styles.sectionHeaderStatic}>
        <Text style={styles.sectionTitle}>Tools</Text>
      </View>
      <View style={styles.grid}>
        <Tile
          title="Recipes"
          icon="book-outline"
          onPress={() => router.push("recipes")}
        />
        <Tile
          title="AI Advice"
          icon="robot-outline"
          onPress={() =>
            router.push({ pathname: "camera", params: { type: "food" } })
          }
        />
      </View>
    </ScrollView>
  );
}

function Tile({ title, icon, onPress }) {
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={onPress}
    >
      <MaterialCommunityIcons name={icon} size={34} color="#111" />
      <Text style={styles.cardLabel}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 32 },

  // single topBar definition
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  brandWrap: { flexShrink: 1 },
  logo: { width: 140, height: 50 },

  avatar: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    alignSelf: "flex-start",
    marginTop: 2,
  },

  primaryCTA: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#10A37F",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    marginBottom: 16,
  },
  cameraBadge: {
    backgroundColor: "#0E8066",
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  primaryText: { fontSize: 16, fontWeight: "800", color: "#fff" },

  separator: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 12 },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionHeaderStatic: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: {
    marginLeft: 6,
    fontWeight: "800",
    fontSize: 14,
    color: "#0E0E0E",
  },

  expiryRow: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  expiryName: { flex: 1, fontWeight: "700", color: "#111" },
  expiryDays: { fontWeight: "800" },
  iconPill: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  card: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: "center",
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  cardLabel: { marginTop: 8, fontWeight: "700", color: "#111" },
});
