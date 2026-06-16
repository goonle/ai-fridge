import { View, Text, StyleSheet, Pressable } from "react-native";

const colorByDays = (d) =>
  d <= 0 ? "#E53935" : d <= 2 ? "#EF6C00" : d <= 7 ? "#c4c724ff" : "#2E7D32";

export default function ItemRow({ item, onPress }) {
  return (
    <Pressable onPress={() => onPress?.(item)} style={styles.row}>
      {/* left side */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={[styles.dot, { backgroundColor: colorByDays(item.daysLeft) }]} />
        <Text style={styles.name}>{item.name}</Text>
      </View>

      {/* right side */}
      <View style={[styles.badge, { backgroundColor: colorByDays(item.daysLeft) }]}>
        <Text style={{ color: "#fff", fontWeight: "800" }}>
          {item.daysLeft <= 0 ? "Expired" : `${item.daysLeft}d`}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,

    // 👇 make left + right in one line
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dot: { width: 8, height: 8, borderRadius: 999 },
  name: { fontSize: 15, fontWeight: "700" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
});
