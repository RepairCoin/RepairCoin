'use client';

// frontend/src/components/admin/StaleBookingsPanel.tsx
import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, CheckCircle, RotateCcw, RefreshCw, Loader2 } from 'lucide-react';
import { getStaleBookings, resolveStaleBooking, type StaleBooking } from '@/services/api/admin';

/**
 * Bookings nobody ever resolved.
 *
 * The confirmation flow deliberately never auto-settles or auto-refunds — a booking the
 * shop didn't complete and the customer didn't answer just waits. That's correct, but it
 * would leave the customer's money in limbo forever, and card networks stop accepting
 * refunds somewhere around 120-180 days. So at day 90 the booking is flagged and lands
 * here, where an admin makes the call while a refund still works.
 *
 * Renders nothing when the queue is empty, so it stays out of the way in the normal case.
 */
export default function StaleBookingsPanel() {
  const [bookings, setBookings] = useState<StaleBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setBookings(await getStaleBookings());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleResolve = async (booking: StaleBooking, action: 'complete' | 'refund') => {
    setResolvingId(booking.orderId);
    try {
      await resolveStaleBooking(booking.orderId, action);
      toast.success(
        action === 'complete'
          ? `Settled to ${booking.shopName} and rewards issued.`
          : `Refunded to ${booking.customerName || 'the customer'}.`
      );
      setBookings((prev) => prev.filter((b) => b.orderId !== booking.orderId));
    } catch (error: unknown) {
      console.error('Failed to resolve stale booking:', error);
      const message =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Could not resolve this booking. Please try again.';
      toast.error(message);
    } finally {
      setResolvingId(null);
    }
  };

  // Quiet when there's nothing to decide.
  if (!isLoading && bookings.length === 0) return null;

  return (
    <div className="mb-6 rounded-2xl border border-amber-500/30 bg-[#161616] p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
          <h3 className="text-base font-bold text-white">
            Unresolved bookings
            {bookings.length > 0 && (
              <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-300">
                {bookings.length}
              </span>
            )}
          </h3>
        </div>
        <button
          onClick={load}
          disabled={isLoading}
          className="flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-semibold text-gray-300 transition-colors hover:bg-gray-800 disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <p className="mb-4 text-sm text-gray-400">
        Neither the shop nor the customer ever confirmed these. The money is still held —
        decide before the refund window closes.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => (
            <div
              key={booking.orderId}
              className="rounded-xl border border-gray-800 bg-[#0D0D0D] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {booking.serviceName}
                    <span className="font-normal text-gray-500"> at {booking.shopName}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {booking.customerName || booking.customerAddress} ·{' '}
                    <span className="text-amber-400">
                      unresolved {booking.daysUnresolved} days
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    ${Number(booking.finalAmountUsd ?? booking.totalAmount).toFixed(2)}
                    {Number(booking.rcnRedeemed) > 0 && ` + ${booking.rcnRedeemed} RCN`}
                  </p>
                </div>

                <div className="flex flex-shrink-0 gap-2">
                  <button
                    onClick={() => handleResolve(booking, 'complete')}
                    disabled={resolvingId === booking.orderId}
                    title="Treat the service as delivered: settles to the shop and issues customer rewards"
                    className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-green-500 disabled:opacity-60"
                  >
                    {resolvingId === booking.orderId ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle className="h-3.5 w-3.5" />
                    )}
                    Mark completed
                  </button>
                  <button
                    onClick={() => handleResolve(booking, 'refund')}
                    disabled={resolvingId === booking.orderId}
                    title="Return the payment and any redeemed RCN to the customer"
                    className="flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-2 text-xs font-semibold text-gray-200 transition-colors hover:border-red-500/50 hover:text-red-400 disabled:opacity-60"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Refund
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
