import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import React, { useMemo, useState, useEffect } from "react";
import Chip from "../components/Chip";
import useProfile from "../store/useProfile";
import { useRouter } from "expo-router"; // ✅ add this

export default function Profile() {
  const { age, height, weight, goals, allergies, conditions, saveProfile } =
    useProfile();
  const router = useRouter(); // ✅ create router
  const G = useMemo(
    () => [
      "Lose weight",
      "Gain muscle",
      "Maintain balance",
      "Improve heart health",
      "Low Sodium",
      "High Protein",
      "Low Sugar",
    ],
    []
  );
  const A = useMemo(
    () => ["Peanuts", "Dairy", "Shellfish", "Gluten", "Eggs"],
    []
  );
  const C = useMemo(() => ["Diabetes", "Hypertension", "None"], []);

  console.log("Profile loaded with:", {
    age,
    height,
    weight,
    goals,
    allergies,
    conditions,
  });

  // Local page state (init from store)
  const [localGoals, setLocalGoals] = useState(
    Array.isArray(goals) ? goals : []
  );
  const [localAllergies, setLocalAllergies] = useState(
    Array.isArray(allergies) ? allergies : []
  );
  const [localConditions, setLocalConditions] = useState(
    Array.isArray(conditions) ? conditions : []
  );

  // Keep inputs as strings; convert on Save
  const [ageStr, setAgeStr] = useState(age != null ? String(age) : "");
  const [heightStr, setHeightStr] = useState(
    height != null ? String(height) : ""
  );
  const [weightStr, setWeightStr] = useState(
    weight != null ? String(weight) : ""
  );

  const toggleIn = (list, value) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const onToggleGoal = (g) => setLocalGoals((prev) => toggleIn(prev, g));
  const onToggleAllergy = (a) =>
    setLocalAllergies((prev) => toggleIn(prev, a));
  const onToggleCondition = (c) =>
    setLocalConditions((prev) => toggleIn(prev, c));

  const toNumberOrNull = (s) => (s.trim() === "" ? null : Number(s));

  const onSave = () => {
    try {
      console.log("[onSave] pressed");

      const ageNum = toNumberOrNull(ageStr);
      const heightNum = toNumberOrNull(heightStr);
      const weightNum = toNumberOrNull(weightStr);

      console.log("[onSave] typeof saveProfile:", typeof saveProfile);
      console.log("[onSave] typeof useProfile:", typeof useProfile);
      console.log("[onSave] typeof useProfile.getState:", typeof useProfile?.getState);

      // quick validation logs
      if (ageStr) console.log("[onSave] ageStr:", ageStr, "ageNum:", ageNum);
      if (heightStr) console.log("[onSave] heightStr:", heightStr, "heightNum:", heightNum);
      if (weightStr) console.log("[onSave] weightStr:", weightStr, "weightNum:", weightNum);

      if (ageStr && (Number.isNaN(ageNum) || ageNum < 0 || ageNum > 120)) {
        console.log("[onSave] invalid age → early return");
        Alert.alert("Invalid Age", "Please enter a valid age between 0 and 120.");
        return;
      }
      if (heightStr && (Number.isNaN(heightNum) || heightNum <= 0)) {
        console.log("[onSave] invalid height → early return");
        Alert.alert("Invalid Height", "Please enter a valid height greater than 0.");
        return;
      }
      if (weightStr && (Number.isNaN(weightNum) || weightNum <= 0)) {
        console.log("[onSave] invalid weight → early return");
        Alert.alert("Invalid Weight", "Please enter a valid weight greater than 0.");
        return;
      }

      // Write to store
      if (typeof saveProfile === "function") {
        console.log("[onSave] calling saveProfile...");
        saveProfile({
          age: ageNum,
          height: heightNum,
          weight: weightNum,
          goals: localGoals,
          allergies: localAllergies,
          conditions: localConditions,
        });
        console.log("[onSave] saveProfile returned");
      } else {
        console.warn("[onSave] saveProfile is not a function!");
      }

      // Read store immediately
      if (typeof useProfile?.getState === "function") {
        const after = useProfile.getState();
        console.log("[onSave] AFTER SAVE (store):", after);
      } else {
        console.warn("[onSave] useProfile.getState is not a function — are you exporting the Zustand hook?");
      }

      Alert.alert("Saved", "Your profile has been updated.");
    } catch (e) {
      console.error("[onSave] ERROR:", e);
    } finally {
      console.log("[onSave] finally block executed");
      router.push("/"); // Navigate back to home
    }
  };

  useEffect(() => {
    setLocalGoals(Array.isArray(goals) ? goals : []);
    setLocalAllergies(Array.isArray(allergies) ? allergies : []);
    setLocalConditions(Array.isArray(conditions) ? conditions : []);
    setAgeStr(age != null ? String(age) : "");
    setHeightStr(height != null ? String(height) : "");
    setWeightStr(weight != null ? String(weight) : "");
  }, [goals, allergies, conditions, age, height, weight]);

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.h1}>Personal Info</Text>

      <Text style={styles.section}>Goal</Text>
      <View style={styles.row}>
        {G.map((g) => (
          <Chip
            key={g}
            label={g}
            active={localGoals.includes(g)}
            onPress={() => onToggleGoal(g)}
          />
        ))}
      </View>

      <Text style={styles.section}>Allergic</Text>
      <View style={styles.row}>
        {A.map((a) => (
          <Chip
            key={a}
            label={a}
            active={localAllergies.includes(a)}
            onPress={() => onToggleAllergy(a)}
          />
        ))}
      </View>

      <Text style={styles.section}>Age</Text>
      <TextInput
        value={ageStr}
        onChangeText={setAgeStr}
        placeholder="Age"
        keyboardType="numeric"
        style={styles.input}
      />

      <Text style={styles.section}>Height (cm)</Text>
      <TextInput
        value={heightStr}
        onChangeText={setHeightStr}
        placeholder="Height in cm"
        keyboardType="numeric"
        style={styles.input}
      />

      <Text style={styles.section}>Weight (kg)</Text>
      <TextInput
        value={weightStr}
        onChangeText={setWeightStr}
        placeholder="Weight in kg"
        keyboardType="numeric"
        style={styles.input}
      />

      <Text style={styles.section}>Disease</Text>
      <View style={styles.row}>
        {C.map((c) => (
          <Chip
            key={c}
            label={c}
            active={localConditions.includes(c)}
            onPress={() => onToggleCondition(c)}
          />
        ))}
      </View>

      <TouchableOpacity style={styles.save} onPress={onSave}>
        <Text style={styles.saveText}>Save</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.cancel} onPress={() => router.push("/")}>
        <Text style={styles.saveText}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  h1: { fontSize: 22, fontWeight: "800", marginBottom: 8 },
  section: { marginTop: 12, marginBottom: 6, fontWeight: "800" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  input: { backgroundColor: "#fff", borderRadius: 12, padding: 12 },
  save: {
    marginTop: 16,
    backgroundColor: "#2E7D32",
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
  },
  cancel: {
    marginTop: 16,
    backgroundColor: "#c7c4c4ff",
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
  },
  saveText: { color: "#fff", fontWeight: "800" },
});
