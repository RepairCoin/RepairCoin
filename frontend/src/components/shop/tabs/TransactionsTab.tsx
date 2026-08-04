"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Receipt, Loader2, Download, X } from "lucide-react";
import {
  getTransactions,
  exportTransactionsCsv,
  getRefunds,
  refundTransaction,
  describePayment,
  type Transaction,
  type TransactionPage,
  type PaymentStatus,
  type PaymentMethod,
  type Refund,
  type RefundReason,
} from "@/services/api/payments";
import { useAuthStore } from "@/stores/authStore";

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

export function TransactionsTab() {
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(todayStr());
  const [status, setStatus] = useState<"" | PaymentStatus>("");
  const [method, setMethod] = useState<"" | PaymentMethod>("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<TransactionPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState<Transaction | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getTransactions({
        startDate: from || undefined,
        // The filter is a date but created_at is a timestamp — without this the end date
        // would exclude everything that happened during the day the user picked.
        endDate: to ? `${to}T23:59:59.999Z` : undefined,
        status: status || undefined,
        method: method || undefined,
        page,
      });
      setData(result);
    } catch {
      toast.error("Failed to load transactions");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [from, to, status, method, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Any filter change invalidates the current page number.
  useEffect(() => {
    setPage(1);
  }, [from, to, status, method]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportTransactionsCsv({
        startDate: from || undefined,
        endDate: to ? `${to}T23:59:59.999Z` : undefined,
        status: status || undefined,
        method: method || undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transactions-${todayStr()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to export transactions");
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
            <Receipt className="w-5 h-5 text-[#FFCC00]" /> Transactions
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Every payment you&apos;ve taken, with processing fees and what actually settles to
            your account.
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

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
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
          <div className="py-16 text-center text-gray-400">
            No transactions in this period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#101010] text-gray-400">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Customer</th>
                  <th className="text-left px-4 py-3 font-medium">Service</th>
                  <th className="text-left px-4 py-3 font-medium">Method</th>
                  <th className="text-right px-4 py-3 font-medium">Gross</th>
                  <th className="text-right px-4 py-3 font-medium">Fees</th>
                  <th className="text-right px-4 py-3 font-medium">Net</th>
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
                      {t.customerName || (
                        <span className="text-gray-500">
                          {t.customerAddress ? `${t.customerAddress.slice(0, 10)}…` : "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {describePayment(t) || <span className="text-gray-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-300 capitalize">{t.method}</td>
                    <td className="px-4 py-3 text-right text-white">{money(t.grossCents)}</td>
                    <td className="px-4 py-3 text-right text-gray-400">
                      {money(t.feeCents + t.applicationFeeCents)}
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
            {data.pagination.totalItems} transactions
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
        <TransactionDetail
          transaction={selected}
          onClose={() => setSelected(null)}
          // A refund changes refunded_cents and status via the webhook, so refetch the list
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

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-gray-800 last:border-0">
      <span className="text-gray-400">{label}</span>
      <span className="text-white text-right break-all">{value}</span>
    </div>
  );
}

function TransactionDetail({
  transaction: t,
  onClose,
  onRefunded,
}: {
  transaction: Transaction;
  onClose: () => void;
  onRefunded: () => void;
}) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canRefund = hasPermission("payments:refund");

  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState<RefundReason>("requested_by_customer");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getRefunds(t.id)
      .then(setRefunds)
      .catch(() => setRefunds([]));
  }, [t.id]);

  // What Stripe reports refunded is authoritative; anything pending on our side is also
  // spoken for, so take the larger of the two.
  const requestedHere = refunds
    .filter((r) => r.status !== "failed")
    .reduce((sum, r) => sum + r.amountCents, 0);
  const refundable = t.grossCents - Math.max(t.refundedCents, requestedHere);
  const refundableAllowed =
    canRefund && refundable > 0 && (t.status === "succeeded" || t.status === "partially_refunded");

  const handleRefund = async () => {
    // Empty amount = refund everything left.
    const cents = amount.trim() === "" ? undefined : Math.round(parseFloat(amount) * 100);
    if (cents !== undefined && (!Number.isFinite(cents) || cents <= 0)) {
      toast.error("Enter a valid amount");
      return;
    }
    if (cents !== undefined && cents > refundable) {
      toast.error(`Amount exceeds the refundable balance of ${money(refundable)}`);
      return;
    }

    setSubmitting(true);
    try {
      await refundTransaction(t.id, { amountCents: cents, reason, note: note || undefined });
      toast.success("Refund issued");
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
          <h3 className="text-lg font-bold text-white">Transaction detail</h3>
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
          <DetailRow label="Date" value={new Date(t.createdAt).toLocaleString()} />
          <DetailRow
            label="Customer"
            value={t.customerName || t.customerAddress || (t.posSaleId ? "Walk-in" : "—")}
          />
          <DetailRow
            label={t.posSaleId ? "Sale" : "Service"}
            value={describePayment(t) || "—"}
          />
          <DetailRow label="Method" value={<span className="capitalize">{t.method}</span>} />
          <DetailRow label="Source" value={<span className="capitalize">{t.source}</span>} />
          <DetailRow label="Gross" value={money(t.grossCents)} />
          <DetailRow label="Stripe fee" value={`− ${money(t.feeCents)}`} />
          <DetailRow label="Platform fee" value={`− ${money(t.applicationFeeCents)}`} />
          <DetailRow label="Net to you" value={<span className="text-green-400">{money(t.netCents)}</span>} />
          {t.refundedCents > 0 && <DetailRow label="Refunded" value={money(t.refundedCents)} />}
          <DetailRow label="Order" value={t.orderId || <span className="text-gray-600">Not linked</span>} />
          <DetailRow label="Payment intent" value={t.stripePaymentIntentId || "—"} />
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
                <div key={r.id} className="text-xs text-gray-400">
                  <div className="flex justify-between">
                    <span>
                      {new Date(r.createdAt).toLocaleDateString()} · {r.reason.replace(/_/g, " ")}
                      {r.status !== "succeeded" && ` · ${r.status}`}
                    </span>
                    <span className="text-white">{money(r.amountCents)}</span>
                  </div>
                  {/* A refund nobody at this shop issued needs to say so, and say why — the
                      money left this account on the platform's instruction (Slice A2). */}
                  {r.createdByRole === "admin" && (
                    <p className="mt-0.5 text-orange-400">
                      Issued by FixFlow{r.note ? ` — ${r.note}` : ""}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {refundableAllowed && (
          <div className="mt-6 pt-6 border-t border-gray-800">
            {!showForm ? (
              <button
                onClick={() => setShowForm(true)}
                className="w-full px-4 py-2 rounded-md border border-[#303236] text-white hover:bg-[#222]"
              >
                Refund ({money(refundable)} available)
              </button>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Amount (leave blank to refund {money(refundable)})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={(refundable / 100).toFixed(2)}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
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
                  <label className="block text-xs text-gray-400 mb-1">Note (optional)</label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  This returns the money to the customer&apos;s card and can&apos;t be undone.
                  Stripe&apos;s processing fee is not returned to you.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleRefund}
                    disabled={submitting}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-[#FFCC00] text-black font-medium hover:bg-[#FFD700] disabled:opacity-50"
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Confirm refund
                  </button>
                  <button
                    onClick={() => setShowForm(false)}
                    disabled={submitting}
                    className="px-4 py-2 rounded-md border border-[#303236] text-gray-300 hover:bg-[#222]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
