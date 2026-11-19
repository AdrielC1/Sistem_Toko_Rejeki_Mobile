import { Stack } from "expo-router";

export default function PesananStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[tabId]" />
    </Stack>
  );
}
