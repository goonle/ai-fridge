import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Pressable,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../lib/api";
import useInventory from "../store/useInventory";

// ---- mock data in one place ----
const MOCK_ITEMS = [
  {
    id: "1",
    name: "Taylor Farms Slaw",
    storage: "fridge",
    qty: 1,
    daysLeft: 5,
  },
  {
    id: "2",
    name: "Berry Fix Frozen Mix",
    storage: "freezer",
    qty: 1,
    daysLeft: 90,
  },
  {
    id: "3",
    name: "Value Toilet Tissue",
    storage: "pantry",
    qty: 1,
    daysLeft: 365,
  },
  {
    id: "4",
    name: "Farrah's Wraps Garden",
    storage: "pantry",
    qty: 1,
    daysLeft: 30,
  },
  {
    id: "5",
    name: "Value Milk Standard 2L",
    storage: "fridge",
    qty: 1,
    daysLeft: 7,
  },
  {
    id: "6",
    name: "Tegel Chicken Sweet Chilli",
    storage: "freezer",
    qty: 1,
    daysLeft: 120,
  },
  {
    id: "7",
    name: "Tegel Chicken Sweet Chilli Crumbed",
    storage: "freezer",
    qty: 1,
    daysLeft: 120,
  },
  {
    id: "8",
    name: "Woodland Free Range Eggs",
    storage: "fridge",
    qty: 12,
    daysLeft: 14,
  },
  {
    id: "9",
    name: "Sanitarium So Good Dairy Oat",
    storage: "fridge",
    qty: 1,
    daysLeft: 10,
  },
  {
    id: "10",
    name: "Hellers Burgers Angus",
    storage: "freezer",
    qty: 1,
    daysLeft: 120,
  },
  {
    id: "11",
    name: "Halo Mandarin Imported",
    storage: "pantry",
    qty: 6,
    daysLeft: 14,
  },
  {
    id: "12",
    name: "Grapes Green 500g",
    storage: "fridge",
    qty: 1,
    daysLeft: 7,
  },
  {
    id: "13",
    name: "Kiwifruit Green NZ",
    storage: "fridge",
    qty: 6,
    daysLeft: 14,
  },
  {
    id: "14",
    name: "Apples Royal Gala",
    storage: "fridge",
    qty: 6,
    daysLeft: 21,
  },
  {
    id: "15",
    name: "Pams Fr. Kale Baby",
    storage: "fridge",
    qty: 1,
    daysLeft: 5,
  },
  {
    id: "16",
    name: "Sanitarium So Good Dairy Oat (2nd)",
    storage: "fridge",
    qty: 1,
    daysLeft: 10,
  },
  {
    id: "17",
    name: "Healtheries Tea Sleep",
    storage: "pantry",
    qty: 1,
    daysLeft: 365,
  },
];
// simple chip
const Chip = ({ label, active, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    style={[styles.chip, active && styles.chipActive]}
  >
    <Text style={[styles.chipText, active && styles.chipTextActive]}>
      {label}
    </Text>
  </TouchableOpacity>
);

const ItemRow = ({ item, onChangeStorage }) => {
  const { name, storage } = item;
  return (
    <View style={styles.itemCard}>
      <Text style={styles.itemName}>{name}</Text>
      <View style={styles.row}>
        {["pantry", "fridge", "freezer"].map((loc) => (
          <Chip
            key={loc}
            label={loc[0].toUpperCase() + loc.slice(1)}
            active={storage === loc}
            onPress={() => onChangeStorage(loc)}
          />
        ))}
      </View>
    </View>
  );
};

export default function Classify() {
  const router = useRouter();

  // ⚠️ normalize params.uri (string | string[] | undefined)
  const params = useLocalSearchParams();
  const uri = Array.isArray(params.uri) ? params.uri[0] : params.uri;

  const { addItems } = useInventory();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]); // [{id,name,qty,storage}]
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        if (!uri) {
          // no image: show mock immediately
          setItems(MOCK_ITEMS);
          return;
        }

        // Build multipart form – FastAPI expects field name "file"
        const fd = new FormData();
        fd.append("file", {
          uri,
          name: "receipt.jpg",
          type: "image/jpeg",
        });

        // Call FastAPI route: POST /receipt/ocr
        const { data } = await api.post("/receipt/ocr", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        // backendItems = parsed.items from your FastAPI response
        const backendItems = data?.parsed?.items || [];

        // compute daysLeft from expiry_date or storage defaults
        const computeDaysLeft = (it) => {
          if (it.expiry_date) {
            try {
              const today = new Date();
              const exp = new Date(it.expiry_date);
              const diffMs = exp - today;
              const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
              return diffDays >= 0 ? diffDays : 0;
            } catch {
              // fall through
            }
          }

          const storage = (it.storage || "pantry").toLowerCase();
          if (storage === "freezer") return 90;
          if (storage === "fridge") return 7;
          return 180;
        };

        const normalized = backendItems.map((it, idx) => {
          const storage = (it.storage || "pantry").toLowerCase();

          return {
            id: `it-${idx}-${Date.now()}`,
            name: it.item_norm || it.item_raw || `Item ${idx + 1}`,
            qty: typeof it.qty === "number" ? it.qty : 1,
            storage,
            daysLeft: computeDaysLeft(it),
          };
        });

        // if API returned nothing, fallback to mock so the UI shows something
        setItems(normalized.length ? normalized : MOCK_ITEMS);
      } catch (e) {
        Alert.alert("Analyze failed", e?.message || "Using mock data for now.");
        setItems(MOCK_ITEMS);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [uri]);

  useEffect(() => {
    // quick debug: ensure items are actually in state
    console.log("Classify items:", items);
  }, [items]);

  const updateStorage = (id, storage) => {
    setItems((list) => list.map((x) => (x.id === id ? { ...x, storage } : x)));
  };

  // const confirm = () => {
  //     addItems(
  //         items.map((it) => ({
  //             id: `${it.name}-${Date.now()}-${Math.random()}`,
  //             name: it.name,
  //             qty: it.qty,
  //             storage: it.storage,
  //             daysLeft: it.storage === "freezer" ? 90 : it.storage === "fridge" ? 7 : 180,
  //         }))
  //     );
  //     console.log("Items added to storage:", items);
  //     Alert.alert("Saved", "Items added to storage.", [
  //         { text: "OK", onPress: () => router.replace("storage") },
  //     ]);
  // };
  const confirm = async () => {
    console.log("Confirming items:", items);
    if (!items.length || saving) return;

    const payload = {
      items: items.map((it) => ({
        name: it.name,
        quantity: it.qty,
        storage: it.storage, // 'fridge' | 'freezer' | 'pantry'
      })),
    };

    try {
      setSaving(true);
      // // ✅ Call your backend
      // const res = await api.post("/inventory/items/save", payload);
      // // Assuming server responds with: { items: [{ id, name, quantity, storage, daysLeft }] }
      // const saved = Array.isArray(res?.data?.items) ? res.data.items : [];

      // Add to local store
      // addItems(
      //     saved.map((it) => ({
      //         id: it.id || `${it.name}-${Date.now()}-${Math.random()}`,
      //         name: it.name,
      //         qty: it.quantity ?? 1,
      //         storage: it.storage,
      //         daysLeft: it.daysLeft, // comes from backend
      //     }))
      // );

      // Alert.alert("Saved", "Items added to storage.", [
      //     { text: "OK", onPress: () => router.replace("storage") },
      // ]);
      const toStore = items;

      addItems(toStore);

      Alert.alert("Saved", "Items added to storage.", [
        { text: "OK", onPress: () => router.replace("storage") },
      ]);
    } catch (e) {
      Alert.alert(
        "Save failed",
        e?.response?.data?.error || e?.message || "Couldn’t reach server"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Pressable style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backIcon}>←</Text>
        <Text style={styles.backText}>Home</Text>
      </Pressable>
      <Text style={styles.h1}>Classify Storage</Text>
      <Text style={styles.sub}>Choose where each item belongs</Text>

      {loading ? (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator />
          <Text style={{ marginTop: 8 }}>Analyzing receipt…</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(x) => x.id}
          contentContainerStyle={{ paddingBottom: 90, flexGrow: 1 }}
          renderItem={({ item }) => (
            <ItemRow
              item={item}
              onChangeStorage={(storage) => updateStorage(item.id, storage)}
            />
          )}
          ListEmptyComponent={
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                paddingTop: 40,
              }}
            >
              <Text>No items found.</Text>
              <TouchableOpacity
                style={[styles.confirmBtn, { marginTop: 16 }]}
                onPress={() => setItems(MOCK_ITEMS)}
              >
                <Text style={styles.confirmText}>Load Mock Items</Text>
              </TouchableOpacity>
            </View>
          }
          ListFooterComponent={
            items.length ? (
              <TouchableOpacity style={styles.confirmBtn} onPress={confirm}>
                <Text style={styles.confirmText}>
                  Add to Storage ({items.length})
                </Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, backgroundColor: "#F7F8F7" },
  h1: { fontSize: 22, fontWeight: "800" },
  sub: { color: "#667", marginTop: 4, marginBottom: 8 },

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

  itemCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  itemName: { fontSize: 16, fontWeight: "800", marginBottom: 8 },
  row: { flexDirection: "row", gap: 8 },

  chip: {
    borderWidth: 1,
    borderColor: "#E6E8EA",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: "#2E7D32", borderColor: "#2E7D32" },
  chipText: { fontWeight: "800" },
  chipTextActive: { color: "#fff" },

  confirmBtn: {
    backgroundColor: "#2E7D32",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
  },
  confirmText: { color: "#fff", fontWeight: "800" },
});
