"use client";

// Platform-wide fiat payments (Slices A1 + A2). Named Payments, not Transactions, because
// admin/tabs/TransactionsTab.tsx is the RCN *token* ledger — a different thing entirely.
//
// Almost entirely read-only. The one write is the refund panel in the drawer, and it is
// deliberately harder to use than the shop's: these are Connect direct charges, so the money
// comes out of the MERCHANT's balance. Hence the mandatory note, the named shop, and the
// type-the-amount confirmation — the failure mode is the right amount on the wrong shop.

import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Receipt, Loader2, Download, X, AlertTriangle } from "lucide-react";
import {
  getAdminTransactions,
  getAdminTransactionTotals,
  getAdminTransactionRefunds,
  refundAdminTransaction,
  exportAdminTransactionsCsv,
  type AdminTransaction,
  type AdminTransactionPage,
  type PaymentTotals,
} from "@/services/api/adminPayments";
import type { PaymentMethod, PaymentStatus, Refund, RefundReason } from "@/services/api/payments";

const startOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};
const todayStr = () => new Date().toISOString().slice(0, 10);

// The ledger is integer cents; divide only here.
const money = (cents: number | null | undefined) => `$${((cents ?? 0) / 100).toFixed(2)}`;

const statusBadge: Record<PaymentStatus, string> = {
  succeeded: "bg-green-500/20 text-green-300",
  processing: "bg-blue-500/20 text-blue-300",
  requires_payment: "bg-yellow-500/20 text-yellow-300",
  failed: "bg-red-500/20 text-red-300",
  refunded: "bg-gray-500/20 text-gray-300",
  partially_refunded: "bg-orange-500/20 text-orange-300",
};

const statusLabel: Record<PaymentStatus, string> = {
  succeeded: "Succeeded",
  processing: "Processing",
  requires_payment: "Requires payment",
  failed: "Failed",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
};

const inputClass =
  "w-full px-3 py-2 rounded-md bg-[#101010] border border-[#303236] text-white focus:border-[#FFCC00] outline-none";

export function PaymentsTab() {
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(todayStr());
  const [status, setStatus] = useState<"" | PaymentStatus>("");
  const [method, setMethod] = useState<"" | PaymentMethod>("");
  const [shopId, setShopId] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminTransactionPage | null>(null);
  const [totals, setTotals] = useState<PaymentTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState<AdminTransaction | null>(null);

  const query = useCallback(
    () => ({
      startDate: from || undefined,
      // The filter is a date but created_at is a timestamp — without this the end date would
      // exclude everything that happened during the day the user picked.
      endDate: to ? `${to}T23:59:59.999Z` : undefined,
      status: status || undefined,
      method: method || undefined,
      shopId: shopId.trim() || undefined,
    }),
    [from, to, status, method, shopId]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Totals cover the whole filtered set, not the current page, so they're fetched
      // separately rather than summed from `items`.
      const [result, sums] = await Promise.all([
        getAdminTransactions({ ...query(), page }),
        getAdminTransactionTotals(query()),
      ]);
      setData(result);
      setTotals(sums);
    } catch {
      toast.error("Failed to load payments");
      setData(null);
      setTotals(null);
    } finally {
      setLoading(false);
    }
  }, [query, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Any filter change invalidates the current page number.
  useEffect(() => {
    setPage(1);
  }, [from, to, status, method, shopId]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportAdminTransactionsCsv(query());
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transactions-platform-${todayStr()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to export payments");
    } finally {
      setExporting(false);
    }
  };

  const rows = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#303236] pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Receipt className="w-5 h-5 text-[#FFCC00]" /> Payments
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Every card payment taken across the platform, with what each shop netted and what
            FixFlow earned in commission.
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting || rows.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-[#FFCC00] text-black font-medium hover:bg-[#FFD700] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Export CSV
        </button>
      </div>

      {/* Totals for the filtered set — gross of refunds, which are shown separately. */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <SummaryCard label="Gross" value={money(totals?.grossCents)} sub={`${totals?.count ?? 0} payments`} />
        <SummaryCard label="Stripe fees" value={money(totals?.feeCents)} />
        <SummaryCard
          label="Platform fees"
          value={money(totals?.applicationFeeCents)}
          sub="FixFlow revenue"
          accent
        />
        <SummaryCard label="Net to shops" value={money(totals?.netCents)} />
        <SummaryCard label="Refunded" value={money(totals?.refundedCents)} />
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Shop ID</label>
          <input
            type="text"
            value={shopId}
            onChange={(e) => setShopId(e.target.value)}
            placeholder="All shops"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "" | PaymentStatus)}
            className={inputClass}
          >
            <option value="">All</option>
            {(Object.keys(statusLabel) as PaymentStatus[]).map((s) => (
              <option key={s} value={s}>
                {statusLabel[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Method</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as "" | PaymentMethod)}
            className={inputClass}
          >
            <option value="">All</option>
            <option value="card">Card</option>
            <option value="cash">Cash</option>
            <option value="ach">ACH</option>
            <option value="deposit">Deposit</option>
            <option value="terminal">Terminal</option>
            <option value="link">Link</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-[#FFCC00]" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-gray-400">No payments match these filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#101010] text-gray-400">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Shop</th>
                  <th className="text-left px-4 py-3 font-medium">Customer</th>
                  <th className="text-left px-4 py-3 font-medium">Method</th>
                  <th className="text-right px-4 py-3 font-medium">Gross</th>
                  <th className="text-right px-4 py-3 font-medium">Platform fee</th>
                  <th className="text-right px-4 py-3 font-medium">Net to shop</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => setSelected(t)}
                    className="border-t border-gray-800 hover:bg-[#222] cursor-pointer"
                  >
                    <td className="px-4 py-3 text-gray-300">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-white">
                      {t.shopName || <span className="text-gray-500">{t.shopId}</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {t.customerName || (
                        <span className="text-gray-500">
                          {t.customerAddress ? `${t.customerAddress.slice(0, 10)}…` : "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-300 capitalize">{t.method}</td>
                    <td className="px-4 py-3 text-right text-white">{money(t.grossCents)}</td>
                    <td className="px-4 py-3 text-right text-[#FFCC00]">
                      {money(t.applicationFeeCents)}
                    </td>
                    <td className="px-4 py-3 text-right text-green-400">{money(t.netCents)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${statusBadge[t.status]}`}>
                        {statusLabel[t.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>
            Page {data.pagination.page} of {data.pagination.totalPages} ·{" "}
            {data.pagination.totalItems} payments
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-md border border-[#303236] hover:bg-[#222] disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!data.pagination.hasMore}
              className="px-3 py-1.5 rounded-md border border-[#303236] hover:bg-[#222] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {selected && (
        <PaymentDetail
          transaction={selected}
          onClose={() => setSelected(null)}
          // A refund changes refunded_cents and status via the webhook, so reload the list
          // rather than patching the row from the refund response.
          onRefunded={() => {
            setSelected(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-4">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-xl font-bold mt-1 ${accent ? "text-[#FFCC00]" : "text-white"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-gray-800 last:border-0">
      <span className="text-gray-400">{label}</span>
      <span className="text-white text-right break-all">{value}</span>
    </div>
  );
}

function PaymentDetail({
  transaction: t,
  onClose,
  onRefunded,
}: {
  transaction: AdminTransaction;
  onClose: () => void;
  onRefunded: () => void;
}) {
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState<RefundReason>("requested_by_customer");
  const [note, setNote] = useState("");
  const [confirmAmount, setConfirmAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getAdminTransactionRefunds(t.id)
      .then(setRefunds)
      .catch(() => setRefunds([]));
  }, [t.id]);

  // What Stripe reports refunded is authoritative; anything pending on our side is also
  // spoken for. Mirrors the server's own calculation in RefundIssuer.
  const requestedHere = refunds
    .filter((r) => r.status !== "failed")
    .reduce((sum, r) => sum + r.amountCents, 0);
  const refundable = t.grossCents - Math.max(t.refundedCents, requestedHere);
  const canRefund =
    refundable > 0 && (t.status === "succeeded" || t.status === "partially_refunded");

  // Blank amount = the whole remaining balance, so that's what has to be confirmed.
  const parsed = amount.trim() ? Math.round(parseFloat(amount) * 100) : refundable;
  const targetCents = Number.isFinite(parsed) ? parsed : NaN;
  const confirmed =
    confirmAmount.trim() !== "" &&
    Math.round(parseFloat(confirmAmount) * 100) === targetCents;
  const ready = note.trim().length > 0 && confirmed && targetCents > 0 && targetCents <= refundable;

  const handleRefund = async () => {
    if (!ready) return;
    setSubmitting(true);
    try {
      await refundAdminTransaction(t.id, {
        amountCents: amount.trim() ? targetCents : undefined,
        reason,
        note: note.trim(),
      });
      toast.success(`Refunded ${money(targetCents)} from ${t.shopName || t.shopId}`);
      onRefunded();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || e?.error || "Refund failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-md h-full bg-[#1A1A1A] border-l border-gray-800 p-6 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white">Payment detail</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-6">
          <div className="text-3xl font-bold text-white">{money(t.grossCents)}</div>
          <span className={`inline-block mt-2 px-2 py-1 rounded-full text-xs ${statusBadge[t.status]}`}>
            {statusLabel[t.status]}
          </span>
        </div>

        <div className="space-y-1 text-sm">
          <DetailRow label="Shop" value={t.shopName || t.shopId} />
          <DetailRow label="Shop ID" value={t.shopId} />
          <DetailRow label="Date" value={new Date(t.createdAt).toLocaleString()} />
          <DetailRow label="Customer" value={t.customerName || t.customerAddress || "—"} />
          <DetailRow label="Service" value={t.serviceName || "—"} />
          <DetailRow label="Method" value={<span className="capitalize">{t.method}</span>} />
          <DetailRow label="Source" value={<span className="capitalize">{t.source}</span>} />
          <DetailRow label="Gross" value={money(t.grossCents)} />
          <DetailRow label="Stripe fee" value={`− ${money(t.feeCents)}`} />
          <DetailRow
            label="Platform fee"
            value={<span className="text-[#FFCC00]">{money(t.applicationFeeCents)}</span>}
          />
          <DetailRow
            label="Net to shop"
            value={<span className="text-green-400">{money(t.netCents)}</span>}
          />
          {t.refundedCents > 0 && <DetailRow label="Refunded" value={money(t.refundedCents)} />}
          <DetailRow label="Order" value={t.orderId || <span className="text-gray-600">Not linked</span>} />
          <DetailRow label="Payment intent" value={t.stripePaymentIntentId || "—"} />
          <DetailRow label="Connected account" value={t.stripeAccountId || "—"} />
        </div>

        {t.feeCents === 0 && t.netCents === 0 && (
          <p className="mt-6 text-xs text-gray-500">
            Fee and net are unavailable for this payment — historical records imported into the
            ledger don&apos;t carry Stripe&apos;s fee breakdown.
          </p>
        )}

        {refunds.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-medium text-white mb-2">Refunds</h4>
            <div className="space-y-2">
              {refunds.map((r) => (
                <div key={r.id} className="flex justify-between text-xs text-gray-400">
                  <span>
                    {new Date(r.createdAt).toLocaleDateString()} · {r.reason.replace(/_/g, " ")}
                    {r.createdByRole === "admin" && (
                      <span className="text-orange-400"> · by FixFlow</span>
                    )}
                    {r.status !== "succeeded" && ` · ${r.status}`}
                  </span>
                  <span className="text-white">{money(r.amountCents)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Slice A2. Collapsed by default — routine customer service belongs on the shop's own
            Payments tab; this is for disputes and fraud. */}
        {canRefund && (
          <div className="mt-6 border-t border-gray-800 pt-4">
            {!open ? (
              <button
                onClick={() => setOpen(true)}
                className="w-full px-4 py-2 rounded-md border border-orange-500/40 text-orange-300 text-sm hover:bg-orange-500/10"
              >
                Refund on behalf of the shop ({money(refundable)} available)
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2 rounded-md bg-orange-500/10 border border-orange-500/30 p-3">
                  <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-orange-200">
                    This debits <span className="font-semibold">{t.shopName || t.shopId}</span>
                    &apos;s own Stripe balance, not FixFlow&apos;s, and claws back our commission
                    with it. If their balance is short, it overdraws them. The shop is notified
                    and sees your reason.
                  </p>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Amount (leave blank to refund {money(refundable)})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setConfirmAmount("");
                    }}
                    placeholder={(refundable / 100).toFixed(2)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">Reason</label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value as RefundReason)}
                    className={inputClass}
                  >
                    <option value="requested_by_customer">Requested by customer</option>
                    <option value="duplicate">Duplicate</option>
                    <option value="fraudulent">Fraudulent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Note to the shop (required)
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    placeholder="Dispute #1234 — chargeback avoided by refunding"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Type {targetCents > 0 ? (targetCents / 100).toFixed(2) : "the amount"} to
                    confirm
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={confirmAmount}
                    onChange={(e) => setConfirmAmount(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleRefund}
                    disabled={!ready || submitting}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-orange-500 text-black font-medium hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Refund {targetCents > 0 ? money(targetCents) : ""}
                  </button>
                  <button
                    onClick={() => {
                      setOpen(false);
                      setConfirmAmount("");
                    }}
                    className="px-4 py-2 rounded-md border border-[#303236] text-gray-300 hover:bg-[#222]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <p className="mt-6 text-xs text-gray-500">
          This money sits in the shop&apos;s Stripe account, not the platform&apos;s. Shops refund
          their own charges from their Payments tab — refund from here only when they can&apos;t.
        </p>
      </div>
    </div>
  );
}
