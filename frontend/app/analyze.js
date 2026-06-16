import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert } from "react-native";
import { api } from "../lib/api";
import useInventory from "../store/useInventory";
import { useLocalSearchParams } from "expo-router";

export default function Analyze() {
    const { uri } = useLocalSearchParams();
    const [imageUri, setImageUri] = useState(null);
    const [items, setItems] = useState([]);
    const { addItems } = useInventory();
    const [loading, setLoading] = useState(false);

    const pickImage = async () => {
        const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images });
        if (!r.canceled) setImageUri(r.assets[0].uri);
    };

    const sendToServer = async () => {
        if (!imageUri) return Alert.alert("Pick a receipt image first.");
        setLoading(true);
        try {
            const fd = new FormData();
            fd.append("image", { uri: imageUri, name: "receipt.jpg", type: "image/jpeg" });
            const { data } = await api.post("/ocr/analyze-receipt", fd, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            setItems(data.items || []);
        } catch (e) {
            Alert.alert("OCR failed", e?.message || "Try again");
        } finally {
            setLoading(false);
        }
    };

    const confirm = () => {
        addItems(items.map(it => ({
            id: `${it.name}-${Date.now()}-${Math.random()}`,
            name: it.name,
            qty: it.quantity || 1,
            storage: it.category_guess || "fridge",
            daysLeft: it.daysLeft || 5,
        })));
        Alert.alert("Items added to storage.");
        setItems([]);
    };

    return (
        <View style={styles.wrap}>
            <Text style={styles.h1}>Analyze Receipt</Text>
            <TouchableOpacity style={styles.btn} onPress={pickImage}>
                <Text style={styles.btnText}>{imageUri ? "Change Image" : "Pick Image"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, { backgroundColor: "#2E7D32" }]} onPress={sendToServer} disabled={loading}>
                <Text style={[styles.btnText, { color: "#fff" }]}>{loading ? "Analyzing..." : "Analyze"}</Text>
            </TouchableOpacity>

            <FlatList
                data={items}
                keyExtractor={(x, i) => x.name + i}
                renderItem={({ item }) => (
                    <View style={styles.row}>
                        <Text style={styles.name}>{item.name}</Text>
                        <Text style={styles.meta}>{item.category_guess}</Text>
                    </View>
                )}
                ListFooterComponent={
                    items.length ? (
                        <TouchableOpacity style={[styles.btn, { backgroundColor: "#2E7D32" }]} onPress={confirm}>
                            <Text style={[styles.btnText, { color: "#fff" }]}>Confirm Items ({items.length})</Text>
                        </TouchableOpacity>
                    ) : null
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { flex: 1, padding: 16 },
    h1: { fontSize: 22, fontWeight: "800", marginBottom: 8 },
    btn: {
        backgroundColor: "#fff", borderRadius: 14, padding: 14, marginVertical: 6,
        shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, elevation: 2
    },
    btnText: { fontWeight: "800", textAlign: "center" },
    row: {
        backgroundColor: "#fff", borderRadius: 12, padding: 12, marginTop: 8,
        flexDirection: "row", justifyContent: "space-between"
    },
    name: { fontWeight: "700" }, meta: { color: "#666" },
});
