"use client";

// Public ad landing page view. Fetches the campaign's public landing data (shop + offer + promoted
// services + brand + trust signals) from GET /ads/landing/:campaignId and renders a conversion-
// focused, mobile-first lead-magnet page. No auth — plain fetch to the public API base.

import React, { useEffect, useState } from "react";
import { Loader2, Star, MapPin, Quote, Clock, Check, ShieldCheck, Phone } from "lucide-react";
import { AdLeadForm } from "@/components/ads/AdLeadForm";

interface Service { id: string; name: string; priceUsd: number | null; imageUrl: string | null; category: string | null; }
interface Landing {
  shopId: string; shopName: string; offer: string | null; goal: string | null;
  services: Service[]; pixelId: string | null;
  logoUrl: string | null; primaryColor: string | null; secondaryColor: string | null;
  heroImageUrl: string | null; rating: number | null; reviewCount: number;
  testimonial: { quote: string; rating: number } | null; city: string | null; state: string | null;
  // Phase 2 — resolved magnet config:
  headline: string | null; subhead: string | null; urgencyText: string | null;
  benefitBullets: string[]; ctaLabel: string | null; callNow: { phone: string } | null;
}

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
const ACCENT_FALLBACK = "#FFCC00";

const fmtPrice = (p: number | null) => (p == null ? null : `$${p % 1 === 0 ? p.toFixed(0) : p.toFixed(2)}`);
const scrollToForm = () => document.getElementById("lead-form")?.scrollIntoView({ behavior: "smooth", block: "center" });

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

  const accent = data.primaryColor || ACCENT_FALLBACK;
  const location = [data.city, data.state].filter(Boolean).join(", ");
  const showTrust = (data.rating != null && data.reviewCount > 0) || !!location;

  return (
    <main className="min-h-screen bg-[#0F0F0F] text-white pb-24 sm:pb-12">
      <div className="max-w-xl mx-auto px-4 py-8 sm:py-12 space-y-6">
        {/* Shop header — logo when available */}
        <header className="text-center space-y-2">
          {data.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.logoUrl} alt={data.shopName} className="h-12 mx-auto object-contain" />
          ) : null}
          <p className="text-xs uppercase tracking-wide text-gray-500">Special offer from</p>
          <h1 className="text-2xl sm:text-3xl font-bold">{data.shopName}</h1>
        </header>

        {/* Trust bar — rating + location chips */}
        {showTrust && (
          <div className="flex items-center justify-center gap-3 flex-wrap text-sm">
            {data.rating != null && data.reviewCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#1A1A1A] px-3 py-1.5">
                <Star className="w-4 h-4 fill-[#FFCC00] text-[#FFCC00]" />
                <span className="font-semibold">{data.rating}</span>
                <span className="text-gray-400">· {data.reviewCount} review{data.reviewCount === 1 ? "" : "s"}</span>
              </span>
            )}
            {location && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#1A1A1A] px-3 py-1.5 text-gray-300">
                <MapPin className="w-4 h-4 text-gray-400" /> Serving {location}
              </span>
            )}
          </div>
        )}

        {/* Hero image (the approved ad creative / service photo) */}
        {data.heroImageUrl && (
          <div className="rounded-2xl overflow-hidden border border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.heroImageUrl} alt={data.offer || data.shopName} className="w-full max-h-72 object-cover" />
          </div>
        )}

        {/* Urgency / scarcity */}
        {data.urgencyText && (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            <Clock className="w-4 h-4 shrink-0" /> {data.urgencyText}
          </div>
        )}

        {/* Offer headline + subhead */}
        {data.headline && (
          <div className="rounded-xl border px-4 py-4 text-center" style={{ borderColor: `${accent}66`, backgroundColor: `${accent}1A` }}>
            <p className="text-xl font-bold" style={{ color: accent }}>{data.headline}</p>
            {data.subhead && <p className="text-sm text-gray-300 mt-1.5">{data.subhead}</p>}
          </div>
        )}

        {/* Benefit bullets */}
        {data.benefitBullets.length > 0 && (
          <ul className="space-y-2">
            {data.benefitBullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-200">
                <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: accent }} /> {b}
              </li>
            ))}
          </ul>
        )}

        {/* Primary CTA — the magnet form (+ optional call-now + trust badge) */}
        <section id="lead-form" className="w-full">
          <AdLeadForm
            campaignId={campaignId}
            title="Claim this offer — leave your details"
            subtitle="Tell us how to reach you and we'll get right back to you."
            ctaLabel={data.ctaLabel || "Get my free quote"}
            shopName={data.shopName}
            accentColor={accent}
          />
          {data.callNow && (
            <a
              href={`tel:${data.callNow.phone}`}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/15 text-white text-sm font-medium hover:bg-white/5"
            >
              <Phone className="w-4 h-4" /> Or call now: {data.callNow.phone}
            </a>
          )}
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-gray-500">
            <ShieldCheck className="w-3.5 h-3.5" /> Verified FixFlow shop
          </p>
        </section>

        {/* Testimonial — social proof */}
        {data.testimonial && (
          <figure className="rounded-xl border border-white/10 bg-[#1A1A1A] p-4">
            <Quote className="w-5 h-5 text-[#FFCC00] mb-1.5" />
            <blockquote className="text-sm text-gray-200 italic">“{data.testimonial.quote}”</blockquote>
            <figcaption className="mt-2 flex items-center gap-1 text-xs text-gray-400">
              {Array.from({ length: data.testimonial.rating }).map((_, i) => (
                <Star key={i} className="w-3 h-3 fill-[#FFCC00] text-[#FFCC00]" />
              ))}
              <span className="ml-1">Verified customer</span>
            </figcaption>
          </figure>
        )}

        {/* Promoted services — what's on offer */}
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

        <footer className="text-center pt-2">
          <p className="text-xs text-gray-600">Powered by FixFlow</p>
        </footer>
      </div>

      {/* Sticky mobile CTA — always one tap from the form */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-40 p-3 bg-[#0F0F0F]/95 backdrop-blur border-t border-white/10">
        <button
          onClick={scrollToForm}
          style={{ backgroundColor: accent }}
          className="w-full px-4 py-3 text-black rounded-xl font-semibold text-base"
        >
          {data.ctaLabel || "Get my free quote"}
        </button>
      </div>
    </main>
  );
};

export default LandingView;
