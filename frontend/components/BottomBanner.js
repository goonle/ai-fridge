import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function BottomBanner() {
  return (
    <View style={styles.container}>
      <View style={styles.mockAd}>
        <Text style={styles.label}>Test Ad • 320×50</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E7EB",
    backgroundColor: "#fff",
    paddingTop: 4,
  },
  mockAd: {
    height: 50,
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
  },
  label: { color: "#6B7280", fontWeight: "700" },
});
