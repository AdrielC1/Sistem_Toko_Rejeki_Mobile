import type { CompletedOrder } from "@/domain/pricing";
import {
  buildReceiptRenderLines,
  getWidthForReceiptSize,
  type NormalizedReceiptSize,
} from "@/domain/receiptLayout";

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

function asciiEncode(text: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    bytes.push(code >= 0x20 && code <= 0x7e ? code : 0x3f);
  }
  return bytes;
}

function padColumns(left: string, right: string, width: number): string {
  const maxLeft = Math.max(4, width - right.length - 1);
  const clippedLeft =
    left.length > maxLeft ? left.slice(0, maxLeft) : left;
  const spaces = Math.max(1, width - clippedLeft.length - right.length);
  return `${clippedLeft}${" ".repeat(spaces)}${right}`;
}

function applySizeCmds(size?: NormalizedReceiptSize): number[] {
  if (size === "small") {
    return [ESC, 0x4d, 0x01, GS, 0x21, 0x00]; // Font B, Normal 1x1
  }
  if (size === "medium") {
    return [ESC, 0x4d, 0x01, GS, 0x21, 0x11]; // Font B, Double 2x2
  }
  if (size === "large") {
    return [ESC, 0x4d, 0x00, GS, 0x21, 0x11]; // Font A, Double 2x2
  }
  return [ESC, 0x4d, 0x00, GS, 0x21, 0x00]; // Font A, Normal 1x1
}

function resetSizeCmds(size?: NormalizedReceiptSize): number[] {
  if (size === "small" || size === "medium" || size === "large") {
    return [ESC, 0x4d, 0x00, GS, 0x21, 0x00];
  }
  return [];
}

/**
 * Encodes a `CompletedOrder` into raw ESC/POS byte buffer matching web `escpos.ts`
 * (`58mm` = 32 chars/line, `80mm` = 48 chars/line), with 2 extra blank feed lines
 * at the bottom so the paper cutter does not slice into the footer text.
 */
export function buildEscPosReceiptBytes(
  order: CompletedOrder,
  options?: { paperWidthMm?: number; copies?: number }
): Uint8Array {
  const paperWidthMm = options?.paperWidthMm ?? 58;
  const copies = Math.max(1, Math.min(5, options?.copies ?? 1));
  const cols = paperWidthMm >= 80 ? 48 : 32;
  const lines = buildReceiptRenderLines(order);

  const singleCopyBytes: number[] = [
    ESC,
    0x40, // Initialize printer
  ];

  for (const line of lines) {
    if (line.kind === "divider") {
      singleCopyBytes.push(ESC, 0x61, 0x00, ESC, 0x45, 0x00);
      singleCopyBytes.push(...applySizeCmds("normal"));
      singleCopyBytes.push(...asciiEncode("-".repeat(cols)), LF);
      continue;
    }

    const lineSize: NormalizedReceiptSize =
      line.size ?? (line.fontSize === "lg" ? "large" : line.fontSize === "sm" ? "small" : "normal");

    if (line.kind === "kv") {
      const effectiveCols = getWidthForReceiptSize(cols, lineSize);
      const formatted = padColumns(
        line.leftText ?? "",
        line.rightText ?? "",
        effectiveCols
      );
      singleCopyBytes.push(
        ESC,
        0x61,
        0x00,
        ESC,
        0x45,
        line.bold ? 0x01 : 0x00,
        ...applySizeCmds(lineSize)
      );
      singleCopyBytes.push(...asciiEncode(formatted), LF);
      singleCopyBytes.push(...resetSizeCmds(lineSize));
      continue;
    }

    const alignByte =
      line.align === "center" ? 0x01 : line.align === "right" ? 0x02 : 0x00;
    singleCopyBytes.push(
      ESC,
      0x61,
      alignByte,
      ESC,
      0x45,
      line.bold ? 0x01 : 0x00,
      ...applySizeCmds(lineSize)
    );
    singleCopyBytes.push(...asciiEncode(line.text ?? ""), LF);
    singleCopyBytes.push(...resetSizeCmds(lineSize));
  }

  singleCopyBytes.push(
    ESC,
    0x45,
    0x00,
    ESC,
    0x61,
    0x00,
    ...resetSizeCmds("large"),
    LF,
    LF,
    LF,
    LF, // Extra line 1 for mobile cutter clearance
    LF, // Extra line 2 for mobile cutter clearance
    GS,
    0x56,
    0x00 // Full paper cut
  );

  const out: number[] = [];
  for (let c = 0; c < copies; c++) {
    out.push(...singleCopyBytes);
  }
  return new Uint8Array(out);
}
