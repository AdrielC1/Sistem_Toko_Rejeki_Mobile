import { Stack } from "expo-router";
import { useAuth } from "@/context/AuthContext";

export default function ProdukStackLayout() {
  const { roleCapabilities } = useAuth();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
      <Stack.Protected guard={roleCapabilities.canEditProducts}>
        <Stack.Screen name="form" />
        <Stack.Screen name="trash" />
      </Stack.Protected>
    </Stack>
  );
}
