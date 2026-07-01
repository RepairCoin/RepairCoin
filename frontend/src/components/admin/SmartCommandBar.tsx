"use client";

// Smart Admin Command Bar (⌘K / Ctrl+K).
// A command palette for the admin dashboard: instant fuzzy navigation across
// every admin section, plus an "Ask AI" fallback that routes the typed query to
// the Platform Copilot and shows the answer inline.

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Sparkles,
  Loader2,
  CornerDownLeft,
  LayoutDashboard,
  Users,
  Store,
  Wallet,
  ShieldAlert,
  ShieldCheck,
  BarChart3,
  CreditCard,
  Ticket,
  UserCog,
  UserPlus,
  Monitor,
  LifeBuoy,
  ListChecks,
  Scale,
  Megaphone,
  Bug,
  Bot,
  Settings,
} from "lucide-react";
import { runCommandBar } from "@/services/api/platformCopilot";

interface Destination {
  id: string;
  label: string;
  description: string;
  keywords: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const DESTINATIONS: Destination[] = [
  { id: "overview", label: "Overview", description: "Platform dashboard & stats", keywords: "home dashboard stats summary", href: "/admin?tab=overview", icon: LayoutDashboard },
  { id: "customers", label: "Customers", description: "Manage customers & tiers", keywords: "users members tier bronze silver gold", href: "/admin?tab=customers&view=grouped", icon: Users },
  { id: "shops", label: "Shops", description: "All shops", keywords: "stores merchants partners", href: "/admin?tab=shops-management&view=all", icon: Store },
  { id: "shops-pending", label: "Pending Shops", description: "Shops awaiting approval", keywords: "approve approval new application review", href: "/admin?tab=shops-management&view=pending", icon: Store },
  { id: "treasury", label: "Treasury", description: "Token treasury & minting", keywords: "tokens rcn rcg mint supply funds", href: "/admin?tab=treasury", icon: Wallet },
  { id: "fraud", label: "Fraud Detection", description: "AI fraud scanning & findings", keywords: "fraud suspicious abuse risk scan security", href: "/admin?tab=fraud", icon: ShieldAlert },
  { id: "content-moderation", label: "Content Moderation", description: "Scan & moderate listings", keywords: "moderation content review flag inappropriate", href: "/admin?tab=content-moderation", icon: ShieldCheck },
  { id: "analytics", label: "Analytics", description: "Platform analytics & trends", keywords: "reports charts metrics revenue insights", href: "/admin?tab=analytics", icon: BarChart3 },
  { id: "subscriptions", label: "Subscriptions", description: "Shop subscriptions & billing", keywords: "billing stripe payment plan recurring", href: "/admin?tab=subscriptions", icon: CreditCard },
  { id: "promo-codes", label: "Promo Codes", description: "Promo code analytics", keywords: "discount coupon promo referral", href: "/admin?tab=promo-codes", icon: Ticket },
  { id: "admins", label: "Admins", description: "Manage admin accounts", keywords: "administrators team roles permissions", href: "/admin?tab=admins", icon: UserCog },
  { id: "create-admin", label: "Create Admin", description: "Add a new admin", keywords: "new admin add invite", href: "/admin?tab=create-admin", icon: UserPlus },
  { id: "sessions", label: "Sessions", description: "Active login sessions", keywords: "sessions devices login tokens refresh", href: "/admin?tab=sessions", icon: Monitor },
  { id: "support", label: "Support Tickets", description: "Support inbox & AI triage", keywords: "tickets help support triage messages", href: "/admin?tab=support", icon: LifeBuoy },
  { id: "waitlist", label: "Waitlist", description: "Waitlist signups", keywords: "waitlist queue signups early access", href: "/admin?tab=waitlist", icon: ListChecks },
  { id: "disputes", label: "Disputes", description: "Customer/shop disputes", keywords: "disputes complaints conflict resolution", href: "/admin?tab=disputes", icon: Scale },
  { id: "ads", label: "Ads", description: "Ad campaigns", keywords: "ads advertising campaigns promotions", href: "/admin?tab=ads", icon: Megaphone },
  { id: "bug-reports", label: "Bug Reports", description: "User-reported bugs + AI inspect", keywords: "bugs issues errors crash report inspect", href: "/admin?tab=bug-reports", icon: Bug },
  { id: "ai-agent", label: "AI Agent", description: "AI agent shop controls", keywords: "ai agent assistant automation", href: "/admin?tab=ai-agent", icon: Bot },
  { id: "copilot", label: "Platform Copilot", description: "Ask the platform AI", keywords: "copilot ai ask chat assistant briefing", href: "/admin?tab=copilot", icon: Sparkles },
  { id: "settings", label: "Settings", description: "Platform settings", keywords: "settings config preferences", href: "/admin?tab=settings", icon: Settings },
];

const DEST_BY_ID = new Map(DESTINATIONS.map((d) => [d.id, d]));

function filterDestinations(query: string): Destination[] {
  const q = query.trim().toLowerCase();
  if (!q) return DESTINATIONS;
  const terms = q.split(/\s+/);
  return DESTINATIONS.map((d) => {
    const haystack = `${d.label} ${d.description} ${d.keywords}`.toLowerCase();
    let score = 0;
    for (const t of terms) {
      if (d.label.toLowerCase().startsWith(t)) score += 3;
      else if (d.label.toLowerCase().includes(t)) score += 2;
      else if (haystack.includes(t)) score += 1;
      else return null;
    }
    return { d, score };
  })
    .filter((x): x is { d: Destination; score: number } => x !== null)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.d);
}

export function SmartCommandBar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);

  // AI answer state
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Platform-aware shortcut label (⌘K on macOS, Ctrl K on Windows/Linux).
  // Resolved after mount to avoid SSR/hydration mismatch.
  const [shortcut, setShortcut] = useState<string | null>(null);
  useEffect(() => {
    const ua = navigator.userAgent + " " + (navigator.platform || "");
    setShortcut(/mac|iphone|ipad|ipod/i.test(ua) ? "⌘K" : "Ctrl K");
  }, []);

  const results = useMemo(() => filterDestinations(query), [query]);
  // "Ask AI" is always an option (index === results.length)
  const totalItems = results.length + 1;
  const askAiIndex = results.length;

  const reset = useCallback(() => {
    setQuery("");
    setSelected(0);
    setAiAnswer(null);
    setAiSuggestions([]);
    setAiError("");
    setAiLoading(false);
  }, []);

  // Global ⌘K / Ctrl+K toggle
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Focus input + reset on open/close
  useEffect(() => {
    if (open) {
      reset();
      // focus after paint
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open, reset]);

  // Keep selection in range as results change
  useEffect(() => {
    setSelected((s) => Math.min(s, totalItems - 1));
  }, [totalItems]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  const askAi = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setAiLoading(true);
    setAiError("");
    setAiAnswer(null);
    setAiSuggestions([]);
    try {
      const res = await runCommandBar(q);
      // Smart routing: if the AI understood a navigation intent, jump there.
      if (res.type === "navigate" && res.navigateTo && DEST_BY_ID.has(res.navigateTo)) {
        setOpen(false);
        router.push(DEST_BY_ID.get(res.navigateTo)!.href);
        return;
      }
      setAiAnswer(res.answer || "No answer returned.");
      setAiSuggestions((res.suggestions || []).filter((id) => DEST_BY_ID.has(id)));
    } catch (err) {
      console.error("Command bar AI query failed:", err);
      setAiError("Could not reach the AI. Try again, or open Platform Copilot.");
    } finally {
      setAiLoading(false);
    }
  }, [query, router]);

  const activate = useCallback(
    (index: number) => {
      if (index === askAiIndex) {
        askAi();
      } else if (results[index]) {
        go(results[index].href);
      }
    },
    [askAiIndex, askAi, results, go]
  );

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => (s + 1) % totalItems);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => (s - 1 + totalItems) % totalItems);
    } else if (e.key === "Enter") {
      e.preventDefault();
      activate(selected);
    }
  };

  // Closed: show a discoverable floating trigger (keyboard ⌘K still works).
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title={`Smart Command Bar (${shortcut ?? "Ctrl K"})`}
        className="fixed bottom-6 right-6 z-[90] flex items-center gap-2 px-4 py-3 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-900/30 hover:from-violet-500 hover:to-purple-500 transition-colors"
      >
        <Sparkles className="w-4 h-4" />
        <span className="text-sm font-medium hidden sm:inline">Command</span>
        {shortcut && (
          <kbd className="text-[10px] bg-white/20 rounded px-1.5 py-0.5 hidden sm:inline">{shortcut}</kbd>
        )}
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4 bg-black/60 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl bg-[#1a1a1a] rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/10">
          <Search className="w-5 h-5 text-gray-500 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(0);
              setAiAnswer(null);
              setAiError("");
            }}
            onKeyDown={onInputKeyDown}
            placeholder="Search admin, or ask a question…"
            className="flex-1 bg-transparent text-white text-base placeholder-gray-500 focus:outline-none"
          />
          <kbd className="text-[10px] text-gray-500 border border-white/10 rounded px-1.5 py-0.5">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[55vh] overflow-y-auto py-2">
          {results.map((d, i) => {
            const Icon = d.icon;
            const isSel = i === selected;
            return (
              <button
                key={d.id}
                onMouseEnter={() => setSelected(i)}
                onClick={() => activate(i)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  isSel ? "bg-[#FFCC00]/10" : "hover:bg-white/5"
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isSel ? "bg-[#FFCC00]/20" : "bg-white/5"}`}>
                  <Icon className={`w-4 h-4 ${isSel ? "text-[#FFCC00]" : "text-gray-400"}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-white text-sm font-medium truncate">{d.label}</p>
                  <p className="text-gray-500 text-xs truncate">{d.description}</p>
                </div>
                {isSel && <CornerDownLeft className="w-3.5 h-3.5 text-gray-500 shrink-0" />}
              </button>
            );
          })}

          {/* Ask AI row */}
          <button
            onMouseEnter={() => setSelected(askAiIndex)}
            onClick={() => activate(askAiIndex)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
              selected === askAiIndex ? "bg-violet-500/10" : "hover:bg-white/5"
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 flex items-center justify-center shrink-0">
              {aiLoading ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Sparkles className="w-4 h-4 text-white" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white text-sm font-medium truncate">
                {query.trim() ? `Ask AI: "${query.trim()}"` : "Ask the AI or say where to go"}
              </p>
              <p className="text-gray-500 text-xs truncate">
                Answers questions with live data, or jumps you to the right section
              </p>
            </div>
            {selected === askAiIndex && <CornerDownLeft className="w-3.5 h-3.5 text-gray-500 shrink-0" />}
          </button>

          {/* AI answer / error */}
          {(aiAnswer || aiError || aiLoading) && (
            <div className="mx-4 my-2 rounded-xl border border-violet-500/30 bg-violet-500/5 p-3">
              {aiLoading && (
                <p className="text-violet-300 text-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Thinking…
                </p>
              )}
              {aiError && <p className="text-red-400 text-sm">{aiError}</p>}
              {aiAnswer && (
                <p className="text-gray-200 text-sm whitespace-pre-wrap leading-relaxed">{aiAnswer}</p>
              )}
              {aiSuggestions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/5">
                  {aiSuggestions.map((id) => {
                    const d = DEST_BY_ID.get(id);
                    if (!d) return null;
                    const Icon = d.icon;
                    return (
                      <button
                        key={id}
                        onClick={() => go(d.href)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-200 text-xs hover:bg-white/10 transition-colors"
                      >
                        <Icon className="w-3.5 h-3.5 text-violet-400" />
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/10 text-[11px] text-gray-500">
          <span className="flex items-center gap-1.5">
            <kbd className="border border-white/10 rounded px-1">↑</kbd>
            <kbd className="border border-white/10 rounded px-1">↓</kbd>
            to navigate
            <kbd className="border border-white/10 rounded px-1 ml-2">↵</kbd>
            to select
          </span>
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-violet-400" /> Smart Command Bar
          </span>
        </div>
      </div>
    </div>
  );
}
