import { Stack } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "react-native";
import queryClient from "../lib/queryClient";

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F7F8F7" }}>
        <StatusBar barStyle="dark-content" />
        <Stack screenOptions={{ headerTitleStyle: { fontWeight: "800" } }} />
      </SafeAreaView>
    </QueryClientProvider>
  );
}