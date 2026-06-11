"use client";

import React, { useEffect, useState } from "react";
import { Palette, Loader2, Save, Sparkles, Wand2, Type } from "lucide-react";
import toast from "react-hot-toast";
import {
  getBrandKit, updateBrandKit, analyzeLogo, fontPairForStyle, MARKETING_STYLE_OPTIONS,
  generateShopBanner,
  type BrandKit,
} from "@/services/api/aiBrandKit";
import { ImageUploader } from "./ImageUploader";
import { BrandingStudio } from "./branding-studio/BrandingStudio";
import { BrandTemplatesPanel } from "./branding-studio/BrandTemplatesPanel";
import { useAuthStore } from "@/stores/authStore";
import { updateShopProfile } from "@/services/api/shop";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const isValidHex = (v: string) => v === "" || HEX_RE.test(v);

/**
 * Brand Kit settings — the single editable home for the shop's brand profile.
 * Edits EVERY field the Branding Studio wizard collects (logo, colors, marketing
 * style, voice, headline, personality, industry, tone); the AI applies them to
 * every image + campaign. Reads/writes /api/ai/brand-kit (shop-scoped via JWT).
 * The on-demand template gallery lives below (BrandTemplatesPanel).
 */
export const BrandKitSettings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [primary, setPrimary] = useState("");
  const [secondary, setSecondary] = useState("");
  const [tone, setTone] = useState("");
  const [marketingStyle, setMarketingStyle] = useState("");
  const [voice, setVoice] = useState("");
  const [headline, setHeadline] = useState("");
  const [personality, setPersonality] = useState("");
  const [industry, setIndustry] = useState("");
  // ONE shop logo (shops.logo_url) — the same image used across the profile,
  // receipts, and AI images. Editable here, in the wizard, and in Shop Profile;
  // all write the same field (no separate "AI override").
  const [logoUrl, setLogoUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [bannerPrompt, setBannerPrompt] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [generatingBanner, setGeneratingBanner] = useState(false);
  // Re-run the Branding Studio wizard from here (edit mode — lands back here).
  const [showStudio, setShowStudio] = useState(false);

  const shopId = useAuthStore((s) => s.userProfile?.shopId);
  const fonts = fontPairForStyle(marketingStyle || null);

  const applyKit = (k: BrandKit) => {
    setPrimary(k.primaryColorHex || "");
    setSecondary(k.secondaryColorHex || "");
    setTone(k.toneNotes || "");
    setMarketingStyle(k.marketingStyle || "");
    setVoice(k.brandVoice || "");
    setHeadline(k.headline || "");
    setPersonality(k.brandPersonality || "");
    setIndustry(k.industryStyle || "");
    // Canonical shop logo (fall back to the effective logo for legacy overrides).
    setLogoUrl(k.shopLogoUrl || k.logoUrl || "");
    setBannerUrl(k.shopBannerUrl || "");
  };

  useEffect(() => {
    getBrandKit()
      .then(applyKit)
      .catch(() => {
        /* no kit yet — start blank */
      })
      .finally(() => setLoading(false));
  }, []);

  // Live font preview for the typography card.
  useEffect(() => {
    const fam = (n: string) => `family=${n.trim().replace(/\s+/g, "+")}:wght@400;700`;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?${fam(fonts.heading)}&${fam(fonts.body)}&display=swap`;
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, [fonts.heading, fonts.body]);

  const save = async () => {
    if (!isValidHex(primary) || !isValidHex(secondary)) {
      toast.error("Colors must be a hex value like #FFCC00.");
      return;
    }
    if (tone.length > 500) {
      toast.error("Brand tone must be 500 characters or fewer.");
      return;
    }
    setSaving(true);
    try {
      // The logo IS the shop logo — persist it to shops.logo_url so it's the same
      // image everywhere. (Requires the shop id; the profile endpoint is id-scoped.)
      if (shopId) {
        await updateShopProfile(shopId, { logoUrl: logoUrl || "", bannerUrl: bannerUrl || "" });
      }
      await updateBrandKit({
        logoUrl: null, // no more AI override — the effective logo is the shop logo
        primaryColorHex: primary || null,
        secondaryColorHex: secondary || null,
        toneNotes: tone.trim() || null,
        marketingStyle: marketingStyle || null,
        brandVoice: voice.trim() || null,
        headline: headline.trim() || null,
        brandPersonality: personality.trim() || null,
        industryStyle: industry.trim() || null,
        headingFont: fonts.heading,
        bodyFont: fonts.body,
      });
      toast.success("Brand kit saved.");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't save the brand kit. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const suggestColors = async () => {
    if (!logoUrl) {
      toast.error("Add your shop logo first, then I can read its colors.");
      return;
    }
    setAnalyzing(true);
    try {
      const s = await analyzeLogo(logoUrl);
      if (s.primaryColorHex) setPrimary(s.primaryColorHex);
      if (s.secondaryColorHex) setSecondary(s.secondaryColorHex);
      if (s.primaryColorHex || s.secondaryColorHex) {
        toast.success(
          s.description
            ? `Colors suggested from your logo — ${s.description}`
            : "Colors suggested from your logo."
        );
      } else {
        toast("Couldn't read clear colors — please enter them manually.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Couldn't analyze the logo. Try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const generateBanner = async () => {
    setGeneratingBanner(true);
    try {
      const url = await generateShopBanner(bannerPrompt.trim() || undefined);
      setBannerUrl(url);
      toast.success("Banner generated — remember to save.");
    } catch (e: any) {
      // 403 (AI images off) / 429 (budget) surface the server message.
      toast.error(e?.message || "Couldn't generate a banner. Please try again.");
    } finally {
      setGeneratingBanner(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400 text-sm py-8">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading brand kit…
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-2">
        <h2 className="text-xl font-semibold text-[#FFCC00] flex items-center gap-2">
          <Palette className="w-5 h-5" /> Brand Kit
        </h2>
        <button
          type="button"
          onClick={() => setShowStudio(true)}
          className="inline-flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-md bg-[#1A1A1A] border border-gray-700 text-gray-200 hover:border-[#FFCC00] hover:text-white transition-colors shrink-0"
        >
          <Wand2 className="w-4 h-4 text-[#FFCC00]" /> Set up with AI
        </button>
      </div>
      <p className="text-sm text-gray-400 mb-6">
        Your brand identity — colors, voice, and style. The AI applies these to
        every image and campaign so your marketing looks on-brand, and stamps your{" "}
        <span className="text-gray-300">logo</span> on generated images. Prefer a
        guided setup? Use <span className="text-gray-300">Set up with AI</span>.
      </p>

      {/* Re-run the guided wizard; on finish/close it lands back here, refreshed. */}
      <BrandingStudio
        open={showStudio}
        origin="settings"
        onClose={() => setShowStudio(false)}
        onComplete={(kit) => {
          setShowStudio(false);
          if (kit) applyKit(kit);
        }}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-8 border-t border-[#3F3F3F] pt-6">
        {/* All editable brand fields */}
        <div className="space-y-5 order-2 xl:order-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <ColorField label="Primary color" value={primary} onChange={setPrimary} />
            <ColorField label="Secondary color" value={secondary} onChange={setSecondary} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Marketing style
            </label>
            <select
              value={marketingStyle}
              onChange={(e) => setMarketingStyle(e.target.value)}
              className="w-full px-3 py-2 bg-[#1A1A1A] border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFCC00] transition-colors"
            >
              <option value="">— Select a style —</option>
              {MARKETING_STYLE_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <TextField label="Headline" value={headline} onChange={setHeadline} placeholder="Fast Repairs. Trusted Service." />
            <TextField label="Voice" value={voice} onChange={setVoice} placeholder="Professional but Friendly" />
            <TextField label="Brand personality" value={personality} onChange={setPersonality} placeholder="Professional • Friendly • Trustworthy" />
            <TextField label="Industry style" value={industry} onChange={setIndustry} placeholder="Repair & Service Business" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Brand tone notes
            </label>
            <textarea
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="e.g. Warm, neighborhood repair shop — friendly and trustworthy"
              className="w-full px-3 py-2 bg-[#1A1A1A] border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] transition-colors resize-none"
            />
            <p className="mt-1 text-xs text-gray-500">
              {tone.length}/500 — a sentence or two describing your brand's vibe.
            </p>
          </div>

          {/* Typography — derived from the marketing style (live preview). */}
          <div className="rounded-lg bg-[#1A1A1A] border border-gray-700 p-3.5">
            <p className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5" /> Typography (from your marketing style)
            </p>
            <p className="text-lg text-white leading-tight" style={{ fontFamily: `'${fonts.heading}', sans-serif` }}>
              {fonts.heading}
            </p>
            <p className="text-sm text-gray-300" style={{ fontFamily: `'${fonts.body}', sans-serif` }}>
              {fonts.body} — the quick brown fox jumps over the lazy dog.
            </p>
          </div>
        </div>

        {/* The ONE shop logo — same image everywhere. */}
        <div className="order-1 xl:order-2">
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Shop logo
          </label>

          <ImageUploader
            imageType="logo"
            currentImageUrl={logoUrl || undefined}
            onUploadSuccess={(url) => {
              setLogoUrl(url);
              toast.success("Logo uploaded — remember to save.");
            }}
            onRemove={
              logoUrl
                ? () => {
                    setLogoUrl("");
                    toast("Logo removed — remember to save.");
                  }
                : undefined
            }
            showPreview
          />
          <p className="mt-2 text-xs text-gray-500">
            Your one shop logo — used across your{" "}
            <span className="text-gray-300">profile, receipts, and AI images</span>{" "}
            (stamped bottom-right). You can also change it in{" "}
            <span className="text-gray-300">Shop Profile</span>; it&apos;s the same logo.
          </p>
          <button
            type="button"
            onClick={suggestColors}
            disabled={!logoUrl || analyzing}
            className="mt-3 inline-flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-md bg-[#1A1A1A] border border-gray-700 text-gray-300 hover:border-[#FFCC00] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {analyzing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-[#FFCC00]" />
            )}
            {analyzing ? "Reading your logo…" : "Suggest colors from logo"}
          </button>
        </div>
      </div>

      {/* Shop banner — FULL WIDTH (it's a wide header image). Same banner everywhere. */}
      <div className="mt-8 border-t border-[#3F3F3F] pt-6">
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Shop banner
        </label>
        <p className="text-xs text-gray-500 mb-3">
          Your shop&apos;s header image — used on your{" "}
          <span className="text-gray-300">profile and marketplace</span>. Let AI create
          an on-brand one (counts toward your AI budget), or upload your own. Same banner
          as <span className="text-gray-300">Shop Profile</span>.
        </p>
        <ImageUploader
          imageType="banner"
          currentImageUrl={bannerUrl || undefined}
          onUploadSuccess={(url) => {
            setBannerUrl(url);
            toast.success("Banner uploaded — remember to save.");
          }}
          onRemove={
            bannerUrl
              ? () => {
                  setBannerUrl("");
                  toast("Banner removed — remember to save.");
                }
              : undefined
          }
          showPreview
        />
        <div className="mt-3 flex flex-col sm:flex-row gap-2 sm:items-center">
          <input
            type="text"
            value={bannerPrompt}
            onChange={(e) => setBannerPrompt(e.target.value)}
            maxLength={500}
            placeholder="Tell the AI what to show — e.g. 'phone repair promo, cracked screen being fixed'"
            className="flex-1 min-w-0 px-3 py-2 bg-[#1A1A1A] border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] transition-colors"
          />
          <button
            type="button"
            onClick={generateBanner}
            disabled={generatingBanner}
            className="inline-flex items-center justify-center gap-2 text-xs font-medium px-3 py-2.5 rounded-md bg-[#1A1A1A] border border-gray-700 text-gray-300 hover:border-[#FFCC00] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            {generatingBanner ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-[#FFCC00]" />
            )}
            {generatingBanner ? "Generating banner…" : "Generate banner with AI"}
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Leave the box empty to generate from your brand profile, or describe exactly
          what you want. Your colors + logo are always applied.
        </p>
      </div>

      <div className="mt-6 border-t border-[#3F3F3F] pt-6">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#FFCC00] text-black rounded-lg font-medium hover:bg-[#E6B800] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? "Saving…" : "Save brand kit"}
        </button>
      </div>

      {/* On-demand brand templates (the style guide now lives in the form above). */}
      <div className="mt-10 border-t border-[#3F3F3F] pt-8">
        <BrandTemplatesPanel />
      </div>
    </div>
  );
};

const TextField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}> = ({ label, value, onChange, placeholder }) => (
  <div>
    <label className="block text-sm font-medium text-gray-300 mb-1.5">{label}</label>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={200}
      className="w-full px-3 py-2 bg-[#1A1A1A] border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] transition-colors"
    />
  </div>
);

const ColorField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
}> = ({ label, value, onChange }) => {
  const invalid = value !== "" && !HEX_RE.test(value);
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1.5">
        {label}
      </label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={HEX_RE.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="w-12 h-10 rounded border border-gray-700 bg-transparent cursor-pointer"
          aria-label={`${label} swatch`}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#FFCC00"
          maxLength={7}
          className="flex-1 min-w-0 px-3 py-2 bg-[#1A1A1A] border border-gray-700 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-[#FFCC00] transition-colors"
        />
        {invalid && (
          <span className="text-xs text-red-400 shrink-0">Use hex</span>
        )}
      </div>
    </div>
  );
};
