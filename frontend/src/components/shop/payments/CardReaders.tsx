"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CreditCard, Loader2, MapPin, Plus, Star, Trash2, Wifi, WifiOff } from "lucide-react";
import {
  cancelTestPayment,
  getTestPaymentStatus,
  listReaders,
  registerReader,
  removeReader,
  setDefaultReader,
  startTestPayment,
  type TerminalReader,
} from "@/services/api/terminal";
import { getLocations, type ShopLocation } from "@/services/api/locations";

const PANEL =
  "rounded-2xl bg-[linear-gradient(90deg,#000000_0%,#1D1D1D_100%)] p-6 md:p-8";

/**
 * How a test authorization reads to the shop. `succeeded` is called out rather than treated as a
 * pass: the test is manual-capture, so a captured charge means money moved when it shouldn't have.
 */
function testPaymentLabel(status: string, amount: number): { text: string; tone: string } {
  const dollars = `$${(amount / 100).toFixed(2)}`;
  switch (status) {
    case "requires_payment_method":
      return { text: "Waiting for a card on the reader…", tone: "text-white" };
    case "processing":
      return { text: "Processing…", tone: "text-white" };
    case "requires_capture":
      return { text: `Authorized ${dollars} — the reader works. Not captured.`, tone: "text-[#22C55E]" };
    case "canceled":
      return { text: "Test finished — authorization released.", tone: "text-[#999999]" };
    case "succeeded":
      return { text: `Captured ${dollars} — this should not happen; refund it.`, tone: "text-[#F87171]" };
    default:
      return { text: status, tone: "text-[#999999]" };
  }
}

export default function CardReaders() {
  const [readers, setReaders] = useState<TerminalReader[]>([]);
  const [locations, setLocations] = useState<ShopLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [showPair, setShowPair] = useState(false);
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [locationId, setLocationId] = useState("");
  const [pairing, setPairing] = useState(false);

  const [testing, setTesting] = useState<{ paymentIntentId: string } | null>(null);
  const [testStatus, setTestStatus] = useState<{ status: string; amount: number } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [readerList, locationList] = await Promise.all([
        listReaders(),
        getLocations().catch(() => [] as ShopLocation[]),
      ]);
      setReaders(readerList);
      setLocations(locationList);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your card readers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Poll while a test is open: the reader accepts the handoff before doing anything, so the
  // outcome only ever arrives on the PaymentIntent.
  useEffect(() => {
    if (!testing) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const status = await getTestPaymentStatus(testing.paymentIntentId);
        if (!cancelled && status) setTestStatus(status);
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
  }, [testing]);

  const primaryFirst = locations.slice().sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));

  const pair = async () => {
    if (!code.trim()) return;
    setPairing(true);
    setError(null);
    try {
      await registerReader({
        registrationCode: code.trim(),
        label: label.trim() || undefined,
        locationId: locationId || undefined,
      });
      setCode("");
      setLabel("");
      setLocationId("");
      setShowPair(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not pair that reader");
    } finally {
      setPairing(false);
    }
  };

  const makeDefault = async (id: string) => {
    setBusyId(id);
    try {
      await setDefaultReader(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not set the default reader");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    setBusyId(id);
    try {
      await removeReader(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove that reader");
    } finally {
      setBusyId(null);
    }
  };

  const runTest = async (id: string) => {
    setBusyId(id);
    setError(null);
    setTestStatus(null);
    try {
      const { paymentIntentId } = await startTestPayment(id);
      setTesting({ paymentIntentId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start a test payment");
    } finally {
      setBusyId(null);
    }
  };

  const endTest = async () => {
    if (!testing) return;
    const { paymentIntentId } = testing;
    setTesting(null);
    await cancelTestPayment(paymentIntentId).catch(() => {});
    try {
      setTestStatus(await getTestPaymentStatus(paymentIntentId));
    } catch {
      setTestStatus(null);
    }
  };

  return (
    <div className={PANEL}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFCC00]/10">
          <CreditCard className="h-4 w-4 text-[#FFCC00]" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-white">Card Readers</h2>
          <p className="text-xs text-[#999999]">
            Take payments in person. Payouts land in the same account as your online payments.
          </p>
        </div>
        <button
          onClick={() => setShowPair((v) => !v)}
          className="ml-auto inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-md bg-[#FFCC00] px-3 text-sm font-medium text-black transition-colors hover:bg-[#E5BB00]"
        >
          <Plus className="h-4 w-4" /> Add reader
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-[#F87171]/30 bg-[#F87171]/[0.08] p-3 text-sm text-[#F87171]">
          {error}
        </div>
      )}

      {showPair && (
        <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <p className="text-xs leading-relaxed text-[#999999]">
            On the reader, enter its settings and generate a pairing code, then type it here.
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Pairing code"
              className="h-11 flex-1 rounded-md border border-[#303236] bg-[#141414] px-3 text-sm text-white placeholder:text-[#6B6B6B] focus:border-[#FFCC00] focus:outline-none"
            />
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Name (optional)"
              className="h-11 flex-1 rounded-md border border-[#303236] bg-[#141414] px-3 text-sm text-white placeholder:text-[#6B6B6B] focus:border-[#FFCC00] focus:outline-none"
            />
          </div>

          {primaryFirst.length > 1 && (
            <div className="mt-3">
              <label className="text-xs text-[#999999]">Location</label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="mt-1 h-11 w-full rounded-md border border-[#303236] bg-[#141414] px-3 text-sm text-white focus:border-[#FFCC00] focus:outline-none"
              >
                <option value="">
                  {primaryFirst.find((l) => l.isPrimary)?.name ?? "Primary location"} (default)
                </option>
                {primaryFirst
                  .filter((l) => !l.isPrimary)
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
              </select>
            </div>
          )}

          <button
            onClick={pair}
            disabled={pairing || !code.trim()}
            className="mt-3 inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-md bg-[#FFCC00] px-5 text-sm font-medium text-black transition-colors hover:bg-[#E5BB00] disabled:opacity-50 sm:w-auto"
          >
            {pairing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pair"}
          </button>
        </div>
      )}

      {loading ? (
        <div className="mt-6 flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-[#FFCC00]" />
        </div>
      ) : readers.length === 0 ? (
        <p className="mt-6 text-sm text-[#999999]">
          No readers yet. Pair one to start taking payments at the counter.
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {readers.map((reader) => {
            const online = reader.status === "online";
            const busy = busyId === reader.id;
            return (
              <li
                key={reader.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.04]">
                  {online ? (
                    <Wifi className="h-4 w-4 text-[#22C55E]" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-[#6B6B6B]" />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium text-white">
                    {reader.label || reader.stripeReaderId}
                    {reader.isDefault && (
                      <span className="rounded-full bg-[#FFCC00]/15 px-2 py-0.5 text-[10px] font-medium text-[#FFCC00]">
                        Default
                      </span>
                    )}
                  </p>
                  <p className="flex items-center gap-1.5 truncate text-xs text-[#6B6B6B]">
                    {reader.locationName && (
                      <>
                        <MapPin className="h-3 w-3 shrink-0" />
                        {reader.locationName}
                        <span className="text-[#3A3A3A]">·</span>
                      </>
                    )}
                    {[reader.deviceType, reader.serialNumber].filter(Boolean).join(" · ") ||
                      reader.stripeReaderId}
                  </p>
                </div>

                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                    online ? "bg-[#22C55E]/15 text-[#22C55E]" : "bg-white/10 text-[#999999]"
                  }`}
                >
                  {online ? "Online" : "Offline"}
                </span>

                <div className="flex shrink-0 items-center gap-2">
                  {!reader.isDefault && (
                    <button
                      onClick={() => makeDefault(reader.id)}
                      disabled={busy}
                      title="Make default for this location"
                      className="cursor-pointer rounded-md border border-[#303236] p-2 text-[#999999] transition-colors hover:text-[#FFCC00] disabled:opacity-50"
                    >
                      <Star className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => runTest(reader.id)}
                    disabled={busy || !!testing}
                    className="cursor-pointer rounded-md border border-[#303236] px-3 py-2 text-xs font-medium text-[#999999] transition-colors hover:text-white disabled:opacity-50"
                  >
                    Test
                  </button>
                  <button
                    onClick={() => remove(reader.id)}
                    disabled={busy}
                    title="Remove"
                    className="cursor-pointer rounded-md border border-[#303236] p-2 text-[#999999] transition-colors hover:text-[#F87171] disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {(testing || testStatus) && (
        <div className="mt-5 rounded-xl border border-[#FFCC00]/30 bg-[#FFCC00]/[0.08] p-4">
          {testStatus ? (
            <p className={`text-sm ${testPaymentLabel(testStatus.status, testStatus.amount).tone}`}>
              {testPaymentLabel(testStatus.status, testStatus.amount).text}
            </p>
          ) : (
            <p className="flex items-center gap-2 text-sm text-white">
              <Loader2 className="h-4 w-4 animate-spin" /> Sending to the reader…
            </p>
          )}
          <p className="mt-1 text-xs text-[#999999]">
            $1.00 authorization only — it is never captured, so no money leaves the card.
          </p>
          {testing ? (
            <button
              onClick={endTest}
              className="mt-3 cursor-pointer rounded-md border border-[#303236] px-4 py-2 text-sm font-medium text-[#999999] transition-colors hover:text-white"
            >
              Finish test
            </button>
          ) : (
            <button
              onClick={() => setTestStatus(null)}
              className="mt-3 cursor-pointer rounded-md border border-[#303236] px-4 py-2 text-sm font-medium text-[#999999] transition-colors hover:text-white"
            >
              Dismiss
            </button>
          )}
        </div>
      )}
    </div>
  );
}
