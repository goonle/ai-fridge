import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from "react-native";

export default function SavingsGauge({ saved = 38.5, baseline = 150, onPress }) {
  const pct = Math.max(0, Math.min(1, baseline > 0 ? saved / baseline : 0));
  const anim = useRef(new Animated.Value(0)).current;
  const [barWidth, setBarWidth] = useState(0); // measure actual px width

  useEffect(() => {
    Animated.timing(anim, {
      toValue: pct,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // animating width
    }).start();
  }, [pct]);

  // Fill width: 0% → 100%
  const fillWidth = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  // Needle x = anim * barWidth (keeps transform purely animated objects)
  const needleTranslateX = Animated.multiply(anim, barWidth || 0);

  // Color shift: red → amber → green
  const fillColor = anim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["#EF4444", "#F59E0B", "#10B981"],
  });

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`You’ve saved $${Math.round(saved)} of $${Math.round(baseline)}. ${Math.round(pct * 100)} percent`}
      style={styles.gaugeCard}
    >
      <View style={styles.gaugeHeaderRow}>
        <Text style={styles.gaugeTitle}>This Month’s Savings</Text>
        <Text style={styles.gaugePct}>{Math.round(pct * 100)}%</Text>
      </View>

      <View
        style={styles.gaugeBarWrap}
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
      >
        <View style={styles.gaugeBarBg} />
        <Animated.View style={[styles.gaugeBarFill, { width: fillWidth, backgroundColor: fillColor }]} />
        <Animated.View style={[styles.gaugeNeedle, { transform: [{ translateX: needleTranslateX }] }]} />
      </View>

      <View style={styles.gaugeFooterRow}>
        <Text style={styles.gaugeSubtle}>Saved</Text>
        <Text style={styles.gaugeMoney}>${Math.round(saved)}</Text>
        <View style={{ flex: 1 }} />
        <Text style={styles.gaugeSubtle}>Goal</Text>
        <Text style={styles.gaugeMoney}>${Math.round(baseline)}</Text>
      </View>

      <Text style={styles.gaugeHint}>Tip: Snap receipts to keep this gauge green 💚</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  gaugeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
  },
  gaugeHeaderRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  gaugeTitle: { flex: 1, fontWeight: "800", fontSize: 14, color: "#0E0E0E" },
  gaugePct: { fontWeight: "800", fontSize: 14, color: "#0E0E0E" },

  gaugeBarWrap: {
    position: "relative",
    height: 16,
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 10,
    backgroundColor: "transparent",
    width: "100%",
  },
  gaugeBarBg: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "#ECEFF1" },
  gaugeBarFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
  },
  gaugeNeedle: {
    position: "absolute",
    top: -4,
    width: 2,
    height: 24,
    // backgroundColor: "#111",
    borderRadius: 1,
  },

  gaugeFooterRow: { flexDirection: "row", alignItems: "center", marginTop: 2, marginBottom: 2 },
  gaugeSubtle: { color: "#6B7280", marginRight: 6, fontSize: 12 },
  gaugeMoney: { fontWeight: "800", color: "#0E0E0E", fontSize: 12 },
  gaugeHint: { marginTop: 6, fontSize: 12, color: "#6B7280" },
});
