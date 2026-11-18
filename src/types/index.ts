export type UserRole = "owner" | "admin" | "kasir";

export interface AuthSessionUser {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  sessionStamp?: string;
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
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  offline?: boolean;
  retryAfter?: number;
}

export interface ConnectionTestResult {
  ok: boolean;
  latencyMs: number;
  storeSettings?: StoreSettings;
  offlineDb?: boolean;
  error?: string;
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
