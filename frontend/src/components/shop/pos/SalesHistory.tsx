"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Mail, Printer, Receipt, RotateCcw, Search, Trash2, X } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import {
  formatCents,
  getSale,
  listSales,
  localDayEnd,
  localDayStart,
  refundSale,
  resendReceipt,
  voidSale,
  type PosSale,
  type PosSaleListRow,
  type PosSaleStatus,
} from "@/services/api/pos";
import { printPosReceipt } from "./printReceipt";

const INPUT =
  "h-10 w-full rounded-md border border-[#303236] bg-[#141414] px-3 text-sm text-white placeholder:text-[#6B6B6B] focus:border-[#FFCC00] focus:outline-none";

const PAGE_SIZE = 25;

const FILTERS: { label: string; status?: PosSaleStatus }[] = [
  { label: "All" },
  { label: "Completed", status: "completed" },
  { label: "Refunded", status: "refunded" },
  { label: "Open", status: "open" },
  { label: "Voided", status: "voided" },
];

const STATUS_STYLES: Record<PosSaleStatus, string> = {
  completed: "bg-[#22C55E]/15 text-[#22C55E]",
  partially_refunded: "bg-[#FFCC00]/15 text-[#FFCC00]",
  refunded: "bg-[#FFCC00]/15 text-[#FFCC00]",
  open: "bg-white/10 text-[#999999]",
  voided: "bg-white/10 text-[#6B6B6B]",
};

const STATUS_LABELS: Record<PosSaleStatus, string> = {
  completed: "Completed",
  partially_refunded: "Part refunded",
  refunded: "Refunded",
  open: "Open",
  voided: "Voided",
};

const TENDER_LABELS: Record<string, string> = {
  card: "Card",
  cash: "Cash",
  gift_card: "Gift card",
  rcn: "RCN",
  other: "Payment",
};

const shortAddress = (address: string): string =>
  `${address.slice(0, 6)}…${address.slice(-4)}`;

/**
 * The sales a shop has already rung up. Until this existed `listSales` had no caller at all, so a
 * counter sale was unreachable the moment its receipt left the screen — no lookup, no reprint, and
 * no way to clear a cart someone abandoned mid-sale.
 */
export function SalesHistory({
  locationId,
  locationName,
}: {
  locationId: string | null;
  locationName?: string | null;
}) {
  const [filter, setFilter] = useState(0);
  const [sales, setSales] = useState<PosSaleListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [openSaleId, setOpenSaleId] = useState<string | null>(null);

  // Draft vs applied: typing a sale number should not fire a request per keystroke, and a
  // half-typed date ("2026-08-0") is not a range anyone meant to search.
  const [saleNumberDraft, setSaleNumberDraft] = useState("");
  const [fromDraft, setFromDraft] = useState("");
  const [toDraft, setToDraft] = useState("");
  const [query, setQuery] = useState<{ saleNumber?: number; from?: string; to?: string }>({});

  const criteria = useMemo(
    () => ({
      status: FILTERS[filter].status,
      locationId,
      saleNumber: query.saleNumber,
      from: query.from,
      to: query.to,
    }),
    [filter, locationId, query]
  );

  const load = useCallback(() => {
    setLoading(true);
    return listSales({ ...criteria, limit: PAGE_SIZE })
      .then((page) => {
        setSales(page.sales);
        setTotal(page.total);
      })
      .catch(() => {
        setSales([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [criteria]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = () => {
    setLoadingMore(true);
    listSales({ ...criteria, limit: PAGE_SIZE, offset: sales.length })
      .then((page) => setSales((prev) => [...prev, ...page.sales]))
      .catch(() => undefined)
      .finally(() => setLoadingMore(false));
  };

  const applySearch = () => {
    const n = Number(saleNumberDraft.trim());
    setQuery({
      saleNumber: Number.isInteger(n) && n > 0 ? n : undefined,
      from: fromDraft ? localDayStart(fromDraft) : undefined,
      to: toDraft ? localDayEnd(toDraft) : undefined,
    });
  };

  const clearSearch = () => {
    setSaleNumberDraft("");
    setFromDraft("");
    setToDraft("");
    setQuery({});
  };

  const searching = Boolean(query.saleNumber || query.from || query.to);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-white">
          Recent sales{locationName ? ` — ${locationName}` : ""}
        </h2>
        <div className="flex flex-wrap gap-1 rounded-lg bg-white/[0.04] p-1">
          {FILTERS.map((f, i) => (
            <button
              key={f.label}
              onClick={() => setFilter(i)}
              className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === i ? "bg-[#FFCC00] text-black" : "text-[#999999] hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="flex-1 min-w-[120px]">
          <span className="mb-1 block text-xs text-[#999999]">Sale number</span>
          <input
            type="number"
            min="1"
            value={saleNumberDraft}
            onChange={(e) => setSaleNumberDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applySearch()}
            placeholder="e.g. 42"
            className={INPUT}
          />
        </label>
        <label className="flex-1 min-w-[130px]">
          <span className="mb-1 block text-xs text-[#999999]">From</span>
          <input
            type="date"
            value={fromDraft}
            onChange={(e) => setFromDraft(e.target.value)}
            className={INPUT}
          />
        </label>
        <label className="flex-1 min-w-[130px]">
          <span className="mb-1 block text-xs text-[#999999]">To</span>
          <input
            type="date"
            value={toDraft}
            onChange={(e) => setToDraft(e.target.value)}
            className={INPUT}
          />
        </label>
        <button
          onClick={applySearch}
          className="flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-md bg-[#FFCC00] px-4 text-sm font-medium text-black transition-colors hover:bg-[#E5BB00]"
        >
          <Search className="h-4 w-4" />
          Search
        </button>
        {searching && (
          <button
            onClick={clearSearch}
            className="h-10 shrink-0 cursor-pointer rounded-md border border-[#303236] px-4 text-sm font-medium text-white transition-colors hover:border-white/40"
          >
            Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-[#FFCC00]" />
        </div>
      ) : sales.length === 0 ? (
        <p className="mt-4 text-sm text-[#999999]">
          {searching
            ? "No sales match that search."
            : filter === 0
              ? "No sales yet."
              : `No ${FILTERS[filter].label.toLowerCase()} sales.`}
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {sales.map((sale) => (
            <li key={sale.id}>
              <button
                onClick={() => setOpenSaleId(sale.id)}
                className="flex w-full cursor-pointer flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-left transition-colors hover:border-[#FFCC00]/40"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.04]">
                  <Receipt className="h-4 w-4 text-[#FFCC00]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {sale.saleNumber ? `Sale #${sale.saleNumber}` : "Unnumbered sale"}
                    <span className="text-[#6B6B6B]">
                      {" · "}
                      {sale.itemCount} {sale.itemCount === 1 ? "item" : "items"}
                    </span>
                  </p>
                  <p className="truncate text-xs text-[#999999]">
                    {new Date(sale.completedAt ?? sale.createdAt).toLocaleString()}
                    {" · "}
                    {/* Blank would be indistinguishable from lost attribution, so it says which. */}
                    {sale.customerAddress ? shortAddress(sale.customerAddress) : "Walk-in"}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[sale.status]}`}
                >
                  {STATUS_LABELS[sale.status]}
                </span>
                <span className="shrink-0 text-sm font-semibold text-white">
                  {formatCents(sale.totalCents)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Says how many are behind the list, so a page of 25 can never read as "that's all of them". */}
      {!loading && sales.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[#6B6B6B]">
            Showing {sales.length} of {total}
          </p>
          {sales.length < total && (
            <button
              disabled={loadingMore}
              onClick={loadMore}
              className="flex h-10 cursor-pointer items-center gap-2 rounded-md border border-[#303236] px-4 text-sm font-medium text-white transition-colors hover:border-[#FFCC00] hover:text-[#FFCC00] disabled:opacity-50"
            >
              {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
              Load more
            </button>
          )}
        </div>
      )}

      {openSaleId && (
        <SaleDetail
          saleId={openSaleId}
          locationName={locationName}
          onClose={() => setOpenSaleId(null)}
          onChanged={load}
        />
      )}
    </>
  );
}

function SaleDetail({
  saleId,
  locationName,
  onClose,
  onChanged,
}: {
  saleId: string;
  locationName?: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  // The shop's own name, not the signed-in team member's — a receipt is the shop's.
  const shopName = useAuthStore((s) => s.userProfile?.name);

  const [sale, setSale] = useState<PosSale | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refunding, setRefunding] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [restock, setRestock] = useState(true);

  const reload = useCallback(
    () =>
      getSale(saleId)
        .then((s) => {
          setSale(s);
          setEmail(s.receiptEmail ?? "");
        })
        .catch((e) => setError(e instanceof Error ? e.message : "Could not load the sale"))
        .finally(() => setLoading(false)),
    [saleId]
  );

  useEffect(() => {
    reload();
  }, [reload]);

  const run = async (work: () => Promise<string>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      setNotice(await work());
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work");
    } finally {
      setBusy(false);
    }
  };

  const settled = sale?.payments.filter((p) => p.status === "succeeded") ?? [];

  // Mirrors the server: only cash and card can be handed back. RCN and gift-card tenders were
  // deliberately kept out of the fiat ledger, so there is nothing there to reverse.
  const refundableCents = settled
    .filter((p) => p.method === "card" || p.method === "cash")
    .reduce((sum, p) => sum + (p.amountCents - p.refundedCents), 0);

  const canRefund =
    (sale?.status === "completed" || sale?.status === "partially_refunded") && refundableCents > 0;

  const requestedCents = refundAmount.trim()
    ? Math.round(Number(refundAmount) * 100)
    : refundableCents;
  const partial = requestedCents > 0 && requestedCents < refundableCents;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-[#303236] bg-[#1D1D1D] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#303236] p-5">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold text-white">
              {sale?.saleNumber ? `Sale #${sale.saleNumber}` : "Sale"}
            </h3>
            {sale && (
              <p className="truncate text-xs text-[#999999]">
                {new Date(sale.completedAt ?? sale.createdAt).toLocaleString()}
                {" · "}
                {sale.customerAddress ? shortAddress(sale.customerAddress) : "Walk-in"}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-lg p-2 transition-colors hover:bg-white/10"
            aria-label="Close"
          >
            <X className="h-5 w-5 text-[#999999]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-[#FFCC00]" />
            </div>
          ) : !sale ? (
            <p className="text-sm text-[#999999]">This sale could not be loaded.</p>
          ) : (
            <>
              <ul className="space-y-2">
                {sale.items.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate text-white">{item.name}</p>
                      {item.quantity > 1 && (
                        <p className="text-xs text-[#6B6B6B]">
                          {item.quantity} × {formatCents(item.unitPriceCents)}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-white">{formatCents(item.totalCents)}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 space-y-1 border-t border-[#303236] pt-4 text-sm">
                <Row label="Subtotal" value={formatCents(sale.subtotalCents)} />
                {sale.discountCents > 0 && (
                  <Row label="Discount" value={`-${formatCents(sale.discountCents)}`} />
                )}
                {sale.taxCents > 0 && <Row label="Tax" value={formatCents(sale.taxCents)} />}
                <Row label="Total" value={formatCents(sale.totalCents)} bold />
              </div>

              {settled.length > 0 && (
                <div className="mt-4 space-y-1 border-t border-[#303236] pt-4 text-sm">
                  {settled.map((p) => (
                    <Row
                      key={p.id}
                      label={TENDER_LABELS[p.method] ?? "Payment"}
                      value={
                        p.refundedCents > 0
                          ? `${formatCents(p.amountCents)} · ${formatCents(p.refundedCents)} refunded`
                          : formatCents(p.amountCents)
                      }
                    />
                  ))}
                </div>
              )}

              {sale.receiptSentAt && (
                <p className="mt-4 text-xs text-[#6B6B6B]">
                  Receipt emailed {new Date(sale.receiptSentAt).toLocaleString()}
                  {sale.receiptEmail ? ` to ${sale.receiptEmail}` : ""}
                </p>
              )}
            </>
          )}

          {error && <p className="mt-4 text-sm text-[#EF4444]">{error}</p>}
          {notice && <p className="mt-4 text-sm text-[#22C55E]">{notice}</p>}
        </div>

        {sale && !loading && (
          <div className="space-y-3 border-t border-[#303236] p-5">
            {sale.status === "open" ? (
              <button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await voidSale(sale.id, "Cleared from sales history");
                    onClose();
                    return "Sale voided.";
                  })
                }
                className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-[#303236] text-sm font-medium text-white transition-colors hover:border-[#EF4444] hover:text-[#EF4444] disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                Void this open sale
              </button>
            ) : sale.status === "voided" ? (
              // No receipt for a sale that took no money. Printing one produces a document that
              // reads as proof of purchase for something that never happened, and emailing it to
              // a customer is worse — the lines and the total are there, only the tenders are not.
              <p className="text-xs text-[#6B6B6B]">
                This sale was voided before it was paid, so there is no receipt for it.
                {sale.voidReason ? ` Reason: ${sale.voidReason}` : ""}
              </p>
            ) : (
              <>
                <button
                  onClick={() => printPosReceipt({ sale, shopName, locationName })}
                  className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-[#303236] text-sm font-medium text-white transition-colors hover:border-[#FFCC00] hover:text-[#FFCC00]"
                >
                  <Printer className="h-4 w-4" />
                  Print receipt
                </button>

                <div className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email a copy"
                    className={INPUT}
                  />
                  <button
                    disabled={busy || !email.trim()}
                    onClick={() =>
                      run(async () => {
                        const { sentTo } = await resendReceipt(sale.id, email.trim());
                        await reload();
                        return `Receipt sent to ${sentTo}.`;
                      })
                    }
                    className="flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md bg-[#FFCC00] px-4 text-sm font-medium text-black transition-colors hover:bg-[#E5BB00] disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Mail className="h-4 w-4" />
                    )}
                    Send
                  </button>
                </div>

                {canRefund && !refunding && (
                  <button
                    onClick={() => setRefunding(true)}
                    className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-[#303236] text-sm font-medium text-white transition-colors hover:border-[#EF4444] hover:text-[#EF4444]"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Refund {formatCents(refundableCents)}
                  </button>
                )}

                {canRefund && refunding && (
                  <div className="space-y-3 rounded-xl border border-[#303236] bg-white/[0.02] p-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[#999999]">Refund</span>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        max={(refundableCents / 100).toFixed(2)}
                        value={refundAmount}
                        onChange={(e) => setRefundAmount(e.target.value)}
                        placeholder={(refundableCents / 100).toFixed(2)}
                        className={INPUT}
                      />
                    </div>

                    {/* Withheld on a partial refund: the amount says nothing about which lines
                        came back, so restocking would invent stock the shop doesn't have. */}
                    {!partial && (
                      <label className="flex cursor-pointer items-start gap-2 text-xs text-[#999999]">
                        <input
                          type="checkbox"
                          checked={restock}
                          onChange={(e) => setRestock(e.target.checked)}
                          className="mt-0.5 h-4 w-4 cursor-pointer accent-[#FFCC00]"
                        />
                        <span>
                          Put returned products back in stock. Parts used on a repair are never
                          restocked.
                        </span>
                      </label>
                    )}

                    <p className="text-xs text-[#6B6B6B]">
                      Card payments reverse through Stripe. Cash comes out of the drawer — hand it
                      to the customer yourself. Loyalty RCN already issued is not taken back.
                    </p>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setRefunding(false)}
                        className="h-10 flex-1 cursor-pointer rounded-md border border-[#303236] text-sm font-medium text-white transition-colors hover:border-white/40"
                      >
                        Cancel
                      </button>
                      <button
                        disabled={busy || requestedCents <= 0 || requestedCents > refundableCents}
                        onClick={() =>
                          run(async () => {
                            const result = await refundSale(sale.id, {
                              amountCents: partial ? requestedCents : undefined,
                              restock: !partial && restock,
                            });
                            await reload();
                            setRefunding(false);
                            const legs = result.legs
                              .map((l) => `${formatCents(l.amountCents)} ${l.method}`)
                              .join(", ");
                            return result.failures.length
                              ? `Refunded ${legs}. Not refunded — ${result.failures.join("; ")}`
                              : `Refunded ${legs}.`;
                          })
                        }
                        className="flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-md bg-[#EF4444] text-sm font-medium text-white transition-colors hover:bg-[#DC2626] disabled:opacity-50"
                      >
                        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                        Refund {formatCents(Math.max(0, Math.min(requestedCents, refundableCents)))}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold text-white" : "text-[#999999]"}`}>
      <span>{label}</span>
      <span className={bold ? "" : "text-white"}>{value}</span>
    </div>
  );
}
