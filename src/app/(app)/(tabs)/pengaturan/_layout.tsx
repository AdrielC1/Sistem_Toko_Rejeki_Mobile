import { Stack } from "expo-router";
import { useAuth } from "@/context/AuthContext";

export default function PengaturanStackLayout() {
  const { roleCapabilities } = useAuth();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="about" />
      <Stack.Screen name="printer" />
      <Stack.Protected guard={roleCapabilities.canManageStore}>
        <Stack.Screen name="store-profile" />
        <Stack.Screen name="accounts" />
        <Stack.Screen name="categories-units" />
      </Stack.Protected>
    </Stack>
  );
}
