import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSyncEngine } from "@/context/SyncEngineContext";
import {
  getCatalogCategories,
  getCatalogProducts,
  getCatalogUnits,
} from "@/db/catalogRepo";
import { subscribeCatalogChanged } from "@/sync/catalogEvents";
import type { Category, Product, Unit } from "@/types";

export interface LocalCatalogSnapshot {
  products: Product[];
  categories: Category[];
  units: Unit[];
  isLoading: boolean;
  reload: () => Promise<void>;
}

export function useLocalCatalog(options?: {
  includeInactive?: boolean;
}): LocalCatalogSnapshot {
  const { role } = useAuth();
  const { catalogVersion } = useSyncEngine();
  const includeInactive = options?.includeInactive ?? false;

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadSnapshot = useCallback(async () => {
    try {
      const [prods, cats, uns] = await Promise.all([
        getCatalogProducts(role, { includeInactive }),
        getCatalogCategories({ includeInactive }),
        getCatalogUnits({ includeInactive }),
      ]);
      setProducts(prods);
      setCategories(cats);
      setUnits(uns);
    } finally {
      setIsLoading(false);
    }
  }, [includeInactive, role]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [prods, cats, uns] = await Promise.all([
          getCatalogProducts(role, { includeInactive }),
          getCatalogCategories({ includeInactive }),
          getCatalogUnits({ includeInactive }),
        ]);
        if (!active) {
          return;
        }
        setProducts(prods);
        setCategories(cats);
        setUnits(uns);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    })();

    const unsub = subscribeCatalogChanged(() => {
      if (active) {
        void loadSnapshot();
      }
    });

    return () => {
      active = false;
      unsub();
    };
  }, [catalogVersion, includeInactive, loadSnapshot, role]);

  return {
    products,
    categories,
    units,
    isLoading,
    reload: loadSnapshot,
  };
}
