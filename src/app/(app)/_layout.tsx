import { Slot } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { SyncEngineProvider } from "@/context/SyncEngineContext";
import { SystemStatusProvider } from "@/context/SystemStatusContext";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function AuthenticatedAppLayout() {
  const { user } = useAuth();
  const navKey = user ? `${user.id}:${user.role}` : "guest";

  return (
    <SystemStatusProvider>
      <SyncEngineProvider>
        <Slot key={navKey} />
      </SyncEngineProvider>
    </SystemStatusProvider>
  );
}
