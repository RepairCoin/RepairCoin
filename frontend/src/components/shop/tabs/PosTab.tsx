"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CreditCard, Loader2, MapPin, Percent, ShoppingCart } from "lucide-react";
import { listReaders, type TerminalReader } from "@/services/api/terminal";
import { listTaxRates, bpsToPercent, type ShopTaxRate } from "@/services/api/tax";
import { getLocations, type ShopLocation } from "@/services/api/locations";
import { getPosSummary, formatCents, type PosSalesSummary } from "@/services/api/pos";
import { readPosLocation, writePosLocation } from "@/components/shop/pos/posLocation";

const RANGES = [
  { days: 1, label: "24 hours" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
];

const PANEL =
  "rounded-2xl bg-[linear-gradient(90deg,#000000_0%,#1D1D1D_100%)] p-6 md:p-8";

/**
 * Register landing. Starting a sale leaves the dashboard for the full-screen register — the
 * setup checks belong here where the sidebar is, the selling screen does not.
 */
export function PosTab() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [readers, setReaders] = useState<TerminalReader[]>([]);
  const [rates, setRates] = useState<ShopTaxRate[]>([]);
  const [locations, setLocations] = useState<ShopLocation[]>([]);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [days, setDays] = useState(1);
  const [summary, setSummary] = useState<PosSalesSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [r, t, l] = await Promise.all([
      listReaders().catch(() => [] as TerminalReader[]),
      listTaxRates().catch(() => [] as ShopTaxRate[]),
      getLocations().catch(() => [] as ShopLocation[]),
    ]);
    setReaders(r);
    setRates(t);
    setLocations(l);
    // Default a fresh device to the primary branch rather than leaving it unset — an unset
    // register silently uses the shop default tax rate, which is wrong at a branch with its own.
    const stored = readPosLocation();
    const resolved = stored && l.some((x) => x.id === stored)
      ? stored
      : l.find((x) => x.isPrimary)?.id ?? null;
    setLocationId(resolved);
    if (resolved !== stored) writePosLocation(resolved);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Scoped to the branch only when there is more than one. A single-location shop that predates
  // the register binding has sales with no location_id, and filtering would hide them.
  const scoped = locations.length > 1 ? locationId : null;

  useEffect(() => {
    let live = true;
    setSummaryLoading(true);
    getPosSummary({ days, locationId: scoped })
      .then((s) => live && setSummary(s))
      .catch(() => live && setSummary(null))
      .finally(() => live && setSummaryLoading(false));
    return () => {
      live = false;
    };
  }, [days, scoped]);

  // Mirrors the backend's resolution order: the branch override wins, else the shop default.
  const defaultRate =
    (locationId ? rates.find((r) => r.locationId === locationId) : undefined) ??
    rates.find((r) => r.locationId === null) ??
    rates[0];

  const localReaders = locationId
    ? readers.filter((r) => r.shopLocationId === locationId)
    : readers;

  return (
    <div className="space-y-6">
      <div className={PANEL}>
        <h1 className="text-2xl font-bold text-[#FFCC00]">Point of Sale</h1>
        <p className="mt-2 text-sm text-[#999999]">
          Ring up services and products at the counter. Card payments go to the same Stripe
          account as your online payments.
        </p>

        <button
          onClick={() => router.push("/shop/pos")}
          className="mt-6 inline-flex h-12 w-full max-w-[416px] cursor-pointer items-center justify-center gap-2 rounded-md bg-[#FFCC00] text-base font-medium text-black transition-colors hover:bg-[#E5BB00]"
        >
          <ShoppingCart className="h-5 w-5" />
          Start a sale
        </button>
      </div>

      <div className={PANEL}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-white">
            Counter sales
            {locations.length > 1 && scoped
              ? ` — ${locations.find((l) => l.id === scoped)?.name ?? "this branch"}`
              : ""}
          </h2>
          <div className="flex gap-1 rounded-lg bg-white/[0.04] p-1">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setDays(r.days)}
                className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  days === r.days
                    ? "bg-[#FFCC00] text-black"
                    : "text-[#999999] hover:text-white"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {summaryLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-[#FFCC00]" />
          </div>
        ) : !summary || summary.saleCount === 0 ? (
          <p className="mt-4 text-sm text-[#999999]">
            No completed sales in the last {RANGES.find((r) => r.days === days)?.label}.
          </p>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Sales" value={String(summary.saleCount)} />
              <Stat label="Net revenue" value={formatCents(summary.netRevenueCents)} />
              <Stat label="Tax collected" value={formatCents(summary.taxCents)} />
              <Stat
                label="Gross margin"
                value={
                  summary.marginBps === null
                    ? "—"
                    : `${formatCents(summary.marginCents)} · ${(summary.marginBps / 100).toFixed(1)}%`
                }
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-[#999999]">
              <span>Card {formatCents(summary.tenders.card ?? 0)}</span>
              <span>Cash {formatCents(summary.tenders.cash ?? 0)}</span>
              {summary.uncostedRevenueCents > 0 && (
                <span>
                  Margin excludes {formatCents(summary.uncostedRevenueCents)} with no cost
                  recorded — set a cost on those items to include them.
                </span>
              )}
            </div>
          </>
        )}
      </div>

      <div className={PANEL}>
        <h2 className="text-sm font-semibold text-white">Register setup</h2>
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-[#FFCC00]" />
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {locations.length > 1 && (
              <li className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.04]">
                  <MapPin className="h-4 w-4 text-[#FFCC00]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white">This register</p>
                  <p className="text-xs text-[#999999]">
                    Sets the tax rate and which readers this device can use.
                  </p>
                </div>
                <select
                  value={locationId ?? ""}
                  onChange={(e) => {
                    setLocationId(e.target.value);
                    writePosLocation(e.target.value);
                  }}
                  className="h-11 min-w-[180px] rounded-md border border-[#303236] bg-[#141414] px-3 text-sm text-white focus:border-[#FFCC00] focus:outline-none"
                >
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                      {l.isPrimary ? " (primary)" : ""}
                    </option>
                  ))}
                </select>
              </li>
            )}

            <SetupRow
              icon={<CreditCard className="h-4 w-4 text-[#FFCC00]" />}
              title="Card reader"
              detail={
                localReaders.length === 0
                  ? locations.length > 1
                    ? "None paired at this branch — you can still take cash."
                    : "None paired — you can still take cash."
                  : `${localReaders.length} paired · ${
                      localReaders.find((r) => r.isDefault)?.label ?? "default set"
                    }`
              }
              ok={localReaders.length > 0}
              actionLabel={localReaders.length === 0 ? "Pair one" : "Manage"}
              href="/shop/get-paid"
            />
            <SetupRow
              icon={<Percent className="h-4 w-4 text-[#FFCC00]" />}
              title="Sales tax"
              detail={
                defaultRate
                  ? `${bpsToPercent(defaultRate.rateBps)}% — ${defaultRate.name}`
                  : "No rate set — sales will be untaxed."
              }
              ok={!!defaultRate}
              actionLabel={defaultRate ? "Change" : "Set a rate"}
              href="/shop?tab=settings&section=sales-tax"
            />
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <p className="text-xs text-[#999999]">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function SetupRow({
  icon,
  title,
  detail,
  ok,
  actionLabel,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  ok: boolean;
  actionLabel: string;
  href: string;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.04]">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="truncate text-xs text-[#999999]">{detail}</p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
          ok ? "bg-[#22C55E]/15 text-[#22C55E]" : "bg-white/10 text-[#999999]"
        }`}
      >
        {ok ? "Ready" : "Optional"}
      </span>
      <Link
        href={href}
        className="shrink-0 text-xs text-[#FFCC00] underline underline-offset-4 transition-colors hover:text-[#E5BB00]"
      >
        {actionLabel}
      </Link>
    </li>
  );
}
