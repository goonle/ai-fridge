import { Modal, View, Text, StyleSheet, Pressable } from "react-native";
import { useEffect, useState } from "react";

export default function ItemActionModal({ visible, item, onClose, onConsume, onDelete }) {
  const [qty, setQty] = useState(1);
  useEffect(() => setQty(1), [item?.id]);
  if (!visible || !item) return null;

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{item.name}</Text>
          <Text style={styles.sub}>
            {item.daysLeft <= 0 ? "Expired" : `Expires in ${item.daysLeft} day(s)`}
          </Text>

          {/* <View style={styles.counter}>
            <Pressable onPress={() => setQty(q => Math.max(1, q - 1))} style={styles.btn}><Text style={styles.btnText}>–</Text></Pressable>
            <Text style={styles.q}>{qty}</Text>
            <Pressable onPress={() => setQty(q => q + 1)} style={styles.btn}><Text style={styles.btnText}>+</Text></Pressable>
          </View> */}

          <View style={styles.actions}>
            <Pressable style={[styles.action, styles.consume]} onPress={() => onConsume?.(item, qty)}>
              <Text style={{ color: "#fff", fontWeight: "800" }}>Consume</Text>
            </Pressable>
            <Pressable style={[styles.action, styles.delete]} onPress={() => onDelete?.(item)}>
              <Text style={{ color: "#E53935", fontWeight: "800" }}>Bin it</Text>
            </Pressable>
          </View>

          <Pressable onPress={onClose} style={{ marginTop: 10, alignItems: "center", backgroundColor: "#F7F8F7", padding: 10, borderRadius: 12 }}>
            <Text style={{ color: "#666", fontWeight: "700" }}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.25)", justifyContent: "center", padding: 20 },
  card: { backgroundColor: "#fff", borderRadius: 20, padding: 18 },
  title: { fontSize: 18, fontWeight: "800" },
  sub: { marginTop: 4, color: "#667" },
  counter: { marginTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  btn: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: "#E6E8EA", justifyContent: "center", alignItems: "center" },
  btnText: { fontSize: 20, fontWeight: "800" },
  q: { fontSize: 18, fontWeight: "800", minWidth: 28, textAlign: "center" },
  actions: { flexDirection: "row", gap: 10, marginTop: 16 },
  action: { flex: 1, paddingVertical: 12, borderRadius: 12, justifyContent: "center", alignItems: "center", borderWidth: 1 },
  consume: { backgroundColor: "#2E7D32", borderColor: "#2E7D32" },
  delete: { backgroundColor: "#fff", borderColor: "#E53935" },
});
