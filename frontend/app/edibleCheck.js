// app/edible-check.jsx
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Image, TouchableOpacity, ActivityIndicator, StyleSheet, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

export default function EdibleCheck() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const uri = Array.isArray(params.uri) ? params.uri[0] : params.uri;

    const [loading, setLoading] = useState(true);
    const [result, setResult] = useState(null);   // { isEatable: boolean, explanation: string, confidence?: number }
    const [error, setError] = useState(null);

    const statusMeta = useMemo(() => {
        if (!result) return null;
        return result.isEatable
            ? { label: "Edible", emoji: "✅", bg: "#E8F5E9", fg: "#1B5E20" }
            : { label: "Not Edible", emoji: "❌", bg: "#FFEBEE", fg: "#B71C1C" };
    }, [result]);

    useEffect(() => {
        if (!uri) {
            setError("No image provided.");
            setLoading(false);
            return;
        }
        classify(uri);
    }, [uri]);

    const classify = async (imageUri) => {
        setLoading(true);
        setError(null);

        try {
            const form = new FormData();
            form.append("file", {
                uri: imageUri,
                type: "image/jpeg",
                name: "photo.jpg",
            });

            // const res = await fetch("https://your.api/classify-edible", {
            //     method: "POST",
            //     body: form, // let RN set Content-Type with boundary
            // });

            // if (!res.ok) {
            //     let msg = res.status + " " + res.statusText;
            //     try {
            //         const data = await res.json();
            //         msg = data?.error || msg;
            //     } catch { }
            //     throw new Error(msg);
            // }

            // const data = await res.json();
            // // Expecting: { isEatable: boolean, explanation: string, confidence?: number }
            // if (typeof data.isEatable !== "boolean" || typeof data.explanation !== "string") {
            //     throw new Error("Unexpected response.");
            // }
            // setResult(data);

            // mock response (randomize for demo)
            const mockResults = [
                {
                    isEatable: true,
                    explanation: "The food looks fresh with no signs of spoilage such as mold or discoloration.",
                    confidence: 0.92,
                },
                {
                    isEatable: false,
                    explanation: "The food shows visible mold growth and unusual color, indicating spoilage.",
                    confidence: 0.87,
                },
            ];

            // pick one randomly
            const data = mockResults[Math.floor(Math.random() * mockResults.length)];
            // const data = mockResults[1];

            setResult(data);
        } catch (e) {
            setError(e?.message || "Unknown error");
        } finally {
            setLoading(false);
        }
    };

    const onRetake = () => router.replace({pathname : "camera", params: { type: "food" } });
    const onBack = () => router.back();

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                    <Text style={styles.backText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Edible Check</Text>
                <View style={{ width: 60 }} />
            </View>

            {!uri ? (
                <View style={[styles.center, { flex: 1 }]}>
                    <Text style={styles.errorText}>No image provided.</Text>
                    <TouchableOpacity style={styles.primaryBtn} onPress={onRetake}>
                        <Text style={styles.primaryBtnText}>Open Camera</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <ScrollView contentContainerStyle={{ padding: 16 }}>
                    <Image source={{ uri }} style={styles.preview} resizeMode="cover" />

                    {loading ? (
                        <View style={[styles.card, styles.center, { paddingVertical: 32 }]}>
                            <ActivityIndicator size="large" />
                            <Text style={{ marginTop: 12, fontWeight: "600", color: "#E5E7EB" }}>Analyzing your photo…</Text>
                        </View>
                    ) : error ? (
                        <View style={[styles.card, { borderColor: "#FFCDD2", borderWidth: 1 }]}>
                            <Text style={[styles.sectionTitle, { color: "#FCA5A5" }]}>Analysis Failed</Text>
                            <Text style={{ color: "#FCA5A5", marginBottom: 12 }}>{error}</Text>
                            <TouchableOpacity style={styles.secondaryBtn} onPress={() => classify(uri)}>
                                <Text style={styles.secondaryBtnText}>Try Again</Text>
                            </TouchableOpacity>
                        </View>
                    ) : result && statusMeta ? (
                        <>
                            <View style={[styles.statusChip, { backgroundColor: statusMeta.bg }]}>
                                <Text style={[styles.statusText, { color: statusMeta.fg }]}>
                                    {statusMeta.emoji} {statusMeta.label}
                                </Text>
                                {typeof result.confidence === "number" && (
                                    <Text style={[styles.confidence, { color: statusMeta.fg }]}>
                                        {(result.confidence * 100).toFixed(0)}% confidence
                                    </Text>
                                )}
                            </View>

                            <View style={styles.card}>
                                <Text style={styles.sectionTitle}>Why?</Text>
                                <Text style={styles.explText}>{result.explanation}</Text>
                            </View>

                            <View style={styles.actionsRow}>
                                <TouchableOpacity style={styles.secondaryBtn} onPress={() => classify(uri)}>
                                    <Text style={styles.secondaryBtnText}>Re-analyze</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.primaryBtn} onPress={onRetake}>
                                    <Text style={styles.primaryBtnText}>Retake Photo</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    ) : null}
                </ScrollView>
            )}
        </View>
    );
}


const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F5F7F6" }, // ← new background
    header: {
        paddingTop: 50, paddingBottom: 12, paddingHorizontal: 16,
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    },
    backBtn: { paddingVertical: 6, paddingHorizontal: 8 },
    backText: { color: "#333", fontWeight: "600", fontSize: 16 }, // darker text
    title: { color: "#111", fontWeight: "800", fontSize: 18 },
    preview: { width: "100%", height: 240, borderRadius: 16, backgroundColor: "#E1E4E3" }, // slightly darker panel
    card: { marginTop: 16, padding: 16, borderRadius: 16, backgroundColor: "#FFFFFF", borderColor: "#DDD" },
    sectionTitle: { color: "#111", fontWeight: "800", fontSize: 16, marginBottom: 8 },
    explText: { color: "#444", lineHeight: 20 },
    statusChip: {
        marginTop: 16, padding: 14, borderRadius: 14,
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        backgroundColor: "#E9F2FF",
    },
    statusText: { fontWeight: "800", fontSize: 16, color: "#1B5E20" },
    confidence: { fontWeight: "700", color: "#444" },
    actionsRow: { flexDirection: "row", gap: 12, marginTop: 16 },
    primaryBtn: {
        backgroundColor: "#2563EB", paddingVertical: 12, paddingHorizontal: 16,
        borderRadius: 12, flex: 1, alignItems: "center",
    },
    primaryBtnText: { color: "white", fontWeight: "800" },
    secondaryBtn: {
        backgroundColor: "transparent", borderWidth: 1, borderColor: "#2563EB",
        paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, flex: 1, alignItems: "center",
    },
    secondaryBtnText: { color: "#2563EB", fontWeight: "800" },
    center: { alignItems: "center", justifyContent: "center" },
    errorText: { color: "#B71C1C", fontWeight: "700", marginBottom: 12 },
});
