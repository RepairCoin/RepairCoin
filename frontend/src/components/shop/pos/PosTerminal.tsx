"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote,
  CreditCard,
  Loader2,
  Package,
  Plus,
  Search,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import {
  addItem,
  cancelCardPayment,
  completeSale,
  createSale,
  formatCents,
  removeItem,
  startCardPayment,
  syncCardPayment,
  takeCash,
  voidSale,
  type PosSale,
} from "@/services/api/pos";
import { getShopServices, type ShopService } from "@/services/api/services";
import { inventoryApi } from "@/services/api/inventory";
import { listReaders, type TerminalReader } from "@/services/api/terminal";
import { getLocations, type ShopLocation } from "@/services/api/locations";
import { readPosLocation } from "./posLocation";
import type { InventoryItem } from "@/types/inventory";

const CARD =
  "rounded-2xl bg-[linear-gradient(90deg,#000000_0%,#1D1D1D_100%)] p-5";
const INPUT =
  "h-11 w-full rounded-md border border-[#303236] bg-[#141414] px-3 text-sm text-white placeholder:text-[#6B6B6B] focus:border-[#FFCC00] focus:outline-none";

type CatalogTab = "services" | "products";

export default function PosTerminal({ onExit }: { onExit?: () => void }) {
  const shopId = useAuthStore((s) => s.userProfile?.shopId);

  const [sale, setSale] = useState<PosSale | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<CatalogTab>("services");
  const [search, setSearch] = useState("");
  const [services, setServices] = useState<ShopService[]>([]);
  const [products, setProducts] = useState<InventoryItem[]>([]);

  // A till sits at one branch, so the register reads its location from the device rather than
  // asking per sale. Null means single-location (or never chosen) and the backend falls back
  // to the shop's primary.
  const [locationId, setLocationId] = useState<string | null>(null);
  const [locations, setLocations] = useState<ShopLocation[]>([]);
  const [readers, setReaders] = useState<TerminalReader[]>([]);
  const [cardLeg, setCardLeg] = useState<{ paymentId: string } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [cashOpen, setCashOpen] = useState(false);
  const [tendered, setTendered] = useState("");
  const [receipt, setReceipt] = useState<PosSale | null>(null);

  // A sale row is only created once something is actually being sold. Creating one on mount
  // would leave an abandoned `open` row behind every time the register is opened and walked
  // away from, and an empty cart needs no server state to hold it.
  const ensureSale = useCallback(async (): Promise<PosSale> => {
    if (sale) return sale;
    const created = await createSale(locationId ? { locationId } : {});
    setSale(created);
    return created;
  }, [sale, locationId]);

  const openSale = useCallback(() => {
    setSale(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (!shopId) return;
    getShopServices(shopId, { limit: 100 })
      .then((r) => setServices((r?.data ?? []).filter((s) => s.active)))
      .catch(() => setServices([]));
    inventoryApi
      .getItems({}, 1, 100)
      .then((r) => setProducts(r?.items ?? []))
      .catch(() => setProducts([]));
    listReaders()
      .then(setReaders)
      .catch(() => setReaders([]));
    getLocations()
      .then(setLocations)
      .catch(() => setLocations([]));
    setLocationId(readPosLocation());
  }, [shopId]);

  // Only readers at this register's branch. Without this a till at one branch can push a
  // payment to another branch's reader, which the customer standing here cannot tap.
  const localReaders = useMemo(
    () => (locationId ? readers.filter((r) => r.shopLocationId === locationId) : readers),
    [readers, locationId]
  );

  const locationName = useMemo(
    () => (locationId ? locations.find((l) => l.id === locationId)?.name ?? null : null),
    [locations, locationId]
  );

  // A card leg only resolves on the PaymentIntent — the reader accepts the handoff before it
  // has done anything, so nothing else can tell us whether the customer actually paid.
  useEffect(() => {
    if (!sale || !cardLeg) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const next = await syncCardPayment(sale.id, cardLeg.paymentId);
        if (cancelled) return;
        setSale(next);
        const leg = next.payments.find((p) => p.id === cardLeg.paymentId);
        if (leg && leg.status !== "processing" && leg.status !== "pending") {
          setCardLeg(null);
          if (leg.status === "failed") {
            setError(leg.failureReason || "The card was declined.");
          }
        }
      } catch {
        /* transient — keep polling */
      }
    };

    tick();
    pollRef.current = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [sale?.id, cardLeg]);

  const run = async (fn: () => Promise<PosSale>) => {
    setBusy(true);
    setError(null);
    try {
      setSale(await fn());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const filteredServices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? services.filter((s) => s.serviceName.toLowerCase().includes(q)) : services;
  }, [services, search]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? products.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.sku ?? "").toLowerCase().includes(q) ||
            (p.barcode ?? "").toLowerCase().includes(q)
        )
      : products;
  }, [products, search]);

  const finish = async () => {
    if (!sale) return;
    setBusy(true);
    setError(null);
    try {
      const done = await completeSale(sale.id);
      setReceipt(done);
      setSale(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not complete the sale");
    } finally {
      setBusy(false);
    }
  };

  const discard = async () => {
    if (!sale) return;
    await voidSale(sale.id, "cleared at register").catch(() => {});
    setCashOpen(false);
    setCardLeg(null);
    openSale();
  };

  if (receipt) {
    return (
      <div className="mx-auto max-w-[520px] px-6 py-12">
        <div className={CARD}>
          <p className="text-sm text-[#999999]">Sale #{receipt.saleNumber}</p>
          <p className="mt-1 text-3xl font-bold text-[#FFCC00]">
            {formatCents(receipt.totalCents)}
          </p>
          <ul className="mt-5 space-y-2 border-t border-white/10 pt-4">
            {receipt.items.map((i) => (
              <li key={i.id} className="flex justify-between text-sm text-[#999999]">
                <span className="truncate pr-3">
                  {i.quantity} × {i.name}
                </span>
                <span className="shrink-0 text-white">{formatCents(i.totalCents)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 space-y-1 border-t border-white/10 pt-4 text-sm">
            <Row label="Subtotal" value={formatCents(receipt.subtotalCents)} />
            {receipt.discountCents > 0 && (
              <Row label="Discount" value={`−${formatCents(receipt.discountCents)}`} />
            )}
            <Row label="Tax" value={formatCents(receipt.taxCents)} />
          </div>
          <button
            onClick={() => {
              setReceipt(null);
              openSale();
            }}
            className="mt-6 h-12 w-full cursor-pointer rounded-md bg-[#FFCC00] text-base font-medium text-black transition-colors hover:bg-[#E5BB00]"
          >
            New sale
          </button>
          {onExit && (
            <button
              onClick={onExit}
              className="mt-3 h-11 w-full cursor-pointer rounded-md border border-[#303236] text-sm font-medium text-[#999999] transition-colors hover:text-white"
            >
              Close register
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6">
      {error && (
        <div className="mb-4 flex items-start gap-3 rounded-md border border-[#F87171]/30 bg-[#F87171]/[0.08] p-3 text-sm text-[#F87171]">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
        {/* Catalogue */}
        <div className={CARD}>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setTab("services")}
              className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors ${
                tab === "services" ? "bg-[#FFCC00] text-black" : "text-[#999999] hover:text-white"
              }`}
            >
              <Wrench className="h-4 w-4" /> Services
            </button>
            <button
              onClick={() => setTab("products")}
              className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors ${
                tab === "products" ? "bg-[#FFCC00] text-black" : "text-[#999999] hover:text-white"
              }`}
            >
              <Package className="h-4 w-4" /> Products
            </button>
            <div className="relative ml-auto min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B6B6B]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search or scan…"
                className={`${INPUT} pl-9`}
              />
            </div>
          </div>

          <div className="mt-4 grid max-h-[62vh] gap-2 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
            {tab === "services"
              ? filteredServices.map((s) => (
                  <Tile
                    key={s.serviceId}
                    name={s.serviceName}
                    price={formatCents(Math.round(s.priceUsd * 100))}
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        const target = await ensureSale();
                        return addItem(target.id, { kind: "service", serviceId: s.serviceId });
                      })
                    }
                  />
                ))
              : filteredProducts.map((p) => (
                  <Tile
                    key={p.id}
                    name={p.name}
                    price={formatCents(Math.round(p.price * 100))}
                    hint={p.stockQuantity <= 0 ? "Out of stock" : `${p.stockQuantity} in stock`}
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        const target = await ensureSale();
                        return addItem(target.id, { kind: "product", inventoryItemId: p.id });
                      })
                    }
                  />
                ))}
            {((tab === "services" && filteredServices.length === 0) ||
              (tab === "products" && filteredProducts.length === 0)) && (
              <p className="col-span-full py-8 text-center text-sm text-[#6B6B6B]">
                Nothing matches “{search}”.
              </p>
            )}
          </div>
        </div>

        {/* Cart */}
        <div className={`${CARD} flex flex-col`}>
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-white">Current sale</h2>
              {locationName && (
                <p className="truncate text-xs text-[#6B6B6B]">{locationName}</p>
              )}
            </div>
            {sale && sale.items.length > 0 && (
              <button
                onClick={discard}
                className="shrink-0 cursor-pointer text-xs text-[#6B6B6B] transition-colors hover:text-[#F87171]"
              >
                Clear
              </button>
            )}
          </div>

          <div className="mt-4 min-h-[160px] flex-1 space-y-2 overflow-y-auto">
            {!sale || sale.items.length === 0 ? (
              <p className="py-10 text-center text-sm text-[#6B6B6B]">
                Tap a service or product to start.
              </p>
            ) : (
              sale.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white">{item.name}</p>
                    <p className="text-xs text-[#6B6B6B]">
                      {item.quantity} × {formatCents(item.unitPriceCents)}
                      {item.taxCents > 0 && ` · tax ${formatCents(item.taxCents)}`}
                      {!item.taxable && " · no tax"}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm text-white">
                    {formatCents(item.totalCents)}
                  </span>
                  <button
                    onClick={() => run(() => removeItem(sale.id, item.id))}
                    disabled={busy}
                    className="shrink-0 cursor-pointer text-[#6B6B6B] transition-colors hover:text-[#F87171] disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          {sale && sale.items.length > 0 && (
            <>
              <div className="mt-4 space-y-1 border-t border-white/10 pt-4 text-sm">
                <Row label="Subtotal" value={formatCents(sale.subtotalCents)} />
                {sale.discountCents > 0 && (
                  <Row label="Discount" value={`−${formatCents(sale.discountCents)}`} />
                )}
                <Row label="Tax" value={formatCents(sale.taxCents)} />
                <div className="flex justify-between pt-2 text-base font-semibold text-white">
                  <span>Total</span>
                  <span>{formatCents(sale.totalCents)}</span>
                </div>
                {sale.paidCents > 0 && (
                  <>
                    <Row label="Paid" value={formatCents(sale.paidCents)} />
                    <div className="flex justify-between text-sm font-medium text-[#FFCC00]">
                      <span>Balance</span>
                      <span>{formatCents(sale.balanceCents)}</span>
                    </div>
                  </>
                )}
              </div>

              {sale.balanceCents <= 0 ? (
                <button
                  onClick={finish}
                  disabled={busy}
                  className="mt-4 h-12 w-full cursor-pointer rounded-md bg-[#22C55E] text-base font-medium text-black transition-colors hover:bg-[#16A34A] disabled:opacity-50"
                >
                  {busy ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : "Complete sale"}
                </button>
              ) : cardLeg ? (
                <div className="mt-4 rounded-lg border border-[#FFCC00]/30 bg-[#FFCC00]/[0.08] p-3">
                  <p className="flex items-center gap-2 text-sm text-white">
                    <Loader2 className="h-4 w-4 animate-spin" /> Waiting for the card…
                  </p>
                  <button
                    onClick={() =>
                      run(async () => {
                        const next = await cancelCardPayment(sale.id, cardLeg.paymentId);
                        setCardLeg(null);
                        return next;
                      })
                    }
                    className="mt-2 cursor-pointer text-xs text-[#999999] underline underline-offset-4 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              ) : cashOpen ? (
                <CashPad
                  balanceCents={sale.balanceCents}
                  tendered={tendered}
                  onTendered={setTendered}
                  busy={busy}
                  onCancel={() => {
                    setCashOpen(false);
                    setTendered("");
                  }}
                  onConfirm={() => {
                    const given = Math.round(Number(tendered || "0") * 100);
                    run(async () => {
                      const next = await takeCash(
                        sale.id,
                        sale.balanceCents,
                        given > 0 ? given : undefined
                      );
                      setCashOpen(false);
                      setTendered("");
                      return next;
                    });
                  }}
                />
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setCashOpen(true)}
                    disabled={busy}
                    className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-md border border-[#303236] text-sm font-medium text-white transition-colors hover:bg-white/[0.04] disabled:opacity-50"
                  >
                    <Banknote className="h-4 w-4" /> Cash
                  </button>
                  <button
                    onClick={() => {
                      const reader =
                        localReaders.find((r) => r.isDefault) ?? localReaders[0];
                      if (!reader) {
                        setError(
                          locationName
                            ? `No card reader paired at ${locationName}. Pair one in Get Paid → Card Readers, or take cash.`
                            : "Pair a card reader first — Get Paid → Card Readers."
                        );
                        return;
                      }
                      run(async () => {
                        const started = await startCardPayment(sale.id, reader.id);
                        setCardLeg({ paymentId: started.salePaymentId });
                        return started.sale;
                      });
                    }}
                    disabled={busy}
                    className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-md bg-[#FFCC00] text-sm font-medium text-black transition-colors hover:bg-[#E5BB00] disabled:opacity-50"
                  >
                    <CreditCard className="h-4 w-4" /> Card
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[#999999]">
      <span>{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}

function Tile({
  name,
  price,
  hint,
  disabled,
  onClick,
}: {
  name: string;
  price: string;
  hint?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-[76px] cursor-pointer flex-col justify-between rounded-lg border border-white/10 bg-white/[0.02] p-3 text-left transition-colors hover:border-[#FFCC00]/40 disabled:opacity-50"
    >
      <span className="line-clamp-2 text-sm text-white">{name}</span>
      <span className="mt-1 flex items-center justify-between">
        <span className="text-sm font-medium text-[#FFCC00]">{price}</span>
        {hint && <span className="text-[10px] text-[#6B6B6B]">{hint}</span>}
      </span>
    </button>
  );
}

function CashPad({
  balanceCents,
  tendered,
  onTendered,
  busy,
  onCancel,
  onConfirm,
}: {
  balanceCents: number;
  tendered: string;
  onTendered: (v: string) => void;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const given = Math.round(Number(tendered || "0") * 100);
  const change = given > balanceCents ? given - balanceCents : 0;

  return (
    <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.02] p-3">
      <label className="text-xs text-[#999999]">Cash received</label>
      <input
        value={tendered}
        onChange={(e) => onTendered(e.target.value)}
        placeholder={(balanceCents / 100).toFixed(2)}
        inputMode="decimal"
        autoFocus
        className={`${INPUT} mt-1`}
      />
      {change > 0 && (
        <p className="mt-2 text-sm text-[#22C55E]">Change due {formatCents(change)}</p>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={onCancel}
          className="h-11 cursor-pointer rounded-md border border-[#303236] text-sm text-[#999999] transition-colors hover:text-white"
        >
          Back
        </button>
        <button
          onClick={onConfirm}
          disabled={busy}
          className="inline-flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-[#FFCC00] text-sm font-medium text-black transition-colors hover:bg-[#E5BB00] disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Take {formatCents(balanceCents)}
        </button>
      </div>
    </div>
  );
}
