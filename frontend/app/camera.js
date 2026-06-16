import { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter, useLocalSearchParams } from "expo-router";

export default function CameraScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const camRef = useRef(null);
  const [ready, setReady] = useState(false);
  const { type } = useLocalSearchParams();

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted) requestPermission();
  }, [permission]);

  if (!permission) return <View style={{ flex: 1 }} />;
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Camera permission is required.</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const takePhoto = async () => {
    try {
      const photo = await camRef.current?.takePictureAsync({
        quality: 0.9,
        base64: false,
        skipProcessing: true,
      });
      if (!photo?.uri) return;
      // Send the captured image to Analyze screen

      if (type === "receipt") {
        router.push({ pathname: "/classify", params: { uri: photo.uri, type: type } });
      } else if (type === "food") {
        router.push({ pathname: "/edibleCheck", params: { uri: photo.uri, type: type } });
      }

    } catch (e) {
      Alert.alert("Capture failed", e?.message || "Unknown error");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "black" }}>
      <CameraView
        ref={camRef}
        style={{ flex: 1 }}
        onCameraReady={() => setReady(true)}
      />
      <View style={styles.bottomBar}>
        <TouchableOpacity
          disabled={!ready}
          style={[styles.shutter, !ready && { opacity: 0.5 }]}
          onPress={takePhoto}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  text: { fontWeight: "700", marginBottom: 12 },
  btn: { backgroundColor: "#2E7D32", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  btnText: { color: "#fff", fontWeight: "800" },
  bottomBar: {
    position: "absolute", bottom: 30, left: 0, right: 0,
    justifyContent: "center", alignItems: "center"
  },
  shutter: { width: 74, height: 74, borderRadius: 999, backgroundColor: "#fff" },
});
