"use client";

// Branding Studio — the onboarding AI wizard. A full-screen, 6-step guided flow
// that builds a shop's Brand Kit + profile, matching the FixFlow "Branding Studio"
// mockups (docs/tasks/strategy/branding-studio + c:\dev\onboarding-ai):
//
//   1 Welcome  2 Upload Logo  3 AI Brand Analysis
//   4 Choose Marketing Style  5 Generating Brand Kit  6 Profile Ready
//
// It writes the SAME store as Settings → Brand Kit (PUT /api/ai/brand-kit) plus
// the richer profile fields (marketing_style, brand_voice, headline,
// brand_personality, industry_style — migration 144), and stamps
// onboarding_completed_at so it only auto-opens once. Reuses analyzeLogo for the
// detected palette and /upload/shop-logo for the logo bytes.
//
// Two entry points share it: the dashboard first-run (origin="onboarding") and
// the "Set up with AI" button in settings (origin="settings").

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Loader2, Sparkles, Flame, Check, ArrowLeft, ArrowRight, Plus,
  Palette, Smile, Wrench, MessageCircle,
  Briefcase, Cpu, Heart, Crown,
  Type, BookOpen,
} from "lucide-react";
import toast from "react-hot-toast";
import { getApiBaseUrl } from "@/utils/apiUrl";
import {
  getBrandKit, updateBrandKit, analyzeBrand, completeBrandOnboarding, fontPairForStyle,
  type BrandKit,
} from "@/services/api/aiBrandKit";
import { updateShopProfile } from "@/services/api/shop";
import { useAuthStore } from "@/stores/authStore";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const TOTAL_STEPS = 6;

// Marketing styles (step 4) → the voice + a starter headline shown on step 6.
const MARKETING_STYLES = [
  { key: "Professional & Corporate", icon: Briefcase, voice: "Polished and authoritative", headline: "Quality Service. Guaranteed Results." },
  { key: "Modern & Tech",            icon: Cpu,       voice: "Professional but Friendly",  headline: "Fast Repairs. Trusted Service." },
  { key: "Friendly & Local",         icon: Heart,     voice: "Warm and approachable",      headline: "Your Neighborhood Repair Experts." },
  { key: "Premium & Luxury",         icon: Crown,     voice: "Refined and exclusive",      headline: "Premium Care for Your Devices." },
] as const;

// Step 5 checklist — ONLY the things this step actually does (saves the brand
// profile). No poster/social "templates" here: those are generated on demand in
// the Brand Kit, so showing them mid-onboarding would be misleading.
const GEN_ITEMS = [
  { label: "Brand colors", icon: Palette },
  { label: "Typography pairing", icon: Type },
  { label: "Brand voice & tone", icon: MessageCircle },
  { label: "Brand profile saved", icon: BookOpen },
];

export interface BrandingStudioProps {
  open: boolean;
  origin?: "onboarding" | "settings";
  /** Shown on the Profile-Ready step. Falls back to "Your Shop". */
  shopName?: string;
  onComplete: (kit: BrandKit | null) => void;
  onClose?: () => void;
}

export const BrandingStudio: React.FC<BrandingStudioProps> = ({
  open,
  origin = "onboarding",
  shopName,
  onComplete,
  onClose,
}) => {
  const [step, setStep] = useState(0);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [logoUrl, setLogoUrl] = useState("");
  const [primary, setPrimary] = useState("");
  const [secondary, setSecondary] = useState("");
  const [tone, setTone] = useState("");
  const [personality, setPersonality] = useState("");
  const [industry, setIndustry] = useState("");
  const [marketingStyle, setMarketingStyle] = useState("");
  const [aiHeadline, setAiHeadline] = useState(""); // AI-suggested tagline
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzedFor, setAnalyzedFor] = useState("");
  const [genStep, setGenStep] = useState(0); // how many checklist items "done"
  const [saving, setSaving] = useState(false);
  const savedRef = useRef(false);

  const shopId = useAuthStore((s) => s.userProfile?.shopId);
  const selectedStyle = MARKETING_STYLES.find((s) => s.key === marketingStyle);
  const brandVoice = selectedStyle?.voice ?? "Professional but Friendly";
  // Prefer the AI-suggested headline; fall back to the chosen style's template.
  const headline = aiHeadline || selectedStyle?.headline || "Fast Repairs. Trusted Service.";

  // Prefill from any existing kit.
  useEffect(() => {
    if (!open) return;
    setLoadingInitial(true);
    savedRef.current = false;
    getBrandKit()
      .then((k) => {
        setLogoUrl(k.logoUrl || "");
        setPrimary(k.primaryColorHex || "");
        setSecondary(k.secondaryColorHex || "");
        setTone(k.toneNotes || "");
        setPersonality(k.brandPersonality || "");
        setIndustry(k.industryStyle || "");
        setMarketingStyle(k.marketingStyle || "");
        setAiHeadline(k.headline || "");
      })
      .catch(() => {/* no kit yet */})
      .finally(() => setLoadingInitial(false));
  }, [open]);

  const runAnalysis = useCallback(
    async (url: string, force = false) => {
      if (!url || (!force && url === analyzedFor)) return;
      setAnalyzing(true);
      try {
        const s = await analyzeBrand(url);
        setAnalyzedFor(url);
        if (s.primaryColorHex) setPrimary(s.primaryColorHex);
        if (s.secondaryColorHex) setSecondary(s.secondaryColorHex);
        // Real AI reads, with sensible fallbacks if a field comes back empty.
        setPersonality((p) => s.brandPersonality || p || "Professional • Friendly • Trustworthy");
        setIndustry((i) => s.industryStyle || i || "Repair & Service Business");
        setTone((t) => s.recommendedTone || t || "Helpful • Expert • Community-Focused");
        if (s.headline) setAiHeadline(s.headline);
        // Pre-select the suggested marketing style (the shop can change it on step 4).
        if (s.marketingStyle) setMarketingStyle((m) => m || s.marketingStyle!);
      } catch (e: any) {
        // Surface the real reason (e.g. budget exhausted) but don't block — fall
        // back to sensible defaults so the shop can still finish onboarding.
        toast.error(e?.message || "Couldn't analyze your brand — using sensible defaults.");
        setPersonality((p) => p || "Professional • Friendly • Trustworthy");
        setIndustry((i) => i || "Repair & Service Business");
        setTone((t) => t || "Helpful • Expert • Community-Focused");
      } finally {
        setAnalyzing(false);
      }
    },
    [analyzedFor]
  );

  // Auto-analyze when reaching the Analysis step with a fresh logo.
  useEffect(() => {
    if (step === 2 && logoUrl && logoUrl !== analyzedFor && !analyzing) {
      void runAnalysis(logoUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, logoUrl]);

  // Persist everything (once) and run the generating animation on step 5.
  useEffect(() => {
    if (step !== 4) return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Fire the save once.
    if (!savedRef.current) {
      savedRef.current = true;
      const pair = fontPairForStyle(marketingStyle || null);
      // The uploaded logo IS the shop logo — persist it to shops.logo_url so it's
      // the same image everywhere (not a brand-kit override).
      if (shopId && logoUrl) {
        void updateShopProfile(shopId, { logoUrl }).catch(() => {});
      }
      void updateBrandKit({
        logoUrl: null, // no AI override — effective logo = the shop logo
        primaryColorHex: HEX_RE.test(primary) ? primary : null,
        secondaryColorHex: HEX_RE.test(secondary) ? secondary : null,
        toneNotes: tone.trim() || null,
        marketingStyle: marketingStyle || null,
        brandVoice,
        headline,
        brandPersonality: personality || null,
        industryStyle: industry || null,
        headingFont: pair.heading,
        bodyFont: pair.body,
      }).catch(() => {
        if (!cancelled) toast.error("Couldn't save your brand profile — you can retry in Settings.");
      });
    }

    // Reveal checklist items one at a time.
    setGenStep(0);
    GEN_ITEMS.forEach((_, i) => {
      timers.push(setTimeout(() => { if (!cancelled) setGenStep(i + 1); }, 500 + i * 550));
    });
    return () => { cancelled = true; timers.forEach(clearTimeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  if (!open) return null;

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));
  const genDone = genStep >= GEN_ITEMS.length;

  const skipOrClose = async () => {
    if (origin === "settings" && onClose) { onClose(); return; }
    try { onComplete(await completeBrandOnboarding()); }
    catch { onComplete(null); }
  };

  const finish = async () => {
    setSaving(true);
    try {
      const kit = await completeBrandOnboarding();
      toast.success("Your brand profile is ready! The AI will use it on every campaign.");
      onComplete(kit);
    } catch (e: any) {
      toast.error(e?.message || "Couldn't finish. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const stepPill = step === TOTAL_STEPS - 1 ? "Complete" : `Step ${step + 1}`;

  return (
    <div className="fixed inset-0 z-[80] bg-[#0d0d0d] overflow-y-auto">
      {/* Top nav — FixFlow brand mark */}
      <header className="flex items-center justify-between h-16 px-6 sm:px-10 border-b border-white/5">
        <BrandMark />
        {origin === "settings" && (
          <button
            onClick={onClose}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Close
          </button>
        )}
      </header>

      {/* Card */}
      <div className="flex justify-center px-4 sm:px-6 py-8 sm:py-12">
        <div className="relative w-full max-w-[1180px] rounded-2xl border border-white/10 bg-gradient-to-b from-[#171717] to-[#0e0e0e] overflow-hidden shadow-2xl">
          <ParticleField />

          {/* Card header */}
          <div className="relative z-10 flex items-center justify-between px-6 sm:px-9 py-4 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#FFCC00]" />
              <span className="text-sm font-semibold text-gray-200 tracking-wide">
                FixFlow Branding Studio
              </span>
            </div>
            <span className="text-xs font-medium text-gray-300 px-3 py-1 rounded-md bg-white/5 border border-white/10">
              {stepPill}
            </span>
          </div>

          {/* Body */}
          <div className="relative z-10 px-6 sm:px-9 py-9 min-h-[340px]">
            {loadingInitial ? (
              <div className="flex items-center gap-2 text-gray-400 text-sm py-24 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading your brand…
              </div>
            ) : (
              <>
                {step === 0 && <StepWelcome origin={origin} />}
                {step === 1 && (
                  <StepLogo
                    logoUrl={logoUrl}
                    onUploaded={(url) => { setLogoUrl(url); setAnalyzedFor(""); }}
                  />
                )}
                {step === 2 && (
                  <StepAnalysis
                    analyzing={analyzing}
                    primary={primary}
                    secondary={secondary}
                    personality={personality}
                    industry={industry}
                    tone={tone}
                    onPrimary={setPrimary}
                    onSecondary={setSecondary}
                    onPersonality={setPersonality}
                    onIndustry={setIndustry}
                    onTone={setTone}
                  />
                )}
                {step === 3 && (
                  <StepStyle selected={marketingStyle} onSelect={setMarketingStyle} />
                )}
                {step === 4 && <StepGenerating genStep={genStep} />}
                {step === 5 && (
                  <StepReady
                    shopName={shopName || "Your Shop"}
                    primary={primary}
                    style={marketingStyle || "Modern & Tech"}
                    voice={brandVoice}
                    headline={headline}
                  />
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="relative z-10 flex items-center justify-end gap-5 px-6 sm:px-9 pb-7 pt-2">
            {step === 0 ? (
              <button onClick={skipOrClose} className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
                {origin === "settings" ? "Close" : "Skip"}
              </button>
            ) : step <= 4 ? (
              <button onClick={back} className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
                Previous
              </button>
            ) : null}

            {step < 4 && (
              <YellowButton onClick={next} disabled={step === 3 && !marketingStyle}>
                {step === 0 ? "Next" : "Next"} <ArrowRight className="w-4 h-4" />
              </YellowButton>
            )}
            {step === 4 && (
              <YellowButton onClick={next} disabled={!genDone}>
                {genDone ? <>Next <ArrowRight className="w-4 h-4" /></> : <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>}
              </YellowButton>
            )}
            {step === 5 && (
              <YellowButton onClick={finish} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Go to Dashboard
              </YellowButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------- Steps -------------------------------- */

const StepWelcome: React.FC<{ origin: "onboarding" | "settings" }> = ({ origin }) => (
  <div className="py-6">
    <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
      {origin === "settings" ? "Refresh Your Brand Identity" : "Welcome to Your AI-Powered Shop"}
    </h1>
    <p className="text-base text-gray-400 max-w-2xl leading-relaxed">
      Let&apos;s customize your assistant so it can create marketing campaigns that
      match your brand.
    </p>
  </div>
);

const StepLogo: React.FC<{ logoUrl: string; onUploaded: (url: string) => void }> = ({
  logoUrl,
  onUploaded,
}) => {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image (PNG, JPG, or SVG).");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch(`${getApiBaseUrl()}/upload/shop-logo`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || json.message || "Upload failed");
      onUploaded(json.url);
      toast.success("Logo uploaded.");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't upload the logo.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="py-2">
      <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Upload Your Shop Logo</h1>
      <p className="text-base text-gray-400 mb-7 leading-relaxed">
        Our AI will analyze your branding and create a visual identity for future campaigns.
      </p>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void upload(f);
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed transition-colors flex items-center justify-center text-center px-6 py-16 ${
          dragOver ? "border-green-400 bg-[#eef6ef]" : "border-gray-300 bg-[#f6f8fa] hover:border-green-400"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-3 text-gray-600">
            <Loader2 className="w-7 h-7 animate-spin text-green-600" />
            <span className="text-sm">Uploading…</span>
          </div>
        ) : logoUrl ? (
          <div className="flex flex-col items-center gap-3">
            <img src={logoUrl} alt="Your logo" className="max-h-24 max-w-[220px] object-contain" />
            <span className="text-sm text-green-700 font-medium">Logo uploaded — click to replace</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-green-600">
              <Plus className="w-5 h-5 text-white" />
            </span>
            <span className="text-base text-green-700 font-medium">Upload, Drag &amp; Drop Logo Here</span>
            <span className="text-xs text-gray-500 tracking-wide">PNG, JPG, SVG</span>
          </div>
        )}
      </div>
    </div>
  );
};

const StepAnalysis: React.FC<{
  analyzing: boolean;
  primary: string;
  secondary: string;
  personality: string;
  industry: string;
  tone: string;
  onPrimary: (v: string) => void;
  onSecondary: (v: string) => void;
  onPersonality: (v: string) => void;
  onIndustry: (v: string) => void;
  onTone: (v: string) => void;
}> = ({
  analyzing, primary, secondary, personality, industry, tone,
  onPrimary, onSecondary, onPersonality, onIndustry, onTone,
}) => (
  <div className="py-2">
    <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">AI Brand Analysis</h1>
    <p className="text-base text-gray-400 mb-7 leading-relaxed">
      We&apos;ve analyzed your logo and identified these branding elements —{" "}
      <span className="text-gray-300">tweak anything below</span> before continuing.
    </p>

    {analyzing ? (
      <div className="flex items-center gap-2 text-sm text-[#FFCC00] py-16 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Reading your logo…
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InsightCard icon={Smile} title="Brand Personality">
          <CardInput
            value={personality}
            onChange={onPersonality}
            placeholder="Professional • Friendly • Trustworthy"
          />
        </InsightCard>
        <InsightCard icon={Palette} title="Detected Colors">
          <div className="flex items-center gap-4">
            <ColorEdit hex={primary} onChange={onPrimary} />
            <ColorEdit hex={secondary} onChange={onSecondary} />
          </div>
        </InsightCard>
        <InsightCard icon={Wrench} title="Industry Style">
          <CardInput
            value={industry}
            onChange={onIndustry}
            placeholder="Repair & Service Business"
          />
        </InsightCard>
        <InsightCard icon={MessageCircle} title="Recommended Tone">
          <CardInput
            value={tone}
            onChange={onTone}
            placeholder="Helpful • Expert • Community-Focused"
          />
        </InsightCard>
      </div>
    )}
  </div>
);

// Subtle in-card text input — looks like the read-out, edits on focus.
const CardInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}> = ({ value, onChange, placeholder }) => (
  <input
    type="text"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    maxLength={200}
    className="w-full bg-transparent text-sm text-gray-200 placeholder-gray-500 border-0 border-b border-white/10 focus:border-[#FFCC00] focus:outline-none pb-1 transition-colors"
  />
);

// Color picker swatch + editable hex, sized to sit inside the insight card.
const ColorEdit: React.FC<{ hex: string; onChange: (v: string) => void }> = ({ hex, onChange }) => (
  <div className="flex items-center gap-1.5">
    <input
      type="color"
      value={HEX_RE.test(hex) ? hex : "#000000"}
      onChange={(e) => onChange(e.target.value.toUpperCase())}
      className="w-7 h-7 rounded border border-white/15 bg-transparent cursor-pointer p-0"
      aria-label="Color"
    />
    <input
      type="text"
      value={hex}
      onChange={(e) => onChange(e.target.value)}
      placeholder="#FFFFFF"
      maxLength={7}
      className="w-20 bg-transparent text-xs font-mono text-gray-300 placeholder-gray-500 border-b border-white/10 focus:border-[#FFCC00] focus:outline-none pb-0.5 transition-colors"
    />
  </div>
);

const StepStyle: React.FC<{ selected: string; onSelect: (k: string) => void }> = ({
  selected,
  onSelect,
}) => (
  <div className="py-2">
    <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Choose Your Marketing Style</h1>
    <p className="text-base text-gray-400 mb-7 leading-relaxed">
      Every great brand has a distinct identity. Select the marketing style that
      reflects how you want customers to see your business.
    </p>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {MARKETING_STYLES.map(({ key, icon: Icon }) => {
        const active = selected === key;
        return (
          <button
            key={key}
            onClick={() => onSelect(key)}
            className={`flex items-center gap-3 text-left rounded-xl border px-5 py-4 transition-all ${
              active
                ? "border-[#FFCC00] bg-[#FFCC00]/10 ring-1 ring-[#FFCC00]/40"
                : "border-white/10 bg-[#1b1b1b] hover:border-white/25"
            }`}
          >
            <span className={`inline-flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${active ? "bg-[#FFCC00]/20" : "bg-white/5"}`}>
              <Icon className={`w-5 h-5 ${active ? "text-[#FFCC00]" : "text-gray-300"}`} />
            </span>
            <span className="text-base font-medium text-white">{key}</span>
            {active && <Check className="w-4 h-4 text-[#FFCC00] ml-auto" />}
          </button>
        );
      })}
    </div>
  </div>
);

const StepGenerating: React.FC<{ genStep: number }> = ({ genStep }) => (
  <div className="py-2">
    <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Saving Your Brand Kit…</h1>
    <p className="text-base text-gray-400 mb-7 leading-relaxed">
      Locking in your colors, typography, and brand voice. You can generate
      marketing templates anytime from your Brand Kit. This only takes a moment.
    </p>

    <div className="space-y-3 max-w-xl">
      {GEN_ITEMS.map(({ label, icon: Icon }, i) => {
        const done = i < genStep;
        const activeNow = i === genStep;
        return (
          <div
            key={label}
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-all ${
              done ? "border-green-500/30 bg-green-500/5" : "border-white/8 bg-[#1a1a1a]"
            }`}
          >
            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full shrink-0 ${done ? "bg-green-500/20" : "bg-white/5"}`}>
              {done ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : activeNow ? (
                <Loader2 className="w-4 h-4 text-[#FFCC00] animate-spin" />
              ) : (
                <Icon className="w-4 h-4 text-gray-500" />
              )}
            </span>
            <span className={`text-sm font-medium ${done ? "text-gray-200" : "text-gray-400"}`}>{label}</span>
          </div>
        );
      })}
    </div>
  </div>
);

const StepReady: React.FC<{
  shopName: string;
  primary: string;
  style: string;
  voice: string;
  headline: string;
}> = ({ shopName, primary, style, voice, headline }) => (
  <div className="py-2">
    <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">FixFlow Store Profile Ready</h1>
    <p className="text-base text-gray-400 mb-7 leading-relaxed max-w-2xl">
      Your brand identity is ready. FixFlow AI will use this profile to create
      consistent, professional marketing campaigns for your business.
    </p>

    <div className="rounded-xl border border-white/10 bg-[#1a1a1a] px-6 py-5 max-w-2xl">
      <h2 className="text-lg font-semibold text-white mb-3">{shopName}</h2>
      <dl className="space-y-2.5">
        <ProfileRow label="Primary Color" value={
          <span className="inline-flex items-center gap-2">
            {HEX_RE.test(primary) && <span className="w-4 h-4 rounded border border-white/20" style={{ backgroundColor: primary }} />}
            <span className="font-mono">{primary || "—"}</span>
          </span>
        } />
        <ProfileRow label="Style" value={style} />
        <ProfileRow label="Voice" value={voice} />
        <ProfileRow label="Headline" value={headline} />
      </dl>
    </div>
  </div>
);

/* ------------------------------ Atoms --------------------------------- */

const BrandMark: React.FC = () => (
  <div className="flex items-center gap-2">
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#FFCC00]">
      <Flame className="w-5 h-5 text-black" fill="currentColor" />
    </span>
    <span className="text-xl font-extrabold tracking-tight text-white italic">FixFlow</span>
  </div>
);

// Subtle dot-wave field, concentrated on the right — approximates the mockup's
// particle background. (Swap for the official asset for true pixel-perfect.)
const ParticleField: React.FC = () => (
  <div
    aria-hidden
    className="pointer-events-none absolute inset-0 opacity-[0.5]"
    style={{
      backgroundImage:
        "radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1.4px)",
      backgroundSize: "15px 15px",
      WebkitMaskImage:
        "radial-gradient(120% 120% at 100% 40%, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.35) 35%, transparent 62%)",
      maskImage:
        "radial-gradient(120% 120% at 100% 40%, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.35) 35%, transparent 62%)",
    }}
  />
);

const YellowButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({
  children, className = "", ...rest
}) => (
  <button
    {...rest}
    className={`inline-flex items-center gap-2 px-7 py-2.5 rounded-md bg-[#FFCC00] text-black text-sm font-semibold hover:bg-[#E6B800] transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
  >
    {children}
  </button>
);

const InsightCard: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}> = ({ icon: Icon, title, children }) => (
  <div className="rounded-xl border border-white/10 bg-[#1b1b1b] px-5 py-4">
    <div className="flex items-center gap-2 mb-2">
      <Icon className="w-4 h-4 text-[#FFCC00]" />
      <span className="text-sm font-semibold text-white">{title}</span>
    </div>
    {children}
  </div>
);

const ProfileRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-baseline gap-3">
    <dt className="text-sm font-medium text-[#FFCC00] w-28 shrink-0">{label}</dt>
    <dd className="text-sm text-gray-200">{value}</dd>
  </div>
);

export default BrandingStudio;
