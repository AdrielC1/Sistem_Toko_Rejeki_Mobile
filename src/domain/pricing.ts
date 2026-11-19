import type { Product, StoreSettings, WholesaleTier } from "@/types";

export interface SelectableProductUnit {
  unitId: string;
  unitName: string;
  conversionFactor: number;
  sellingPrice: number;
  wholesaleTiers: WholesaleTier[];
  isBaseUnit: boolean;
}

export interface CartItem {
  productId: string;
  productName: string;
  sku: string;
  unitId: string;
  unitName: string;
  conversionFactor: number;
  baseUnitPrice: number;
  customPrice?: number;
  isCustomPrice?: boolean;
  wholesaleTiers: WholesaleTier[];
  quantity: number;
  effectiveUnitPrice: number;
  subtotal: number;
  wholesaleSavings: number;
}

export interface OrderTab {
  id: string;
  label: string;
  items: CartItem[];
  discount: number;
  createdAt: string;
}

export interface CompletedOrderItem {
  productId?: string;
  sku?: string;
  productName: string;
  unitName: string;
  conversionFactor?: number;
  baseUnitPrice?: number;
  effectiveUnitPrice: number;
  quantity: number;
  subtotal: number;
  isCustomPrice?: boolean;
  wholesaleSavings?: number;
}

export interface CompletedOrder {
  orderNumber: string;
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  storeLogo?: string;
  cashierName: string;
  date: string;
  items: CompletedOrderItem[];
  subtotal: number;
  discount: number;
  grandTotal: number;
  cashGiven: number;
  change: number;
  receiptSections?: StoreSettings["receiptSections"];
  receiptItemConfig?: StoreSettings["receiptItemConfig"];
  receiptFooterNote?: string;
}

export const ORDER_MAX_ITEMS = 200;
export const ORDER_MAX_COPIES = 5;
export const DEFAULT_PRINT_COPIES = 2;

export function getAvailableUnitsForProduct(
  product: Product
): SelectableProductUnit[] {
  if (!product.isActive) {
    return [];
  }

  const units: SelectableProductUnit[] = [];
  const allowBase = product.sellBaseUnit !== false;
  const validBasePrice = product.isOpenPrice
    ? product.sellingPrice >= 0
    : product.sellingPrice > 0;

  if (allowBase && product.unitId && validBasePrice) {
    units.push({
      unitId: product.unitId,
      unitName: product.unitName?.trim() || "Pcs",
      conversionFactor: 1,
      sellingPrice: product.sellingPrice,
      wholesaleTiers: product.wholesaleTiers ?? [],
      isBaseUnit: true,
    });
  }

  for (const conv of product.unitConversions ?? []) {
    if (conv.isActive === false) {
      continue;
    }
    const validConvPrice = product.isOpenPrice
      ? conv.sellingPrice >= 0
      : conv.sellingPrice > 0;
    if (!conv.unitId || !validConvPrice) {
      continue;
    }
    if (units.some((u) => u.unitId === conv.unitId)) {
      continue;
    }
    units.push({
      unitId: conv.unitId,
      unitName: conv.unitName?.trim() || "Satuan",
      conversionFactor: Math.max(1, conv.conversionFactor || 1),
      sellingPrice: conv.sellingPrice,
      wholesaleTiers: conv.wholesaleTiers ?? [],
      isBaseUnit: false,
    });
  }

  return units;
}

export function calculateEffectiveUnitPrice(params: {
  baseUnitPrice: number;
  quantity: number;
  wholesaleTiers: WholesaleTier[];
  isCustomPrice?: boolean;
  customPrice?: number;
}): number {
  if (
    params.isCustomPrice &&
    typeof params.customPrice === "number" &&
    Number.isFinite(params.customPrice) &&
    params.customPrice >= 0
  ) {
    return Math.round(params.customPrice);
  }

  const qty = Math.max(1, params.quantity);
  let matchedPrice = params.baseUnitPrice;
  let highestMinQty = 0;

  for (const tier of params.wholesaleTiers ?? []) {
    if (qty >= tier.minQty && tier.minQty >= highestMinQty && tier.price >= 0) {
      highestMinQty = tier.minQty;
      matchedPrice = tier.price;
    }
  }

  return Math.round(matchedPrice);
}

export function recomputeCartItem(item: CartItem): CartItem {
  const quantity = Math.max(1, Math.floor(item.quantity));
  const effectiveUnitPrice = calculateEffectiveUnitPrice({
    baseUnitPrice: item.baseUnitPrice,
    quantity,
    wholesaleTiers: item.wholesaleTiers,
    isCustomPrice: item.isCustomPrice,
    customPrice: item.customPrice,
  });
  const subtotal = effectiveUnitPrice * quantity;
  const wholesaleSavings =
    !item.isCustomPrice && effectiveUnitPrice < item.baseUnitPrice
      ? (item.baseUnitPrice - effectiveUnitPrice) * quantity
      : 0;

  return {
    ...item,
    quantity,
    effectiveUnitPrice,
    subtotal,
    wholesaleSavings,
  };
}

export function calculateCartSummary(
  items: CartItem[],
  rawDiscount: number
): {
  itemCount: number;
  totalQuantity: number;
  subtotal: number;
  discount: number;
  grandTotal: number;
  totalWholesaleSavings: number;
} {
  let subtotal = 0;
  let totalQuantity = 0;
  let totalWholesaleSavings = 0;

  for (const item of items) {
    subtotal += item.subtotal;
    totalQuantity += item.quantity;
    totalWholesaleSavings += item.wholesaleSavings;
  }

  const cleanDiscount = Math.max(
    0,
    Math.min(subtotal, Number.isFinite(rawDiscount) ? Math.round(rawDiscount) : 0)
  );
  const grandTotal = Math.max(0, subtotal - cleanDiscount);

  return {
    itemCount: items.length,
    totalQuantity,
    subtotal,
    discount: cleanDiscount,
    grandTotal,
    totalWholesaleSavings,
  };
}

export function generateOrderNumber(nowMs: number = Date.now()): string {
  const wib = new Date(nowMs + 7 * 60 * 60 * 1000);
  const yy = String(wib.getUTCFullYear()).slice(-2);
  const mm = String(wib.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(wib.getUTCDate()).padStart(2, "0");
  const hh = String(wib.getUTCHours()).padStart(2, "0");
  const min = String(wib.getUTCMinutes()).padStart(2, "0");
  const sec = String(wib.getUTCSeconds()).padStart(2, "0");
  const suffix = String(Math.floor(100 + Math.random() * 900));
  return `TRX-${yy}${mm}${dd}-${hh}${min}${sec}-${suffix}`;
}

export function validateOrderForCheckout(
  items: CartItem[],
  discount: number
): { ok: true } | { ok: false; error: string } {
  if (!items || items.length === 0) {
    return { ok: false, error: "Keranjang belanja masih kosong." };
  }
  if (items.length > ORDER_MAX_ITEMS) {
    return {
      ok: false,
      error: `Maksimal ${ORDER_MAX_ITEMS} baris item per transaksi.`,
    };
  }
  const summary = calculateCartSummary(items, discount);
  if (discount < 0 || discount > summary.subtotal) {
    return {
      ok: false,
      error: "Potongan harga tidak boleh melebihi subtotal belanja.",
    };
  }
  return { ok: true };
}

/**
 * Builds strict web-parity CompletedOrder payload (`cashGiven = grandTotal`, `change = 0`).
 */
export function buildCompletedOrderPayload(params: {
  items: CartItem[];
  discount: number;
  cashierName: string;
  storeSettings: StoreSettings | null;
  orderNumber?: string;
  dateIso?: string;
}): CompletedOrder {
  const summary = calculateCartSummary(params.items, params.discount);
  const dateIso = params.dateIso ?? new Date().toISOString();

  return {
    orderNumber: params.orderNumber ?? generateOrderNumber(),
    storeName: params.storeSettings?.storeName?.trim() || "Toko Rejeki",
    storeAddress: params.storeSettings?.storeAddress,
    storePhone: params.storeSettings?.storePhone,
    storeLogo: params.storeSettings?.storeLogo,
    cashierName: params.cashierName?.trim() || "Kasir",
    date: dateIso,
    items: params.items.map((item) => ({
      productId: item.productId,
      sku: item.sku,
      productName: item.productName,
      unitName: item.unitName,
      conversionFactor: item.conversionFactor,
      baseUnitPrice: item.baseUnitPrice,
      effectiveUnitPrice: item.effectiveUnitPrice,
      quantity: item.quantity,
      subtotal: item.subtotal,
      isCustomPrice: Boolean(item.isCustomPrice),
      wholesaleSavings: item.wholesaleSavings,
    })),
    subtotal: summary.subtotal,
    discount: summary.discount,
    grandTotal: summary.grandTotal,
    cashGiven: summary.grandTotal,
    change: 0,
    receiptSections: params.storeSettings?.receiptSections,
    receiptItemConfig: params.storeSettings?.receiptItemConfig,
    receiptFooterNote: params.storeSettings?.receiptFooterNote,
  };
}
