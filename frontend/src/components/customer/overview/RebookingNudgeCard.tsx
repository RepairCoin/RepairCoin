"use client";

import React, { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { getCustomerOrders, type ServiceOrderWithDetails } from "@/services/api/services";

interface RebookingNudgeCardProps {
  /** Open the service in the marketplace to rebook. */
  onRebook: (serviceId: string) => void;
}

/**
 * Smart rebooking nudge. Looks at completed bookings, estimates a per-service
 * cadence from its category (e.g. grooming ~4 weeks, oil change ~3 months), and
 * surfaces services that are "due" again — turning one-off bookings into repeats.
 * Renders nothing when nothing is due.
 */

/** Typical rebooking cadence in days, by service category. */
const CADENCE_DAYS: Record<string, number> = {
  beauty_personal_care: 28,
  pets_animal_care: 42,
  fitness_gyms: 30,
  home_cleaning_services: 30,
  health_wellness: 45,
  automotive_services: 90,
  food_beverage: 21,
  repairs: 180,
  tech_it_services: 120,
};
const DEFAULT_CADENCE = 60;

const DAY_MS = 24 * 60 * 60 * 1000;

interface DueItem {
  serviceId: string;
  serviceName: string;
  shopName: string;
  daysSince: number;
}

export const RebookingNudgeCard: React.FC<RebookingNudgeCardProps> = ({ onRebook }) => {
  const [due, setDue] = useState<DueItem[]>([]);

  useEffect(() => {
    let active = true;
    getCustomerOrders({ status: "completed", page: 1, limit: 50 })
      .then((res) => {
        if (!active) return;
        const orders = res?.data ?? [];
        // Latest completed booking per service.
        const latest = new Map<string, ServiceOrderWithDetails>();
        for (const o of orders) {
          const when = o.completedAt || o.updatedAt || o.bookingDate;
          if (!when) continue;
          const prev = latest.get(o.serviceId);
          const prevWhen = prev?.completedAt || prev?.updatedAt || prev?.bookingDate;
          if (!prev || (prevWhen && new Date(when) > new Date(prevWhen))) {
            latest.set(o.serviceId, o);
          }
        }

        const now = Date.now();
        const items: DueItem[] = [];
        latest.forEach((o) => {
          const whenStr = o.completedAt || o.updatedAt || o.bookingDate;
          if (!whenStr) return;
          const daysSince = Math.floor((now - new Date(whenStr).getTime()) / DAY_MS);
          // Orders carry the service's category as `serviceCategory`; it's optional,
          // so fall back to the default cadence when it's absent.
          const cadence = CADENCE_DAYS[o.serviceCategory ?? ""] ?? DEFAULT_CADENCE;
          if (daysSince >= cadence) {
            items.push({
              serviceId: o.serviceId,
              serviceName: o.serviceName,
              shopName: o.companyName || "the shop",
              daysSince,
            });
          }
        });

        // Most overdue first, cap at 2 so the overview stays light.
        items.sort((a, b) => b.daysSince - a.daysSince);
        setDue(items.slice(0, 2));
      })
      .catch(() => active && setDue([]));
    return () => {
      active = false;
    };
  }, []);

  if (due.length === 0) return null;

  return (
    <div className="rounded-2xl border border-[#262626] bg-[#161616] p-4">
      <div className="mb-3 flex items-center gap-2">
        <RotateCcw className="h-4 w-4 text-[#FFCC00]" />
        <h3 className="text-sm font-semibold text-white">Time to book again?</h3>
      </div>
      <div className="space-y-2">
        {due.map((item) => (
          <div
            key={item.serviceId}
            className="flex items-center justify-between gap-3 rounded-xl border border-gray-800 bg-[#0a0a0a] p-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{item.serviceName}</p>
              <p className="truncate text-xs text-gray-500">
                {item.shopName} · last booked {formatAgo(item.daysSince)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onRebook(item.serviceId)}
              className="shrink-0 rounded-lg bg-[#FFCC00] px-3 py-1.5 text-sm font-semibold text-black transition-colors hover:bg-[#FFD700]"
            >
              Book again
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

function formatAgo(days: number): string {
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.round(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

export default RebookingNudgeCard;
