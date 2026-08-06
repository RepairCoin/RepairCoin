import { formatCents, type PosSale } from "@/services/api/pos";

const TENDER_LABELS: Record<string, string> = {
  card: "Card",
  cash: "Cash",
  gift_card: "Gift card",
  rcn: "RCN",
  other: "Payment",
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

interface PrintOptions {
  sale: PosSale;
  shopName?: string | null;
  locationName?: string | null;
}

/**
 * Sized for an 80mm thermal roll — the printer a counter actually has — with `size: auto` height so
 * the roll cuts at the end of the receipt rather than after a page of blank paper. On an A4 printer
 * it simply prints narrow, which is the harmless case.
 */
function receiptHtml({ sale, shopName, locationName }: PrintOptions): string {
  const settled = sale.payments.filter((p) => p.status === "succeeded");
  const changeCents = settled.reduce((sum, p) => sum + (p.changeCents ?? 0), 0);

  const row = (label: string, value: string, cls = "") =>
    `<div class="row ${cls}"><span>${label}</span><span>${value}</span></div>`;

  const items = sale.items
    .map((item) => {
      const qty =
        item.quantity > 1
          ? `<div class="qty">${item.quantity} × ${formatCents(item.unitPriceCents)}</div>`
          : "";
      return `<div class="item">
        ${row(escapeHtml(item.name), formatCents(item.totalCents))}
        ${qty}
      </div>`;
    })
    .join("");

  const tenders = settled
    .map((p) => row(TENDER_LABELS[p.method] ?? "Payment", formatCents(p.amountCents)))
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <title>Receipt${sale.saleNumber ? ` #${sale.saleNumber}` : ""}</title>
  <style>
    @page { size: 80mm auto; margin: 4mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 72mm;
      font-family: ui-monospace, "Courier New", monospace;
      font-size: 12px;
      line-height: 1.45;
      color: #000;
      background: #fff;
    }
    .center { text-align: center; }
    .shop { font-size: 15px; font-weight: bold; }
    .muted { color: #444; font-size: 11px; }
    .rule { border-top: 1px dashed #000; margin: 8px 0; }
    .row { display: flex; justify-content: space-between; gap: 8px; }
    .row span:last-child { white-space: nowrap; }
    .item { margin-bottom: 4px; break-inside: avoid; }
    .qty { color: #444; font-size: 11px; }
    .total { font-size: 14px; font-weight: bold; }
    .footer { margin-top: 10px; font-size: 11px; }
  </style>
</head>
<body>
  <div class="center">
    <div class="shop">${escapeHtml(shopName || "Receipt")}</div>
    ${locationName ? `<div class="muted">${escapeHtml(locationName)}</div>` : ""}
    <div class="muted">${sale.saleNumber ? `Sale #${sale.saleNumber}` : ""}</div>
    <div class="muted">${new Date().toLocaleString()}</div>
  </div>

  <div class="rule"></div>
  ${items}
  <div class="rule"></div>

  ${row("Subtotal", formatCents(sale.subtotalCents))}
  ${sale.discountCents > 0 ? row("Discount", `-${formatCents(sale.discountCents)}`) : ""}
  ${sale.taxCents > 0 ? row("Tax", formatCents(sale.taxCents)) : ""}
  ${row("Total", formatCents(sale.totalCents), "total")}

  <div class="rule"></div>
  ${tenders}
  ${changeCents > 0 ? row("Change", formatCents(changeCents)) : ""}

  <div class="center footer">
    ${sale.receiptEmail ? `<div>Emailed to ${escapeHtml(sale.receiptEmail)}</div>` : ""}
    <div>Thank you!</div>
  </div>
</body>
</html>`;
}

/**
 * Prints through a hidden iframe rather than a popup window. A till behind a popup blocker would
 * otherwise be unable to hand the customer a receipt, and the cashier has no way to know why.
 */
export function printPosReceipt(options: PrintOptions): void {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(frame);

  const doc = frame.contentWindow?.document;
  if (!doc) {
    frame.remove();
    return;
  }

  doc.open();
  doc.write(receiptHtml(options));
  doc.close();

  const view = frame.contentWindow;
  if (!view) {
    frame.remove();
    return;
  }

  // Removing the frame while the dialog is still open cancels the print, so cleanup waits for
  // onafterprint. The backstop covers a browser that never fires it — a stray zero-size iframe is
  // a smaller problem than a receipt that doesn't print.
  view.onafterprint = () => setTimeout(() => frame.remove(), 500);
  setTimeout(() => frame.remove(), 60_000);

  view.focus();
  view.print();
}
