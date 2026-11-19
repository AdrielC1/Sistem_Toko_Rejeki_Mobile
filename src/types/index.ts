export type UserRole = "owner" | "admin" | "kasir";

export interface AuthSessionUser {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  sessionStamp?: string;
}

export type ReceiptFontSize = "sm" | "md" | "lg";

export interface ReceiptLine {
  text: string;
  align: "left" | "center" | "right";
  bold?: boolean;
  fontSize?: ReceiptFontSize;
}

export interface ReceiptItemConfig {
  showSku?: boolean;
  showUnitPrice?: boolean;
  showDiscountLine?: boolean;
  showWholesaleBadge?: boolean;
}

export interface ReceiptSection {
  id: string;
  type: "header" | "meta" | "items" | "totals" | "footer" | "custom";
  title?: string;
  enabled: boolean;
  lines?: ReceiptLine[];
}

export interface StoreSettings {
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  storeLogo?: string;
  previewReceiptBeforePrint?: boolean;
  printerPaperWidth?: number;
  printerName?: string;
  printerType?: "usb" | "network";
  receiptFooterNote?: string;
  receiptSections?: ReceiptSection[];
  receiptItemConfig?: ReceiptItemConfig;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  offline?: boolean;
  retryAfter?: number;
}

export type ServerRoute = "lan" | "cloud";

export interface ServerUrlConfig {
  primaryUrl: string | null;
  fallbackUrl: string | null;
}

export interface ConnectionTestResult {
  ok: boolean;
  latencyMs: number;
  storeSettings?: StoreSettings;
  offlineDb?: boolean;
  error?: string;
  routeUsed?: ServerRoute;
  lanAttemptError?: string;
}

export type LoginAttemptResult =
  | {
      ok: true;
      user: AuthSessionUser;
    }
  | {
      ok: false;
      status: number;
      error: string;
      retryAfterSeconds?: number;
    };

export interface RoleCapabilities {
  canEditProducts: boolean;
  canViewCostPrice: boolean;
  canManageStore: boolean;
  isReadOnlyCatalog: boolean;
}

export interface Category {
  id: string;
  name: string;
  description?: string | null;
  isActive?: boolean;
  productCount?: number;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Unit {
  id: string;
  name: string;
  symbol?: string;
  description?: string | null;
  isActive?: boolean;
  productCount?: number;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface WholesaleTier {
  id?: string;
  minQty: number;
  price: number;
  specialPrice?: number;
  unitName?: string;
  productUnitId?: string;
}

export interface ProductUnit {
  id: string;
  unitId: string;
  unitName: string;
  conversionFactor: number;
  costPrice?: number;
  sellingPrice: number;
  isActive?: boolean;
  wholesaleTiers?: WholesaleTier[];
}

export interface Product {
  id: string;
  sku: string;
  barcode?: string | null;
  name: string;
  description?: string | null;
  categoryId: string;
  categoryName?: string;
  unitId: string;
  unitName?: string;
  costPrice?: number;
  sellingPrice: number;
  isOpenPrice?: boolean;
  sellBaseUnit?: boolean;
  stock: number;
  imageUrl?: string | null;
  isActive: boolean;
  unitConversions: ProductUnit[];
  wholesaleTiers: WholesaleTier[];
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CatalogProduct = Product;

export interface HealthStatusSnapshot {
  serverReachable: boolean;
  dbOnline: boolean;
  readOnly: boolean;
  latencyMs: number | null;
  serverTime: string | null;
  usedRoute: ServerRoute | null;
}

export interface CatalogCounts {
  products: number;
  categories: number;
  units: number;
}

export interface SyncAuditRecord {
  id: number;
  syncType: "full" | "delta";
  triggerSource:
    | "boot"
    | "scheduled_10am_wib"
    | "stale_48h"
    | "foreground"
    | "manual"
    | "db_reconnected";
  usedRoute: ServerRoute | null;
  productCount: number;
  deletedCount: number;
  serverTime: string | null;
  status: "success" | "skipped" | "error";
  errorMessage: string | null;
  createdAt: string;
}

export interface SyncResult {
  synced: boolean;
  mode: "full" | "delta" | "skipped";
  trigger: SyncAuditRecord["triggerSource"];
  upsertedProducts: number;
  deletedProducts: number;
  serverTime: string | null;
  usedRoute: ServerRoute | null;
  error?: string;
}

export interface SyncFullResponse {
  products: Product[];
  categories: Category[];
  units: Unit[];
  serverTime: string;
  totalProducts: number;
  isChunked?: boolean;
}

export interface SyncDeltaResponse {
  products: Product[];
  deletedProductIds: string[];
  categories: Category[];
  deletedCategoryIds: string[];
  units: Unit[];
  deletedUnitIds: string[];
  serverTime: string;
  hasChanges: boolean;
}
