"use client";

// Ads System Stage 2 — public landing-page lead form. Drop onto any ad landing
// page; it captures UTM params on mount and posts the lead (with attribution) to
// the public /ads/leads/webform endpoint. campaignId comes from the prop or the
// captured utm_campaign, so a creative's landing URL alone is enough to attribute.

import React, { useEffect, useState } from "react";
import { Loader2, CheckCircle } from "lucide-react";
import { submitWebformLead } from "@/services/api/ads";
import { captureUtmFromUrl, getStoredUtm } from "@/utils/adsUtm";

export interface AdLeadFormProps {
  /** Optional explicit campaign id; otherwise taken from utm_campaign. */
  campaignId?: string;
  /** Headline shown above the form. */
  title?: string;
}

export const AdLeadForm: React.FC<AdLeadFormProps> = ({ campaignId, title = "Get a quote" }) => {
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { captureUtmFromUrl(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.phone.trim() && !form.email.trim()) {
      setError("Please add a phone number or email so we can reach you.");
      return;
    }
    const { utm, clickId } = getStoredUtm();
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
      });
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
        <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
        <p className="text-base font-medium text-white">Thanks — we&apos;ll be in touch shortly.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-gray-700 bg-[#1A1A1A] p-5 space-y-3 max-w-md">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <input className={cls} placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <input className={cls} type="tel" placeholder="Phone number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      <input className={cls} type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#FFCC00] text-black rounded-lg font-medium hover:bg-[#E6B800] disabled:opacity-50 transition-colors"
      >
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {submitting ? "Sending…" : "Send"}
      </button>
      <p className="text-xs text-gray-500">By submitting, you agree to be contacted about your request.</p>
    </form>
  );
};

const cls = "w-full px-3 py-2 bg-[#0F0F0F] border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] transition-colors";

export default AdLeadForm;
