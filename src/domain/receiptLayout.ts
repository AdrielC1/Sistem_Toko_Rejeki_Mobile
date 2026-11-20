import { formatRupiah, formatWibDateTime } from "@/domain/format";
import type { CompletedOrder } from "@/domain/pricing";
import type {
  ReceiptFontSize,
  ReceiptItemConfig,
  ReceiptLine,
  ReceiptSection,
} from "@/types";

export type NormalizedReceiptSize = "small" | "normal" | "medium" | "large";

export const DEFAULT_RECEIPT_SECTIONS: ReceiptSection[] = [
  { id: "header", type: "header", sectionType: "header", title: "Header Toko", enabled: true },
  { id: "items", type: "items", title: "Daftar Belanja", enabled: true },
  { id: "totals", type: "totals", title: "Ringkasan Total", enabled: true },
  { id: "footer", type: "footer", sectionType: "footer", title: "Catatan Kaki", enabled: true },
];

export interface RenderedReceiptLine {
  key: string;
  kind: "text" | "divider" | "kv" | "item";
  align?: "left" | "center" | "right";
  bold?: boolean;
  fontSize?: "sm" | "md" | "lg";
  size?: NormalizedReceiptSize;
  text?: string;
  leftText?: string;
  rightText?: string;
}

export function normalizeReceiptSize(
  raw?: ReceiptFontSize
): NormalizedReceiptSize {
  if (raw === "small" || raw === "sm") {
    return "small";
  }
  if (raw === "medium") {
    return "medium";
  }
  if (raw === "large" || raw === "lg") {
    return "large";
  }
  return "normal";
}

function toLegacyFontSize(size: NormalizedReceiptSize): "sm" | "md" | "lg" {
  if (size === "small") {
    return "sm";
  }
  if (size === "medium" || size === "large") {
    return "lg";
  }
  return "md";
}

export function getWidthForReceiptSize(
  baseCols: number,
  size: NormalizedReceiptSize = "normal"
): number {
  const totalDots = baseCols * 12;
  if (size === "small") {
    return Math.floor(totalDots / 9);
  }
  if (size === "medium") {
    return Math.floor(totalDots / 18);
  }
  if (size === "large") {
    return Math.floor(totalDots / 24);
  }
  return baseCols;
}

function interpolatePlaceholders(text: string, order: CompletedOrder): string {
  const formattedDate = formatWibDateTime(order.date);
  return text
    .replace(/\{invoice\}/g, order.orderNumber)
    .replace(/\{tanggal\}/g, formattedDate)
    .replace(/\{kasir\}/g, order.cashierName)
    .replace(/\{\{storeName\}\}/g, order.storeName)
    .replace(/\{\{orderNumber\}\}/g, order.orderNumber)
    .replace(/\{\{cashierName\}\}/g, order.cashierName)
    .replace(/\{\{date\}\}/g, formattedDate)
    .replace(/\{\{grandTotal\}\}/g, formatRupiah(order.grandTotal));
}

function pushCustomSectionLines(
  lines: ReceiptLine[],
  order: CompletedOrder,
  out: RenderedReceiptLine[],
  nextSeq: () => number
) {
  for (const line of lines) {
    if (line.type === "separator") {
      out.push({
        key: `sep-${nextSeq()}`,
        kind: "divider",
        text: line.separatorChar || "-",
      });
      continue;
    }

    const size = normalizeReceiptSize(line.size ?? line.fontSize);
    const fontSize = toLegacyFontSize(size);
    const align = line.align ?? "left";
    const bold = Boolean(line.bold);

    if (line.type === "key-value") {
      out.push({
        key: `ckv-${nextSeq()}`,
        kind: "kv",
        align,
        bold,
        size,
        fontSize,
        leftText: interpolatePlaceholders(line.label ?? "", order),
        rightText: interpolatePlaceholders(line.value ?? "", order),
      });
      continue;
    }

    out.push({
      key: `ctxt-${nextSeq()}`,
      kind: "text",
      align,
      bold,
      size,
      fontSize,
      text: interpolatePlaceholders(line.text ?? "", order),
    });
  }
}

export function buildReceiptRenderLines(
  order: CompletedOrder
): RenderedReceiptLine[] {
  const sections = order.receiptSections ?? [];
  const itemCfg: ReceiptItemConfig = order.receiptItemConfig ?? {};
  const out: RenderedReceiptLine[] = [];
  let seq = 0;
  const nextSeq = () => {
    seq += 1;
    return seq;
  };

  const pushDivider = () => {
    out.push({ key: `div-${nextSeq()}`, kind: "divider" });
  };

  const headerSection = sections.find(
    (s) =>
      (s.sectionType === "header" || s.type === "header") &&
      s.enabled !== false
  );
  const footerSection = sections.find(
    (s) =>
      (s.sectionType === "footer" || s.type === "footer") &&
      s.enabled !== false
  );

  // 1. Header Section (dari DB atau default web tanpa No. Nota paksa)
  if (headerSection?.lines && headerSection.lines.length > 0) {
    pushCustomSectionLines(headerSection.lines, order, out, nextSeq);
  } else {
    out.push({
      key: `hdr-name-${nextSeq()}`,
      kind: "text",
      align: "center",
      bold: true,
      size: "large",
      fontSize: "lg",
      text: order.storeName || "TOKO REJEKI",
    });
    if (order.storeAddress) {
      out.push({
        key: `hdr-addr-${nextSeq()}`,
        kind: "text",
        align: "center",
        size: "normal",
        fontSize: "md",
        text: order.storeAddress,
      });
    }
    if (order.storePhone) {
      out.push({
        key: `hdr-phone-${nextSeq()}`,
        kind: "text",
        align: "center",
        size: "normal",
        fontSize: "md",
        text: `Telp: ${order.storePhone}`,
      });
    }
    pushDivider();
    out.push({
      key: `hdr-date-${nextSeq()}`,
      kind: "text",
      align: "left",
      size: "normal",
      fontSize: "md",
      text: `Tgl: ${formatWibDateTime(order.date)}`,
    });
    pushDivider();
  }

  // 2. Rincian Produk
  const itemNameSize = normalizeReceiptSize(itemCfg.itemNameSize);
  const itemNameBold = itemCfg.itemNameBold !== false;
  const itemPriceSize = normalizeReceiptSize(itemCfg.itemPriceSize);
  const layoutStyle = itemCfg.layoutStyle ?? "standard-2-line";
  const showUnitPrice = itemCfg.showUnitPrice !== false;
  const showDiscountLine = itemCfg.showDiscountLine !== false;
  const showWholesaleBadge = itemCfg.showWholesaleBadge !== false;
  const showWholesalePerItem = itemCfg.showWholesaleDiscountPerItem !== false;
  const showWholesaleSummary = itemCfg.showWholesaleDiscountSummary !== false;
  const showSeparatorBetweenItems = Boolean(itemCfg.showSeparatorBetweenItems);

  let totalWholesaleSavings = 0;

  for (let i = 0; i < order.items.length; i++) {
    const item = order.items[i];
    const isLastItem = i === order.items.length - 1;
    const itemSavings = item.wholesaleSavings ?? 0;
    totalWholesaleSavings += itemSavings;

    const badgeText =
      showWholesaleBadge && itemSavings > 0
        ? " [Grosir]"
        : item.isCustomPrice
          ? " [Khusus]"
          : "";

    if (layoutStyle === "compact-1-line") {
      out.push({
        key: `item-compact-${nextSeq()}`,
        kind: "kv",
        align: "left",
        bold: itemNameBold,
        size: itemNameSize,
        fontSize: toLegacyFontSize(itemNameSize),
        leftText: `${item.productName}${badgeText} ${item.quantity}x${item.effectiveUnitPrice.toLocaleString("id-ID")}`,
        rightText: formatRupiah(item.subtotal),
      });
    } else {
      out.push({
        key: `item-title-${nextSeq()}`,
        kind: "text",
        align: "left",
        bold: itemNameBold,
        size: itemNameSize,
        fontSize: toLegacyFontSize(itemNameSize),
        text: `${item.productName}${badgeText}`,
      });

      if (itemCfg.showSku && item.sku) {
        out.push({
          key: `item-sku-${nextSeq()}`,
          kind: "text",
          align: "left",
          size: "small",
          fontSize: "sm",
          text: `SKU: ${item.sku}`,
        });
      }

      const qtyDesc = showUnitPrice
        ? `${item.quantity} ${item.unitName} x ${formatRupiah(item.effectiveUnitPrice)}`
        : `${item.quantity} ${item.unitName}`;

      out.push({
        key: `item-kv-${nextSeq()}`,
        kind: "kv",
        align: "left",
        bold: false,
        size: itemPriceSize,
        fontSize: toLegacyFontSize(itemPriceSize),
        leftText: qtyDesc,
        rightText: formatRupiah(item.subtotal),
      });
    }

    if (showWholesalePerItem && itemSavings > 0) {
      out.push({
        key: `item-ws-${nextSeq()}`,
        kind: "kv",
        align: "left",
        bold: false,
        size: itemPriceSize,
        fontSize: toLegacyFontSize(itemPriceSize),
        leftText: `  Hemat Grosir`,
        rightText: `(- ${formatRupiah(Math.round(itemSavings))})`,
      });
    }

    if (showSeparatorBetweenItems && !isLastItem) {
      pushDivider();
    }
  }

  pushDivider();

  // 3. Subtotal, Potongan, TOTAL (mengikuti ukuran & bold dari DB)
  const subtotalSize = normalizeReceiptSize(itemCfg.subtotalSize);
  const subtotalBold = itemCfg.subtotalBold === true;
  const totalSize = normalizeReceiptSize(itemCfg.totalSize ?? "large");
  const totalBold = itemCfg.totalBold !== false;

  if (showDiscountLine && order.discount > 0) {
    out.push({
      key: `tot-sub-${nextSeq()}`,
      kind: "kv",
      bold: subtotalBold,
      size: subtotalSize,
      fontSize: toLegacyFontSize(subtotalSize),
      leftText: "Subtotal",
      rightText: formatRupiah(order.subtotal),
    });
    out.push({
      key: `tot-disc-${nextSeq()}`,
      kind: "kv",
      bold: subtotalBold,
      size: subtotalSize,
      fontSize: toLegacyFontSize(subtotalSize),
      leftText: "Potongan",
      rightText: `-${formatRupiah(order.discount)}`,
    });
  }

  out.push({
    key: `tot-grand-${nextSeq()}`,
    kind: "kv",
    bold: totalBold,
    size: totalSize,
    fontSize: toLegacyFontSize(totalSize),
    leftText: "TOTAL",
    rightText: formatRupiah(order.grandTotal),
  });

  if (showWholesaleSummary && totalWholesaleSavings > 0) {
    out.push({
      key: `tot-ws-${nextSeq()}`,
      kind: "kv",
      bold: subtotalBold,
      size: subtotalSize,
      fontSize: toLegacyFontSize(subtotalSize),
      leftText: "Total Hemat Grosir",
      rightText: formatRupiah(totalWholesaleSavings),
    });
  }

  pushDivider();

  // 4. Footer Section (dari DB atau default)
  if (footerSection?.lines && footerSection.lines.length > 0) {
    pushCustomSectionLines(footerSection.lines, order, out, nextSeq);
  } else {
    const note =
      order.receiptFooterNote?.trim() ||
      "Terima kasih sudah berbelanja di toko kami.";
    out.push({
      key: `ftr-note-${nextSeq()}`,
      kind: "text",
      align: "center",
      size: "normal",
      fontSize: "md",
      text: note,
    });
  }

  return out;
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildReceiptHtml(
  order: CompletedOrder,
  paperWidthMm = 58
): string {
  const lines = buildReceiptRenderLines(order);
  const widthPx = paperWidthMm >= 80 ? 302 : 219;

  const htmlRows = lines
    .map((line) => {
      if (line.kind === "divider") {
        return `<div class="divider"></div>`;
      }
      const sizeCls =
        line.size === "large"
          ? "lg"
          : line.size === "medium"
            ? "md-lg"
            : line.size === "small"
              ? "sm"
              : "";
      if (line.kind === "kv") {
        const cls = ["kv", line.bold ? "bold" : "", sizeCls]
          .filter(Boolean)
          .join(" ");
        return `<div class="${cls}"><span>${escapeHtml(line.leftText ?? "")}</span><span>${escapeHtml(line.rightText ?? "")}</span></div>`;
      }
      const align = line.align ?? "left";
      const cls = ["line", `align-${align}`, line.bold ? "bold" : "", sizeCls]
        .filter(Boolean)
        .join(" ");
      return `<div class="${cls}">${escapeHtml(line.text ?? "")}</div>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { margin: 4mm; }
  body {
    font-family: 'Courier New', monospace;
    width: ${widthPx}px;
    margin: 0 auto;
    color: #000;
    font-size: 11px;
    line-height: 1.35;
  }
  .line { margin-bottom: 2px; word-break: break-word; }
  .align-center { text-align: center; }
  .align-right { text-align: right; }
  .align-left { text-align: left; }
  .bold { font-weight: 700; }
  .sm { font-size: 9px; }
  .md-lg { font-size: 13px; }
  .lg { font-size: 15px; }
  .kv { display: flex; justify-content: space-between; gap: 6px; margin-bottom: 2px; }
  .divider { border-top: 1px dashed #000; margin: 6px 0; }
</style>
</head>
<body>
${htmlRows}
</body>
</html>`;
}
