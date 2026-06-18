"use client";

import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Wrench, Image as ImageIcon } from "lucide-react";
import {
  getCustomerOrders,
  ServiceOrderWithDetails,
  OrderStatus,
} from "@/services/api/services";

interface ActiveServicesCardProps {
  onViewOrder?: (order: ServiceOrderWithDetails) => void;
}

// Active = not yet completed/cancelled. Map status -> label + accent + progress.
const STATUS_META: Partial<Record<OrderStatus, { label: string; color: string; progress: number }>> = {
  pending: { label: "Pending", color: "#FFCC00", progress: 25 },
  paid: { label: "Booked", color: "#38bdf8", progress: 60 },
};

const formatWhen = (iso?: string) => {
  if (!iso) return "Not scheduled";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Not scheduled";
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  const now = new Date();
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (sameDay(d, now)) return `Today, ${time}`;
  if (sameDay(d, tomorrow)) return `Tomorrow, ${time}`;
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${time}`;
};

function Thumb({ src, alt }: { src?: string | null; alt: string }) {
  const [err, setErr] = useState(false);
  return (
    <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-gray-800 to-gray-900">
      {src && !err ? (
        <img src={src} alt={alt} onError={() => setErr(true)} className="h-full w-full object-cover" />
      ) : (
        <ImageIcon className="w-6 h-6 text-gray-600" />
      )}
    </span>
  );
}

export const ActiveServicesCard: React.FC<ActiveServicesCardProps> = ({ onViewOrder }) => {
  const [orders, setOrders] = useState<ServiceOrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const perPage = 2;

  useEffect(() => {
    let active = true;
    getCustomerOrders({ limit: 20 })
      .then((res) => {
        if (!active) return;
        const list = (res?.data || []).filter((o) => o.status === "pending" || o.status === "paid");
        setOrders(list);
      })
      .catch(() => active && setOrders([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const totalPages = Math.ceil(orders.length / perPage) || 1;
  const visible = orders.slice(page * perPage, page * perPage + perPage);

  return (
    <div className="rounded-2xl border border-[#1f1f1f] bg-[#0a0a0a] p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-[#FFCC00]" />
          <h3 className="text-sm font-semibold text-white">My Active Services</h3>
        </div>
        {orders.length > perPage && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => (p > 0 ? p - 1 : totalPages - 1))}
              className="rounded-md p-1 text-gray-400 hover:bg-[#1d1d1d] hover:text-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => (p < totalPages - 1 ? p + 1 : 0))}
              className="rounded-md p-1 text-gray-400 hover:bg-[#1d1d1d] hover:text-white"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-[#1d1d1d]" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <p className="rounded-xl bg-[#141414] px-3 py-6 text-center text-xs text-gray-500">
          No active services. Book a service to see it here.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {visible.map((o) => {
            const meta = STATUS_META[o.status] ?? { label: o.status, color: "#9ca3af", progress: 40 };
            return (
              <button
                key={o.orderId}
                onClick={() => onViewOrder?.(o)}
                className="flex flex-col rounded-xl border border-[#242424] bg-[#141414] p-3 text-left transition-colors hover:bg-[#191919]"
              >
                <div className="flex items-center gap-3">
                  <Thumb src={o.serviceImageUrl} alt={o.serviceName} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{o.serviceName}</p>
                    <p className="truncate text-xs text-gray-400">
                      {o.companyName || o.shopName} ·{" "}
                      <span style={{ color: meta.color }}>{meta.label}</span>
                    </p>
                  </div>
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#242424]">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${meta.progress}%`, backgroundColor: meta.color }}
                  />
                </div>
                <p className="mt-2 text-[11px] text-gray-500">
                  Expected Completion: {formatWhen(o.bookingTimeSlot || o.bookingDate)}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ActiveServicesCard;
