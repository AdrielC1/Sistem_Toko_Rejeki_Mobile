import { Redirect } from "expo-router";
import { useAuth } from "@/context/AuthContext";

export default function IndexScreen() {
  const { user, isHydrated } = useAuth();

  if (!isHydrated) {
    return null;
  }

  return <Redirect href={user ? "/kasir" : "/login"} />;
}
