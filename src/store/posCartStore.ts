import Storage from "expo-sqlite/kv-store";
import { create } from "zustand";
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from "zustand/middleware";
import {
  recomputeCartItem,
  type CartItem,
  type OrderTab,
  type SelectableProductUnit,
} from "@/domain/pricing";
import type { Product } from "@/types";

export const POS_TABS_STORAGE_KEY = "toko_rejeki_pos_tabs_v1";

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
      // Ignore transient KV write failures cleanly
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

function createEmptyTab(index: number, now = Date.now()): OrderTab {
  return {
    id: `tab-${now}-${index}`,
    label: `Nota #${index}`,
    items: [],
    discount: 0,
    createdAt: new Date(now).toISOString(),
  };
}

function getNextTabNumber(tabs: OrderTab[]): number {
  let maxNum = 0;
  for (const t of tabs) {
    const match = /(\d+)$/.exec(t.label.trim());
    if (match) {
      const n = Number(match[1]);
      if (Number.isFinite(n) && n > maxNum) {
        maxNum = n;
      }
    }
  }
  return Math.max(tabs.length + 1, maxNum + 1);
}

export interface PosCartState {
  tabs: OrderTab[];
  activeTabId: string;
  createTab: () => string;
  switchTab: (tabId: string) => void;
  renameTab: (tabId: string, label: string) => void;
  removeTab: (tabId: string) => void;
  clearActiveTab: () => void;
  addItem: (
    product: Product,
    unit: SelectableProductUnit,
    quantity?: number
  ) => void;
  updateItemQuantity: (
    productId: string,
    unitId: string,
    quantity: number
  ) => void;
  setItemCustomPrice: (
    productId: string,
    unitId: string,
    customPrice: number | null
  ) => void;
  switchItemUnit: (
    productId: string,
    fromUnitId: string,
    targetUnit: SelectableProductUnit
  ) => void;
  removeItem: (productId: string, unitId: string) => void;
  setDiscount: (discount: number) => void;
  completeCheckoutTab: (tabId: string) => void;
  resetAllTabsForTest: () => void;
}

const initialTab = createEmptyTab(1, 1700000000000);

export const usePosCartStore = create<PosCartState>()(
  persist(
    (set, get) => ({
      tabs: [initialTab],
      activeTabId: initialTab.id,

      createTab: () => {
        const currentTabs = get().tabs;
        const nextNum = getNextTabNumber(currentTabs);
        const created = createEmptyTab(nextNum, Date.now());
        set({
          tabs: [...currentTabs, created],
          activeTabId: created.id,
        });
        return created.id;
      },

      switchTab: (tabId) => {
        const exists = get().tabs.some((t) => t.id === tabId);
        if (exists) {
          set({ activeTabId: tabId });
        }
      },

      renameTab: (tabId, label) => {
        const trimmed = label.trim();
        if (!trimmed) {
          return;
        }
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === tabId ? { ...tab, label: trimmed } : tab
          ),
        }));
      },

      removeTab: (tabId) => {
        set((state) => {
          const remaining = state.tabs.filter((t) => t.id !== tabId);
          if (remaining.length === 0) {
            const fresh = createEmptyTab(1, Date.now());
            return {
              tabs: [fresh],
              activeTabId: fresh.id,
            };
          }
          const nextActive =
            state.activeTabId === tabId
              ? remaining[remaining.length - 1].id
              : state.activeTabId;
          return {
            tabs: remaining,
            activeTabId: nextActive,
          };
        });
      },

      clearActiveTab: () => {
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === state.activeTabId
              ? { ...tab, items: [], discount: 0 }
              : tab
          ),
        }));
      },

      addItem: (product, unit, deltaQty = 1) => {
        const qtyToAdd = Math.max(1, Math.floor(deltaQty));
        set((state) => ({
          tabs: state.tabs.map((tab) => {
            if (tab.id !== state.activeTabId) {
              return tab;
            }
            const existingIdx = tab.items.findIndex(
              (item) =>
                item.productId === product.id && item.unitId === unit.unitId
            );
            if (existingIdx >= 0) {
              const updatedItems = tab.items.map((item, idx) =>
                idx === existingIdx
                  ? recomputeCartItem({
                      ...item,
                      quantity: item.quantity + qtyToAdd,
                    })
                  : item
              );
              return { ...tab, items: updatedItems };
            }

            const newItem: CartItem = recomputeCartItem({
              productId: product.id,
              productName: product.name,
              sku: product.sku,
              unitId: unit.unitId,
              unitName: unit.unitName,
              conversionFactor: unit.conversionFactor,
              baseUnitPrice: unit.sellingPrice,
              isCustomPrice: false,
              wholesaleTiers: unit.wholesaleTiers ?? [],
              quantity: qtyToAdd,
              effectiveUnitPrice: unit.sellingPrice,
              subtotal: unit.sellingPrice * qtyToAdd,
              wholesaleSavings: 0,
            });

            return {
              ...tab,
              items: [...tab.items, newItem],
            };
          }),
        }));
      },

      updateItemQuantity: (productId, unitId, quantity) => {
        const cleanQty = Math.floor(quantity);
        if (cleanQty <= 0) {
          get().removeItem(productId, unitId);
          return;
        }
        set((state) => ({
          tabs: state.tabs.map((tab) => {
            if (tab.id !== state.activeTabId) {
              return tab;
            }
            return {
              ...tab,
              items: tab.items.map((item) =>
                item.productId === productId && item.unitId === unitId
                  ? recomputeCartItem({ ...item, quantity: cleanQty })
                  : item
              ),
            };
          }),
        }));
      },

      setItemCustomPrice: (productId, unitId, customPrice) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => {
            if (tab.id !== state.activeTabId) {
              return tab;
            }
            return {
              ...tab,
              items: tab.items.map((item) => {
                if (item.productId !== productId || item.unitId !== unitId) {
                  return item;
                }
                if (
                  customPrice === null ||
                  !Number.isFinite(customPrice) ||
                  customPrice < 0
                ) {
                  return recomputeCartItem({
                    ...item,
                    isCustomPrice: false,
                    customPrice: undefined,
                  });
                }
                return recomputeCartItem({
                  ...item,
                  isCustomPrice: true,
                  customPrice: Math.round(customPrice),
                });
              }),
            };
          }),
        }));
      },

      switchItemUnit: (productId, fromUnitId, targetUnit) => {
        if (fromUnitId === targetUnit.unitId) {
          return;
        }
        set((state) => ({
          tabs: state.tabs.map((tab) => {
            if (tab.id !== state.activeTabId) {
              return tab;
            }
            const sourceItem = tab.items.find(
              (item) =>
                item.productId === productId && item.unitId === fromUnitId
            );
            if (!sourceItem) {
              return tab;
            }
            const existingTarget = tab.items.find(
              (item) =>
                item.productId === productId &&
                item.unitId === targetUnit.unitId
            );

            if (existingTarget) {
              const mergedQty = existingTarget.quantity + sourceItem.quantity;
              const nextItems = tab.items
                .filter(
                  (item) =>
                    !(item.productId === productId && item.unitId === fromUnitId)
                )
                .map((item) =>
                  item.productId === productId &&
                  item.unitId === targetUnit.unitId
                    ? recomputeCartItem({ ...item, quantity: mergedQty })
                    : item
                );
              return { ...tab, items: nextItems };
            }

            const nextItems = tab.items.map((item) => {
              if (item.productId !== productId || item.unitId !== fromUnitId) {
                return item;
              }
              return recomputeCartItem({
                ...item,
                unitId: targetUnit.unitId,
                unitName: targetUnit.unitName,
                conversionFactor: targetUnit.conversionFactor,
                baseUnitPrice: targetUnit.sellingPrice,
                wholesaleTiers: targetUnit.wholesaleTiers ?? [],
                isCustomPrice: false,
                customPrice: undefined,
              });
            });
            return { ...tab, items: nextItems };
          }),
        }));
      },

      removeItem: (productId, unitId) => {
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === state.activeTabId
              ? {
                  ...tab,
                  items: tab.items.filter(
                    (item) =>
                      !(item.productId === productId && item.unitId === unitId)
                  ),
                }
              : tab
          ),
        }));
      },

      setDiscount: (discount) => {
        const clean = Number.isFinite(discount)
          ? Math.max(0, Math.round(discount))
          : 0;
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === state.activeTabId ? { ...tab, discount: clean } : tab
          ),
        }));
      },

      completeCheckoutTab: (tabId) => {
        get().removeTab(tabId);
      },

      resetAllTabsForTest: () => {
        const fresh = createEmptyTab(1, Date.now());
        set({
          tabs: [fresh],
          activeTabId: fresh.id,
        });
      },
    }),
    {
      name: POS_TABS_STORAGE_KEY,
      storage: createJSONStorage(() => kvStateStorage),
      partialize: (state) => ({
        tabs: state.tabs,
        activeTabId: state.activeTabId,
      }),
    }
  )
);

export function selectHeldOrdersCount(state: PosCartState): number {
  return state.tabs.filter((t) => t.items.length > 0).length;
}
