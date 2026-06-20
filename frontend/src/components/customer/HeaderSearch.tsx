"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronDown, Loader2, ArrowRight } from "lucide-react";
import {
  getAllServices,
  getCustomerOrders,
  SERVICE_CATEGORIES,
  ShopServiceWithShopInfo,
  ServiceOrderWithDetails,
} from "@/services/api/services";
import { appointmentsApi, CalendarBooking } from "@/services/api/appointments";

interface HeaderSearchProps {
  activeTab: string;
}

interface TabResult {
  id: string;
  title: string;
  subtitle?: string;
  onSelect: () => void;
}

const TAB_SECTION_LABEL: Record<string, string> = {
  orders: "In My Bookings",
  appointments: "In My Appointments",
};

export function HeaderSearch({ activeTab }: HeaderSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<ShopServiceWithShopInfo[]>([]);

  // Lazily-loaded dataset for the current tab (orders/appointments), filtered client-side.
  const [orders, setOrders] = useState<ServiceOrderWithDetails[] | null>(null);
  const [appointments, setAppointments] = useState<CalendarBooking[] | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const trimmed = query.trim();

  // Close on outside click.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Reset the cached tab dataset when the tab changes.
  useEffect(() => {
    setOrders(null);
    setAppointments(null);
  }, [activeTab]);

  // Debounced marketplace search + lazy tab-data load.
  useEffect(() => {
    if (trimmed.length < 2) {
      setServices([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const handle = setTimeout(async () => {
      const tasks: Promise<unknown>[] = [];

      tasks.push(
        getAllServices({
          search: trimmed,
          ...(category !== "all" ? { category: category as ShopServiceWithShopInfo["category"] } : {}),
          limit: 5,
        }).then((res) => setServices(res?.data || []))
      );

      if (activeTab === "orders" && orders === null) {
        tasks.push(getCustomerOrders({ limit: 100 }).then((res) => setOrders(res?.data || [])));
      }
      if (activeTab === "appointments" && appointments === null) {
        const now = new Date();
        const start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        const end = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
        const fmt = (d: Date) => d.toISOString().slice(0, 10);
        tasks.push(
          appointmentsApi
            .getCustomerAppointments(fmt(start), fmt(end))
            .then((res) => setAppointments(res || []))
            .catch(() => setAppointments([]))
        );
      }

      await Promise.allSettled(tasks);
      setLoading(false);
    }, 300);

    return () => clearTimeout(handle);
  }, [trimmed, category, activeTab, orders, appointments]);

  const goToMarketplace = () => {
    const params = new URLSearchParams({ tab: "marketplace" });
    if (trimmed) params.set("search", trimmed);
    if (category !== "all") params.set("category", category);
    router.push(`/customer?${params.toString()}`);
    setOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    goToMarketplace();
  };

  // Build the "on this page" results for the active tab.
  const tabResults: TabResult[] = useMemo(() => {
    const q = trimmed.toLowerCase();
    if (q.length < 2) return [];

    if (activeTab === "orders" && orders) {
      return orders
        .filter((o) =>
          [o.serviceName, o.shopName, o.companyName].some((v) => v?.toLowerCase().includes(q))
        )
        .slice(0, 5)
        .map((o) => ({
          id: o.orderId,
          title: o.serviceName,
          subtitle: o.companyName || o.shopName,
          onSelect: () => {
            router.push(`/customer?tab=orders`);
            setOpen(false);
          },
        }));
    }

    if (activeTab === "appointments" && appointments) {
      return appointments
        .filter((a) =>
          [a.serviceName, a.shopName].some((v) => v?.toLowerCase().includes(q))
        )
        .slice(0, 5)
        .map((a) => ({
          id: a.orderId,
          title: a.serviceName,
          subtitle: a.shopName || undefined,
          onSelect: () => {
            router.push(`/customer?tab=appointments`);
            setOpen(false);
          },
        }));
    }

    return [];
  }, [trimmed, activeTab, orders, appointments, router]);

  const showDropdown = open && trimmed.length >= 2;
  const hasResults = services.length > 0 || tabResults.length > 0;
  const tabLabel = TAB_SECTION_LABEL[activeTab];

  return (
    <div ref={containerRef} className="relative w-full max-w-3xl">
      <form
        onSubmit={handleSubmit}
        className="flex h-10 w-full items-center overflow-hidden rounded-md bg-white"
      >
        <div className={`relative flex-shrink-0 ${category === "all" ? "w-14" : "w-56"}`}>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-10 w-full cursor-pointer appearance-none bg-transparent pl-2.5 pr-6 text-sm text-gray-700 focus:outline-none"
            aria-label="Filter by category"
          >
            <option value="all">All</option>
            {SERVICE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-1 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
        </div>

        <span className="self-stretch w-px bg-gray-200" />

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search FixFlow"
          className="h-10 min-w-0 flex-1 bg-transparent px-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
        />

        <button
          type="submit"
          className="flex h-full w-11 flex-shrink-0 items-center justify-center bg-[#FFCC00] text-black transition-colors hover:bg-[#e6b800]"
          aria-label="Search"
        >
          <Search className="w-5 h-5" />
        </button>
      </form>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-lg border border-[#262626] bg-[#161616] shadow-xl">
          {loading && !hasResults ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Searching…
            </div>
          ) : !hasResults ? (
            <p className="py-6 text-center text-sm text-gray-500">
              No results for &ldquo;{trimmed}&rdquo;
            </p>
          ) : (
            <div className="max-h-[420px] overflow-y-auto py-1">
              {tabResults.length > 0 && (
                <div className="py-1">
                  <p className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    {tabLabel}
                  </p>
                  {tabResults.map((r) => (
                    <button
                      key={r.id}
                      onClick={r.onSelect}
                      className="flex w-full flex-col items-start px-4 py-2 text-left hover:bg-[#1f1f1f]"
                    >
                      <span className="truncate text-sm text-white">{r.title}</span>
                      {r.subtitle && (
                        <span className="truncate text-xs text-gray-500">{r.subtitle}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {services.length > 0 && (
                <div className="py-1">
                  <p className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    Marketplace
                  </p>
                  {services.map((s) => (
                    <button
                      key={s.serviceId}
                      onClick={() => {
                        router.push(`/customer?tab=marketplace&service=${s.serviceId}`);
                        setOpen(false);
                      }}
                      className="flex w-full flex-col items-start px-4 py-2 text-left hover:bg-[#1f1f1f]"
                    >
                      <span className="truncate text-sm text-white">{s.serviceName}</span>
                      <span className="truncate text-xs text-gray-500">{s.companyName}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={goToMarketplace}
            className="flex w-full items-center justify-between border-t border-[#262626] px-4 py-2.5 text-sm font-medium text-[#FFCC00] hover:bg-[#1f1f1f]"
          >
            See all results in marketplace
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export default HeaderSearch;
