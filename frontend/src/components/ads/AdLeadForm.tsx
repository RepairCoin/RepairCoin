"use client";

// Ads System Stage 2 — public landing-page lead form. Drop onto any ad landing
// page; it captures UTM params on mount and posts the lead (with attribution) to
// the public /ads/leads/webform endpoint. campaignId comes from the prop or the
// captured utm_campaign, so a creative's landing URL alone is enough to attribute.

import React, { useEffect, useState } from "react";
import { Loader2, CheckCircle, ShieldCheck } from "lucide-react";
import { submitWebformLead } from "@/services/api/ads";
import { captureUtmFromUrl, getStoredUtm } from "@/utils/adsUtm";

export interface AdLeadFormProps {
  /** Optional explicit campaign id; otherwise taken from utm_campaign. */
  campaignId?: string;
  /** Headline shown above the form. */
  title?: string;
  /** Optional sub-line under the title (e.g. risk reversal). */
  subtitle?: string;
  /** CTA button label (magnet framing — e.g. "Get my free quote"). */
  ctaLabel?: string;
  /** Shop name, used in the confirmation message. */
  shopName?: string;
  /** Brand accent color for the CTA (hex). Falls back to FixFlow yellow. */
  accentColor?: string | null;
}

const ACCENT_FALLBACK = "#FFCC00";

export const AdLeadForm: React.FC<AdLeadFormProps> = ({
  campaignId,
  title = "Get a quote",
  subtitle,
  ctaLabel = "Get my free quote",
  shopName,
  accentColor,
}) => {
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accent = accentColor || ACCENT_FALLBACK;

  useEffect(() => { captureUtmFromUrl(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.phone.trim() && !form.email.trim()) {
      setError("Please add a phone number or email so we can reach you.");
      return;
    }
    const { utm, clickId, gclid, fbclid } = getStoredUtm();
    const resolvedCampaign = campaignId || utm.utm_campaign;
    if (!resolvedCampaign) {
      setError("This form isn't linked to a campaign yet.");
      return;
    }
    setSubmitting(true);
    try {
      await submitWebformLead({
        campaignId: resolvedCampaign,
        name: form.name.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        utm,
        clickId,
        gclid,
        fbclid,
      });
      // Fire the Meta Pixel "Lead" conversion (no-op if the landing page didn't load a pixel).
      try { (window as any).fbq?.("track", "Lead"); } catch { /* ignore */ }
      setDone(true);
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-xl border border-green-500/30 bg-green-900/10 p-6 text-center">
        <CheckCircle className="w-9 h-9 text-green-400 mx-auto mb-2" />
        <p className="text-base font-semibold text-white">You&apos;re all set! 🎉</p>
        <p className="text-sm text-gray-300 mt-1">
          {shopName ? `${shopName} will reach out shortly` : "We'll reach out shortly"} — keep an eye on your phone.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-gray-700 bg-[#1A1A1A] p-5 space-y-3 shadow-xl">
      <div>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {/* Phone-first: it's the fastest contact channel AND the account-claim key. */}
      <input className={cls} type="tel" inputMode="tel" placeholder="Phone number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      <input className={cls} placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <input className={cls} type="email" placeholder="Email (optional)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        style={{ backgroundColor: accent }}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-black rounded-xl font-semibold text-base hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {submitting ? "Sending…" : ctaLabel}
      </button>
      <p className="text-xs text-gray-500 flex items-center justify-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5" /> No obligation · we never share your details.
      </p>
    </form>
  );
};

const cls = "w-full px-3 py-2.5 bg-[#0F0F0F] border border-gray-700 rounded-lg text-white text-base placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] transition-colors";

export default AdLeadForm;
