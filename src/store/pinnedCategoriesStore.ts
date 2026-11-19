import Storage from "expo-sqlite/kv-store";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

export const PINNED_CATEGORIES_STORAGE_KEY =
  "toko_rejeki_pinned_categories_v1";
export const MAX_PINNED_CATEGORIES = 5;

const syncKvStorage: StateStorage = {
  getItem: (name) => Storage.getItemSync(name) ?? null,
  setItem: (name, value) => Storage.setItemSync(name, value),
  removeItem: (name) => Storage.removeItemSync(name),
};

interface PinnedCategoriesStoreState {
  pinnedIds: string[];
  togglePin: (categoryId: string) => void;
  pruneMissing: (validCategoryIds: string[]) => void;
  resetForTest: () => void;
}

export const usePinnedCategoriesStore = create<PinnedCategoriesStoreState>()(
  persist(
    (set) => ({
      pinnedIds: [],
      togglePin: (categoryId) =>
        set((state) => {
          if (state.pinnedIds.includes(categoryId)) {
            return {
              pinnedIds: state.pinnedIds.filter((id) => id !== categoryId),
            };
          }
          if (state.pinnedIds.length >= MAX_PINNED_CATEGORIES) {
            return state;
          }
          return {
            pinnedIds: [...state.pinnedIds, categoryId],
          };
        }),
      pruneMissing: (validCategoryIds) =>
        set((state) => {
          const validSet = new Set(validCategoryIds);
          const next = state.pinnedIds.filter((id) => validSet.has(id));
          if (next.length === state.pinnedIds.length) {
            return state;
          }
          return { pinnedIds: next };
        }),
      resetForTest: () => set({ pinnedIds: [] }),
    }),
    {
      name: PINNED_CATEGORIES_STORAGE_KEY,
      storage: createJSONStorage(() => syncKvStorage),
    }
  )
);
