"use client";

// Public ad landing page view. Fetches the campaign's public landing data (shop + offer +
// promoted services) from GET /ads/landing/:campaignId and renders a clean, mobile-first
// page with the AdLeadForm. No auth — uses a plain fetch to the public API base.

import React, { useEffect, useState } from "react";
import { Loader2, CalendarCheck } from "lucide-react";
import { AdLeadForm } from "@/components/ads/AdLeadForm";

interface Service { id: string; name: string; priceUsd: number | null; imageUrl: string | null; category: string | null; }
interface Landing { shopId: string; shopName: string; offer: string | null; goal: string | null; services: Service[]; pixelId: string | null; }

// Load the Meta Pixel base code once + fire PageView. Idempotent (guards window.fbq).
function initMetaPixel(pixelId: string) {
  const w = window as any;
  if (!w.fbq) {
    const n: any = function (...args: any[]) {
      n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args);
    };
    n.queue = []; n.push = n; n.loaded = true; n.version = "2.0";
    w.fbq = n;
    if (!w._fbq) w._fbq = n;
    const t = document.createElement("script");
    t.async = true;
    t.src = "https://connect.facebook.net/en_US/fbevents.js";
    const s = document.getElementsByTagName("script")[0];
    s.parentNode?.insertBefore(t, s);
  }
  try { w.fbq("init", pixelId); w.fbq("track", "PageView"); } catch { /* ignore */ }
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

const fmtPrice = (p: number | null) => (p == null ? null : `$${p % 1 === 0 ? p.toFixed(0) : p.toFixed(2)}`);

export const LandingView: React.FC<{ campaignId: string }> = ({ campaignId }) => {
  const [data, setData] = useState<Landing | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/ads/landing/${encodeURIComponent(campaignId)}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((j) => {
        if (!alive) return;
        const d = j.data as Landing;
        setData(d);
        if (d.pixelId) initMetaPixel(d.pixelId); // PageView; Lead fires on form submit
      })
      .catch(() => { if (alive) setFailed(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [campaignId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0F0F0F] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#FFCC00]" />
      </main>
    );
  }

  if (failed || !data) {
    return (
      <main className="min-h-screen bg-[#0F0F0F] flex items-center justify-center px-4">
        <p className="text-gray-400 text-base text-center">This offer isn&apos;t available right now.</p>
      </main>
    );
  }

  // "Book online" deep-links into the customer service view. Single service → open its detail;
  // multiple → the shop's service list. (Auth/registration handled by the app once you land there.)
  const bookUrl = data.services.length === 1
    ? `/customer/shop/${data.shopId}?service=${encodeURIComponent(data.services[0].id)}`
    : `/customer/shop/${data.shopId}`;

  return (
    <main className="min-h-screen bg-[#0F0F0F] text-white">
      <div className="max-w-xl mx-auto px-4 py-8 sm:py-12 space-y-6">
        {/* Shop header */}
        <header className="text-center space-y-1">
          <p className="text-xs uppercase tracking-wide text-gray-500">Special offer from</p>
          <h1 className="text-2xl sm:text-3xl font-bold">{data.shopName}</h1>
        </header>

        {/* Offer banner */}
        {data.offer && (
          <div className="rounded-xl border border-[#FFCC00]/40 bg-[#FFCC00]/10 px-4 py-3 text-center">
            <p className="text-lg font-semibold text-[#FFCC00]">{data.offer}</p>
          </div>
        )}

        {/* Promoted services */}
        {data.services.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-gray-400">What we&apos;re offering</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.services.map((s) => (
                <div key={s.id} className="rounded-xl border border-white/10 bg-[#1A1A1A] overflow-hidden">
                  {s.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.imageUrl} alt={s.name} className="w-full h-32 object-cover" />
                  )}
                  <div className="p-3">
                    <p className="text-base font-medium text-white">{s.name}</p>
                    {fmtPrice(s.priceUsd) && <p className="text-sm text-[#FFCC00] mt-0.5">{fmtPrice(s.priceUsd)}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* CTAs — primary: book online now; secondary: leave details (lead form) */}
        <section className="space-y-4">
          <a
            href={bookUrl}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-[#FFCC00] text-black rounded-xl font-semibold text-base hover:bg-[#E6B800] transition-colors"
          >
            <CalendarCheck className="w-5 h-5" /> Book online now
          </a>

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-gray-500">or just leave your details</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <div className="w-full max-w-md mx-auto">
            <AdLeadForm campaignId={campaignId} title="We'll reach out to you" />
          </div>
        </section>

        <footer className="text-center pt-2">
          <p className="text-xs text-gray-600">Powered by FixFlow</p>
        </footer>
      </div>
    </main>
  );
};

export default LandingView;
