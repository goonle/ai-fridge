import { TouchableOpacity, Text, StyleSheet } from "react-native";

export default function Chip({ label, active, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, active && styles.active]}
      activeOpacity={0.8}
    >
      <Text style={[styles.text, active && styles.textActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1, borderColor: "#E6E8EA",
  },
  active: { backgroundColor: "#2E7D32", borderColor: "#2E7D32" },
  text: { fontWeight: "700" },
  textActive: { color: "#fff" },
});
