import { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
} from "react-native";
import useInventory from "../store/useInventory";
import useProfile from "../store/useProfile";
import { api } from "../lib/api";
import { useQuery } from "@tanstack/react-query";

/* ----------------- Mock data (Title/content shape) ----------------- */
const MOCK_RECIPES_RAW = [
  {
    Title: "Chicken Banana Curry Soup",
    content: `
Ingredients:
- Bananas
- Milk
- Taylor Farms Slaw
- Woodland Free Range Eggs
- Milk, flour, oil, salt, pepper

Instructions:
  Step 1: Peel and mash half of the bananas.
  Step 2: In a pot over medium heat, sauté diced onion until translucent.
  Step 3: Add minced garlic to the onions for flavor.
  Step 4: Crumble in chicken breast and cook thoroughly with salt and pepper.
  Step 5: Pour milk into pot, add frozen mixed vegetables, bring to a simmer until heated through.

  Estimated Time: 30 minutes

  
`,
  },
  {
    Title: "Berry Oat Smoothie",
    content: `
Ingredients:
- Berry Fix Frozen Mix
- So Good Dairy Oat (or milk)
- Honey or banana (optional)

Instructions:
1) Add frozen berries + oat drink to a blender.
2) Blend until smooth; sweeten to taste.
3) Serve cold.
`,
  },
  {
    Title: "Egg & Kale Breakfast Bowl",
    content: `
Ingredients:
- Woodland Free Range Eggs
- Pams Fresh Kale Baby
- Apple slices (optional)
- Olive oil, salt, pepper

Instructions:
1) Sauté kale with a little olive oil until tender.
2) Fry or scramble eggs; season.
3) Serve eggs on kale; add apple slices on top.
`,
  },
  {
    Title: "Angus Burger Bowl",
    content: `
Ingredients:
- Hellers Burgers Angus (patty)
- Lettuce, tomato (use what's on hand)
- Salt, pepper, oil

Instructions:
1) Sear patty in a hot pan with a little oil; season well.
2) Serve over chopped lettuce + tomato as a low-carb bowl.
3) Optional: drizzle with yogurt-mayo + lemon.
`,
  },
];

/* ----------------- Helpers ----------------- */

// Normalize API/simple data → { id, title, content }
const normalizeRecipes = (recipes = []) =>
  recipes.map((r, i) => ({
    id: `recipe-${i}-${Math.random().toString(36).slice(2)}`,
    title: r.Title || r.title || "Untitled",
    content: r.content || "",
  }));

// Tiny helper: show which stored items appear in recipe content (lowercase contains)
const matchesFromInventory = (content = "", inventoryNames = []) => {
  const text = (content || "").toLowerCase();
  const hits = inventoryNames.filter((n) => n && text.includes(n));
  // dedupe
  return [...new Set(hits)];
};

/* ----------------- Screen ----------------- */
export default function Recipes() {
  const inv = useInventory();
  const profile = useProfile();

  // inventory names for display chips
  const invNames = useMemo(() => {
    const names = [...inv.pantry, ...inv.fridge, ...inv.freezer]
      .map((x) => x.name?.toLowerCase?.().trim())
      .filter(Boolean);
    return [...new Set(names)];
  }, [inv.hash]);

  const [active, setActive] = useState(null); // { id, title, content } for modal

  const { data, isLoading, isError } = useQuery({
    queryKey: ["recipes-simple", inv.hash, profile.hash],
    queryFn: async () => {
      
      try {
        const res = await api.get("/recipes/suggest"); // expects array of {Title, content}
        const list = Array.isArray(res?.data) ? res.data : res?.data?.recipes;
        if (Array.isArray(list) && list.length) return normalizeRecipes(list);
        // fallback if backend returns nothing
        return normalizeRecipes(MOCK_RECIPES_RAW);
      } catch {
        // offline / not connected → mock
        return normalizeRecipes(MOCK_RECIPES_RAW);
      }
    },
    initialData: normalizeRecipes(MOCK_RECIPES_RAW),
    keepPreviousData: true,
    staleTime: 30_000,
  });

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Recipes For You</Text>

      {/* friendly states */}
      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8, color: "#666" }}>Loading recipes…</Text>
          {[0, 1].map((i) => (
            <View key={i} style={styles.skelCard}>
              <View style={styles.skelLine} />
              <View style={[styles.skelLine, { width: "65%" }]} />
            </View>
          ))}
        </View>
      ) : isError ? (
        <View style={styles.loadingBox}>
          <Text style={{ color: "#B00020", fontWeight: "700" }}>Couldn’t load recipes.</Text>
          <Text style={{ color: "#666" }}>Showing offline suggestions.</Text>
        </View>
      ) : (
        <FlatList
          data={data || []}
          keyExtractor={(x) => x.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => {
            const hits = matchesFromInventory(item.content, invNames); // small chips
            return (
              <View style={styles.card}>
                <Text style={styles.title}>{item.title}</Text>

                {!!hits.length && (
                  <View style={styles.hitRow}>
                    {hits.slice(0, 4).map((h) => (
                      <View key={`${item.id}-${h}`} style={styles.hitChip}>
                        <Text style={styles.hitChipText}>{h}</Text>
                      </View>
                    ))}
                    {hits.length > 4 && (
                      <View style={[styles.hitChip, { backgroundColor: "#E0E0E0" }]}>
                        <Text style={[styles.hitChipText, { color: "#333" }]}>+{hits.length - 4}</Text>
                      </View>
                    )}
                  </View>
                )}

                {/* content preview (first few lines) */}
                <Text style={styles.preview} numberOfLines={4}>
                  {item.content.replace(/\n{3,}/g, "\n\n").trim()}
                </Text>

                <TouchableOpacity style={styles.cta} onPress={() => setActive(item)}>
                  <Text style={styles.ctaText}>View Recipe</Text>
                </TouchableOpacity>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>🍽️</Text>
              <Text style={styles.emptyTitle}>No recipes yet</Text>
              <Text style={styles.emptyText}>Add items to storage to unlock suggestions.</Text>
            </View>
          }
        />
      )}

      {/* Full-screen modal to read a recipe */}
      <Modal visible={!!active} animationType="slide" onRequestClose={() => setActive(null)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{active?.title}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setActive(null)}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <Text style={styles.contentText}>
              {(active?.content || "").replace(/\n{3,}/g, "\n\n").trim()}
            </Text>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

/* ----------------- Styles ----------------- */
const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, backgroundColor: "#F7F8F7" },
  h1: { fontSize: 22, fontWeight: "800", marginBottom: 10 },

  loadingBox: { alignItems: "center", justifyContent: "center", paddingVertical: 20 },
  skelCard: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 14,
    marginTop: 12,
    overflow: "hidden",
    borderColor: "#EEE",
    borderWidth: 1,
    padding: 14,
  },
  skelLine: { height: 12, backgroundColor: "#EFEFEF", borderRadius: 999, marginTop: 10 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderColor: "#EEE",
    borderWidth: 1,
  },
  title: { fontWeight: "800", fontSize: 18 },

  hitRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  hitChip: { backgroundColor: "#E8F5E9", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  hitChipText: { color: "#2E7D32", fontWeight: "700", fontSize: 12 },

  preview: { color: "#555", marginTop: 10, lineHeight: 20 },

  cta: {
    alignSelf: "flex-start",
    backgroundColor: "#FFB562",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    marginTop: 12,
  },
  ctaText: { fontWeight: "800", color: "#222" },

  emptyBox: { alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  emptyEmoji: { fontSize: 36, marginBottom: 6 },
  emptyTitle: { fontWeight: "800", fontSize: 16 },
  emptyText: { color: "#666", marginTop: 4 },

  modalWrap: { flex: 1, backgroundColor: "#fff" },
  modalHeader: {
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomColor: "#EEE",
    borderBottomWidth: 1,
    backgroundColor: "#F9FAFB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: { fontWeight: "800", fontSize: 18 },
  closeBtn: { backgroundColor: "#eee", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  closeText: { fontWeight: "700", color: "#333" },
  contentText: { color: "#333", lineHeight: 22, fontSize: 15 },
});
