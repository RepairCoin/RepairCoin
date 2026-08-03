"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Percent, Plus, Trash2 } from "lucide-react";
import {
  bpsToPercent,
  listTaxRates,
  removeTaxRate,
  saveTaxRate,
  type ShopTaxRate,
} from "@/services/api/tax";
import { getLocations, type ShopLocation } from "@/services/api/locations";

const PANEL =
  "rounded-2xl bg-[linear-gradient(90deg,#000000_0%,#1D1D1D_100%)] p-6 md:p-8";

const INPUT =
  "h-11 rounded-md border border-[#303236] bg-[#141414] px-3 text-sm text-white placeholder:text-[#6B6B6B] focus:border-[#FFCC00] focus:outline-none";

export default function TaxSettings() {
  const [rates, setRates] = useState<ShopTaxRate[]>([]);
  const [locations, setLocations] = useState<ShopLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [percent, setPercent] = useState("");
  const [name, setName] = useState("");
  const [locationId, setLocationId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rateList, locationList] = await Promise.all([
        listTaxRates(),
        getLocations().catch(() => [] as ShopLocation[]),
      ]);
      setRates(rateList);
      setLocations(locationList);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your tax settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    const value = Number(percent);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      setError("Enter a rate between 0 and 100 percent.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveTaxRate({
        ratePercent: value,
        name: name.trim() || undefined,
        locationId: locationId || null,
      });
      setPercent("");
      setName("");
      setLocationId("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the tax rate");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await removeTaxRate(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove that rate");
    }
  };

  const locationName = (id: string | null) =>
    id ? locations.find((l) => l.id === id)?.name ?? "A location" : "All locations";

  const hasDefault = rates.some((r) => r.locationId === null);

  return (
    <div className={PANEL}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFCC00]/10">
          <Percent className="h-4 w-4 text-[#FFCC00]" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-white">Sales Tax</h2>
          <p className="text-xs text-[#999999]">
            Applied to counter sales. Until you set a rate, no tax is charged.
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-[#F87171]/30 bg-[#F87171]/[0.08] p-3 text-sm text-[#F87171]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-6 flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-[#FFCC00]" />
        </div>
      ) : (
        <>
          {rates.length === 0 ? (
            <p className="mt-5 text-sm text-[#999999]">
              No tax rate set — sales are currently untaxed.
            </p>
          ) : (
            <ul className="mt-5 space-y-3">
              {rates.map((rate) => (
                <li
                  key={rate.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white">
                      {bpsToPercent(rate.rateBps)}% — {rate.name}
                    </p>
                    <p className="truncate text-xs text-[#6B6B6B]">
                      {locationName(rate.locationId)}
                      {rate.locationId === null && locations.length > 1 && " (default)"}
                    </p>
                  </div>
                  <button
                    onClick={() => remove(rate.id)}
                    title="Remove"
                    className="cursor-pointer rounded-md border border-[#303236] p-2 text-[#999999] transition-colors hover:text-[#F87171]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <p className="text-xs text-[#999999]">
              {hasDefault && locations.length > 1
                ? "Add a rate for a specific branch to override the default."
                : "Set the rate charged on counter sales."}
            </p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
                placeholder="8.25"
                inputMode="decimal"
                className={`${INPUT} sm:w-28`}
              />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Sales tax"
                className={`${INPUT} flex-1`}
              />
              {locations.length > 1 && (
                <select
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  className={`${INPUT} flex-1`}
                >
                  <option value="">All locations</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={save}
                disabled={saving || !percent.trim()}
                className="inline-flex h-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-[#FFCC00] px-5 text-sm font-medium text-black transition-colors hover:bg-[#E5BB00] disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Save
              </button>
            </div>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-[#6B6B6B]">
            Tax is charged per line on the discounted price. Services and products can each be
            marked non-taxable individually — useful where labour isn&apos;t taxed but parts are.
          </p>
        </>
      )}
    </div>
  );
}
