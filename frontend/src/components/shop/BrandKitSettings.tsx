"use client";

import React, { useEffect, useState } from "react";
import { Palette, Loader2, Save, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import { getBrandKit, updateBrandKit, analyzeLogo } from "@/services/api/aiBrandKit";
import { ImageUploader } from "./ImageUploader";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const isValidHex = (v: string) => v === "" || HEX_RE.test(v);

/**
 * Brand Kit settings (AI Image Generation Phase 3). The shop sets its colors,
 * tone, and logo; the AI applies them to every generated image so marketing
 * looks on-brand. Reads/writes /api/ai/brand-kit (shop-scoped via JWT).
 */
export const BrandKitSettings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [primary, setPrimary] = useState("");
  const [secondary, setSecondary] = useState("");
  const [tone, setTone] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    getBrandKit()
      .then((k) => {
        setPrimary(k.primaryColorHex || "");
        setSecondary(k.secondaryColorHex || "");
        setTone(k.toneNotes || "");
        setLogoUrl(k.logoUrl || "");
      })
      .catch(() => {
        /* no kit yet — start blank */
      })
      .finally(() => setLoading(false));
  }, []);

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
      await updateBrandKit({
        logoUrl: logoUrl || null,
        primaryColorHex: primary || null,
        secondaryColorHex: secondary || null,
        toneNotes: tone.trim() || null,
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
      toast.error("Upload a logo first.");
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

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400 text-sm py-8">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading brand kit…
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-[#FFCC00] mb-2 flex items-center gap-2">
        <Palette className="w-5 h-5" /> Brand Kit
      </h2>
      <p className="text-sm text-gray-400 mb-6">
        Your colors, tone, and logo. The AI applies these to every image it
        generates so your marketing and ads look on-brand.
      </p>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-8 border-t border-[#3F3F3F] pt-6">
        {/* Colors + tone */}
        <div className="space-y-5 order-2 xl:order-1">
          <ColorField label="Primary color" value={primary} onChange={setPrimary} />
          <ColorField label="Secondary color" value={secondary} onChange={setSecondary} />

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Brand tone / voice
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
        </div>

        {/* Logo */}
        <div className="order-1 xl:order-2">
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Logo
          </label>
          <ImageUploader
            imageType="logo"
            currentImageUrl={logoUrl || undefined}
            onUploadSuccess={(url) => {
              setLogoUrl(url);
              toast.success("Logo uploaded — remember to save.");
            }}
            onRemove={() => setLogoUrl("")}
            showPreview
          />
          <p className="mt-2 text-xs text-gray-500">
            Use a{" "}
            <span className="text-gray-300">transparent-background PNG</span> — it's
            stamped onto generated images (bottom-right corner).
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
    </div>
  );
};

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
          className="w-32 px-3 py-2 bg-[#1A1A1A] border border-gray-700 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-[#FFCC00] transition-colors"
        />
        {invalid && (
          <span className="text-xs text-red-400">Use a hex like #FFCC00</span>
        )}
      </div>
    </div>
  );
};
