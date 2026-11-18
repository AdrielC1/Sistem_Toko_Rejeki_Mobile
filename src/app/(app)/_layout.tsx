import { Slot } from "expo-router";
import { useAuth } from "@/context/AuthContext";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function AuthenticatedAppLayout() {
  const { user } = useAuth();
  const navKey = user ? `${user.id}:${user.role}` : "guest";

  return <Slot key={navKey} />;
}
