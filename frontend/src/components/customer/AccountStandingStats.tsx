"use client";

import React, { useEffect, useState } from "react";
import { CalendarCheck, CalendarClock, CalendarX, ListChecks } from "lucide-react";
import { getCustomerOrders, type OrderStatus } from "@/services/api/services";

/**
 * Appointment-history stats for the customer's Account Standing panel. Gives the
 * "good standing" state something concrete — total appointments, completed, upcoming,
 * and missed — using the same count pattern (pagination.totalItems) the orders tab uses.
 */

interface Counts {
  total: number;
  completed: number;
  upcoming: number;
  missed: number;
}

const countFor = (status?: OrderStatus) =>
  getCustomerOrders(status ? { status, page: 1, limit: 1 } : { page: 1, limit: 1 })
    .then((r) => r?.pagination?.totalItems ?? 0)
    .catch(() => 0);

export const AccountStandingStats: React.FC = () => {
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      countFor(),          // total
      countFor("completed"),
      countFor("paid"),    // upcoming (booked, not yet completed)
      countFor("no_show"), // missed
    ])
      .then(([total, completed, upcoming, missed]) => {
        if (active) setCounts({ total, completed, upcoming, missed });
      })
      .catch(() => active && setCounts({ total: 0, completed: 0, upcoming: 0, missed: 0 }));
    return () => {
      active = false;
    };
  }, []);

  const items = [
    { icon: <ListChecks className="h-4 w-4 text-gray-300" />, label: "Total appointments", value: counts?.total },
    { icon: <CalendarCheck className="h-4 w-4 text-green-400" />, label: "Completed", value: counts?.completed },
    { icon: <CalendarClock className="h-4 w-4 text-[#FFCC00]" />, label: "Upcoming", value: counts?.upcoming },
    { icon: <CalendarX className="h-4 w-4 text-red-400" />, label: "Missed", value: counts?.missed },
  ];

  return (
    <div>
      <h4 className="mb-3 text-sm font-semibold text-gray-300">Your appointment history</h4>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((it) => (
          <div key={it.label} className="rounded-xl border border-gray-800 bg-[#1A1A1A] p-4">
            <div className="mb-2 flex items-center gap-2">
              {it.icon}
              <span className="text-xs text-gray-400">{it.label}</span>
            </div>
            <span className="text-2xl font-bold text-white">
              {counts === null ? "—" : it.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AccountStandingStats;
