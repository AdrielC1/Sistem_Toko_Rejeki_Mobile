import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSyncEngine } from "@/context/SyncEngineContext";
import {
  getCatalogCategories,
  getCatalogUnits,
  queryCatalogProductsPage,
  type ProductSortMode,
} from "@/db/catalogRepo";
import { subscribeCatalogChanged } from "@/sync/catalogEvents";
import type { Category, Product, Unit } from "@/types";

export const CATALOG_PAGE_SIZE = 50;

export interface UsePaginatedCatalogOptions {
  searchQuery?: string;
  categoryId?: string;
  sortMode?: ProductSortMode;
  includeInactive?: boolean;
  pageSize?: number;
}

export interface PaginatedCatalogSnapshot {
  products: Product[];
  totalCount: number;
  unfilteredTotalCount: number;
  hasMore: boolean;
  categories: Category[];
  units: Unit[];
  isLoading: boolean;
  isLoadingMore: boolean;
  loadMore: () => Promise<void>;
  reload: () => Promise<void>;
}

export function usePaginatedCatalog(
  options: UsePaginatedCatalogOptions = {}
): PaginatedCatalogSnapshot {
  const { role } = useAuth();
  const { catalogVersion } = useSyncEngine();

  const searchQuery = options.searchQuery ?? "";
  const categoryId = options.categoryId ?? "all";
  const sortMode: ProductSortMode = options.sortMode ?? "az";
  const includeInactive = options.includeInactive ?? false;
  const pageSize = options.pageSize ?? CATALOG_PAGE_SIZE;

  const [products, setProducts] = useState<Product[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [unfilteredTotalCount, setUnfilteredTotalCount] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

  const requestEpochRef = useRef<number>(0);
  const loadingMoreRef = useRef<boolean>(false);

  const loadFirstPage = useCallback(async () => {
    const epoch = ++requestEpochRef.current;
    loadingMoreRef.current = false;

    try {
      const [page, cats, uns] = await Promise.all([
        queryCatalogProductsPage(role, {
          searchQuery,
          categoryId,
          sortMode,
          includeInactive,
          limit: pageSize,
          offset: 0,
        }),
        getCatalogCategories({ includeInactive }),
        getCatalogUnits({ includeInactive }),
      ]);

      if (epoch !== requestEpochRef.current) {
        return;
      }

      setProducts(page.items);
      setTotalCount(page.totalCount);
      setUnfilteredTotalCount(page.unfilteredTotalCount);
      setHasMore(page.hasMore);
      setCategories(cats);
      setUnits(uns);
    } finally {
      if (epoch === requestEpochRef.current) {
        setIsLoadingMore(false);
        setIsLoading(false);
      }
    }
  }, [categoryId, includeInactive, pageSize, role, searchQuery, sortMode]);

  useEffect(() => {
    let active = true;
    const epoch = ++requestEpochRef.current;
    loadingMoreRef.current = false;

    void (async () => {
      try {
        const [page, cats, uns] = await Promise.all([
          queryCatalogProductsPage(role, {
            searchQuery,
            categoryId,
            sortMode,
            includeInactive,
            limit: pageSize,
            offset: 0,
          }),
          getCatalogCategories({ includeInactive }),
          getCatalogUnits({ includeInactive }),
        ]);

        if (!active || epoch !== requestEpochRef.current) {
          return;
        }

        setProducts(page.items);
        setTotalCount(page.totalCount);
        setUnfilteredTotalCount(page.unfilteredTotalCount);
        setHasMore(page.hasMore);
        setCategories(cats);
        setUnits(uns);
      } finally {
        if (active && epoch === requestEpochRef.current) {
          setIsLoadingMore(false);
          setIsLoading(false);
        }
      }
    })();

    const unsub = subscribeCatalogChanged(() => {
      if (active) {
        void loadFirstPage();
      }
    });

    return () => {
      active = false;
      unsub();
    };
  }, [
    catalogVersion,
    categoryId,
    includeInactive,
    loadFirstPage,
    pageSize,
    role,
    searchQuery,
    sortMode,
  ]);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore) {
      return;
    }
    const epoch = requestEpochRef.current;
    loadingMoreRef.current = true;
    setIsLoadingMore(true);

    try {
      const page = await queryCatalogProductsPage(role, {
        searchQuery,
        categoryId,
        sortMode,
        includeInactive,
        limit: pageSize,
        offset: products.length,
      });

      if (epoch !== requestEpochRef.current) {
        return;
      }

      setProducts((prev) => {
        const seen = new Set(prev.map((item) => item.id));
        const next = [...prev];
        for (const item of page.items) {
          if (!seen.has(item.id)) {
            seen.add(item.id);
            next.push(item);
          }
        }
        return next;
      });
      setTotalCount(page.totalCount);
      setUnfilteredTotalCount(page.unfilteredTotalCount);
      setHasMore(page.hasMore);
    } finally {
      if (epoch === requestEpochRef.current) {
        loadingMoreRef.current = false;
        setIsLoadingMore(false);
      }
    }
  }, [
    categoryId,
    hasMore,
    includeInactive,
    pageSize,
    products.length,
    role,
    searchQuery,
    sortMode,
  ]);

  return {
    products,
    totalCount,
    unfilteredTotalCount,
    hasMore,
    categories,
    units,
    isLoading,
    isLoadingMore,
    loadMore,
    reload: loadFirstPage,
  };
}
