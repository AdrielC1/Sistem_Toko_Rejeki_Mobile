import { formatRupiah, formatWibDateTime } from "@/domain/format";
import type { CompletedOrder } from "@/domain/pricing";
import type { ReceiptItemConfig, ReceiptSection } from "@/types";

export const DEFAULT_RECEIPT_SECTIONS: ReceiptSection[] = [
  { id: "header", type: "header", title: "Header Toko", enabled: true },
  { id: "meta", type: "meta", title: "Info Nota", enabled: true },
  { id: "items", type: "items", title: "Daftar Belanja", enabled: true },
  { id: "totals", type: "totals", title: "Ringkasan Total", enabled: true },
  { id: "footer", type: "footer", title: "Catatan Kaki", enabled: true },
];

export const DEFAULT_RECEIPT_ITEM_CONFIG: Required<ReceiptItemConfig> = {
  showSku: false,
  showUnitPrice: true,
  showDiscountLine: true,
  showWholesaleBadge: true,
};

export interface RenderedReceiptLine {
  key: string;
  kind: "text" | "divider" | "kv" | "item";
  align?: "left" | "center" | "right";
  bold?: boolean;
  fontSize?: "sm" | "md" | "lg";
  text?: string;
  leftText?: string;
  rightText?: string;
}

export function resolveReceiptSections(
  sections?: ReceiptSection[]
): ReceiptSection[] {
  return sections && sections.length > 0 ? sections : DEFAULT_RECEIPT_SECTIONS;
}

export function resolveReceiptItemConfig(
  cfg?: ReceiptItemConfig
): Required<ReceiptItemConfig> {
  return {
    showSku: cfg?.showSku ?? DEFAULT_RECEIPT_ITEM_CONFIG.showSku,
    showUnitPrice:
      cfg?.showUnitPrice ?? DEFAULT_RECEIPT_ITEM_CONFIG.showUnitPrice,
    showDiscountLine:
      cfg?.showDiscountLine ?? DEFAULT_RECEIPT_ITEM_CONFIG.showDiscountLine,
    showWholesaleBadge:
      cfg?.showWholesaleBadge ?? DEFAULT_RECEIPT_ITEM_CONFIG.showWholesaleBadge,
  };
}

function interpolatePlaceholders(text: string, order: CompletedOrder): string {
  return text
    .replace(/\{\{storeName\}\}/g, order.storeName)
    .replace(/\{\{orderNumber\}\}/g, order.orderNumber)
    .replace(/\{\{cashierName\}\}/g, order.cashierName)
    .replace(/\{\{date\}\}/g, formatWibDateTime(order.date))
    .replace(/\{\{grandTotal\}\}/g, formatRupiah(order.grandTotal));
}

export function buildReceiptRenderLines(
  order: CompletedOrder
): RenderedReceiptLine[] {
  const sections = resolveReceiptSections(order.receiptSections);
  const itemCfg = resolveReceiptItemConfig(order.receiptItemConfig);
  const lines: RenderedReceiptLine[] = [];
  let seq = 0;

  const pushDivider = () => {
    seq += 1;
    lines.push({ key: `div-${seq}`, kind: "divider" });
  };

  for (const section of sections) {
    if (!section.enabled) {
      continue;
    }

    if (section.type === "header") {
      seq += 1;
      lines.push({
        key: `hdr-name-${seq}`,
        kind: "text",
        align: "center",
        bold: true,
        fontSize: "lg",
        text: order.storeName,
      });
      if (order.storeAddress) {
        seq += 1;
        lines.push({
          key: `hdr-addr-${seq}`,
          kind: "text",
          align: "center",
          fontSize: "sm",
          text: order.storeAddress,
        });
      }
      if (order.storePhone) {
        seq += 1;
        lines.push({
          key: `hdr-phone-${seq}`,
          kind: "text",
          align: "center",
          fontSize: "sm",
          text: `Telp: ${order.storePhone}`,
        });
      }
      if (section.lines) {
        for (const customLine of section.lines) {
          seq += 1;
          lines.push({
            key: `hdr-line-${seq}`,
            kind: "text",
            align: customLine.align,
            bold: customLine.bold,
            fontSize: customLine.fontSize ?? "sm",
            text: interpolatePlaceholders(customLine.text, order),
          });
        }
      }
      pushDivider();
    } else if (section.type === "meta") {
      seq += 1;
      lines.push({
        key: `meta-no-${seq}`,
        kind: "kv",
        leftText: "No. Nota",
        rightText: order.orderNumber,
      });
      seq += 1;
      lines.push({
        key: `meta-date-${seq}`,
        kind: "kv",
        leftText: "Tanggal",
        rightText: formatWibDateTime(order.date),
      });
      seq += 1;
      lines.push({
        key: `meta-cashier-${seq}`,
        kind: "kv",
        leftText: "Kasir",
        rightText: order.cashierName,
      });
      pushDivider();
    } else if (section.type === "items") {
      for (const item of order.items) {
        seq += 1;
        const badgeText =
          itemCfg.showWholesaleBadge && (item.wholesaleSavings ?? 0) > 0
            ? " [Grosir]"
            : item.isCustomPrice
              ? " [Khusus]"
              : "";
        lines.push({
          key: `item-title-${seq}`,
          kind: "text",
          align: "left",
          bold: true,
          fontSize: "sm",
          text: `${item.productName}${badgeText}`,
        });

        if (itemCfg.showSku && item.sku) {
          seq += 1;
          lines.push({
            key: `item-sku-${seq}`,
            kind: "text",
            align: "left",
            fontSize: "sm",
            text: `SKU: ${item.sku}`,
          });
        }

        const qtyDesc = itemCfg.showUnitPrice
          ? `${item.quantity} ${item.unitName} x ${formatRupiah(item.effectiveUnitPrice)}`
          : `${item.quantity} ${item.unitName}`;

        seq += 1;
        lines.push({
          key: `item-kv-${seq}`,
          kind: "kv",
          leftText: qtyDesc,
          rightText: formatRupiah(item.subtotal),
        });
      }
      pushDivider();
    } else if (section.type === "totals") {
      seq += 1;
      lines.push({
        key: `tot-sub-${seq}`,
        kind: "kv",
        leftText: "Subtotal",
        rightText: formatRupiah(order.subtotal),
      });
      if (itemCfg.showDiscountLine && order.discount > 0) {
        seq += 1;
        lines.push({
          key: `tot-disc-${seq}`,
          kind: "kv",
          leftText: "Potongan Harga",
          rightText: `-${formatRupiah(order.discount)}`,
        });
      }
      seq += 1;
      lines.push({
        key: `tot-grand-${seq}`,
        kind: "kv",
        bold: true,
        fontSize: "lg",
        leftText: "TOTAL BAYAR",
        rightText: formatRupiah(order.grandTotal),
      });
      pushDivider();
    } else if (section.type === "footer") {
      const note =
        order.receiptFooterNote?.trim() ||
        "Terima kasih sudah berbelanja di toko kami.";
      seq += 1;
      lines.push({
        key: `ftr-note-${seq}`,
        kind: "text",
        align: "center",
        fontSize: "sm",
        text: note,
      });
      if (section.lines) {
        for (const line of section.lines) {
          seq += 1;
          lines.push({
            key: `ftr-line-${seq}`,
            kind: "text",
            align: line.align,
            bold: line.bold,
            fontSize: line.fontSize ?? "sm",
            text: interpolatePlaceholders(line.text, order),
          });
        }
      }
    } else if (section.type === "custom" && section.lines) {
      for (const line of section.lines) {
        seq += 1;
        lines.push({
          key: `cst-line-${seq}`,
          kind: "text",
          align: line.align,
          bold: line.bold,
          fontSize: line.fontSize ?? "sm",
          text: interpolatePlaceholders(line.text, order),
        });
      }
      pushDivider();
    }
  }

  return lines;
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
      if (line.kind === "kv") {
        const cls = line.bold ? "kv bold" : "kv";
        return `<div class="${cls}"><span>${escapeHtml(line.leftText ?? "")}</span><span>${escapeHtml(line.rightText ?? "")}</span></div>`;
      }
      const align = line.align ?? "left";
      const cls = [
        "line",
        `align-${align}`,
        line.bold ? "bold" : "",
        line.fontSize === "lg" ? "lg" : "",
      ]
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
  .lg { font-size: 14px; }
  .kv { display: flex; justify-content: space-between; gap: 6px; margin-bottom: 2px; }
  .divider { border-top: 1px dashed #000; margin: 6px 0; }
</style>
</head>
<body>
${htmlRows}
</body>
</html>`;
}
