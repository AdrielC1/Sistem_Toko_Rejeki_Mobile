import Storage from "expo-sqlite/kv-store";
import { create } from "zustand";
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from "zustand/middleware";

export type CatalogScope = "main" | "mini";

export const CATALOG_SCOPE_STORAGE_KEY = "toko_rejeki_catalog_scope_v1";

const kvStateStorage: StateStorage = {
  getItem: (name) => {
    try {
      return Storage.getItemSync(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      Storage.setItemSync(name, value);
    } catch {
      // Ignore transient KV write errors
    }
  },
  removeItem: (name) => {
    try {
      Storage.removeItemSync(name);
    } catch {
      // Ignore removal error
    }
  },
};

export interface CatalogScopeState {
  scope: CatalogScope;
  setScope: (scope: CatalogScope) => void;
  resetForTest: () => void;
}

export const useCatalogScopeStore = create<CatalogScopeState>()(
  persist(
    (set) => ({
      scope: "mini",
      setScope: (scope) => set({ scope }),
      resetForTest: () => set({ scope: "mini" }),
    }),
    {
      name: CATALOG_SCOPE_STORAGE_KEY,
      storage: createJSONStorage(() => kvStateStorage),
      partialize: (state) => ({
        scope: state.scope,
      }),
    }
  )
);

/**
 * Builds the query string suffix for catalog endpoints based on the active scope.
 * - "mini" -> "?scope=mini" (or "&scope=mini" when `prefix` is "&")
 * - "main" -> "" (backend defaults to main catalog tables)
 */
export function getActiveCatalogScopeQuery(
  prefix: "?" | "&" = "?",
  overrideScope?: CatalogScope
): string {
  const activeScope = overrideScope ?? useCatalogScopeStore.getState().scope;
  if (activeScope === "mini") {
    return `${prefix}scope=mini`;
  }
  return "";
}
