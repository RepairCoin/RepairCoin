"use client";

import React, { useState, useEffect } from "react";
import {
  DollarSign,
  CalendarDays,
  Users,
  Star,
  Sparkles,
  Mic,
  Megaphone,
  PackageOpen,
  CalendarClock,
  ArrowRight,
  Coins,
  ShoppingCart,
  Gem,
  Image as ImageIcon,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useBlockchainEnabled } from "@/contexts/AppConfigContext";
import { useUnifiedAssistantStore } from "@/stores/unifiedAssistantStore";
import { unlockAudioPlayback } from "@/lib/audioUnlock";
import { useVoiceEnabled } from "@/hooks/useVoiceEnabled";
import { appointmentsApi, CalendarBooking } from "@/services/api/appointments";
import { getShopServices } from "@/services/api/services";
import {
  getShopRecentActivity,
  getShopDashboardStats,
  ShopActivityEvent,
  ShopActivityKind,
  ShopDashboardStats,
} from "@/services/api/shop";

/**
 * Shop dashboard "Overview" redesign.
 *
 * Wallet figures use real `shopData`; the agenda and recent activity are wired to
 * live APIs. The stats and AI sections still use temporary MOCK data (marked below).
 */

// Rotating examples for the "Ask AI Anything" card (animated slideshow).
const ASK_AI_EXAMPLES = [
  "Create a campaign for slow days",
  "How did we do this month?",
  "Win back customers who've gone quiet",
  "What's running low in inventory?",
  "Show me revenue this week",
];

// WS2: on Starter the assistant is help + chat only, so show examples it can
// actually answer (the data/marketing ones above would just get declined).
const ASK_AI_HELP_EXAMPLES = [
  "How do I create a service?",
  "Where do I set my appointment hours?",
  "How do I issue a reward?",
  "How do I export my customer list?",
];

interface ShopData {
  shopId: string;
  name: string;
  purchasedRcnBalance?: number;
  totalRcnPurchased?: number;
  totalTokensIssued?: number;
  rcg_balance?: number;
}

interface DashboardOverviewProps {
  shopData: ShopData | null;
  onNavigate?: (tab: string) => void;
}

// ---------------------------------------------------------------------------
// Stat cards (real data — see buildStatCards)
// ---------------------------------------------------------------------------

interface StatCard {
  key: string;
  label: string;
  icon: typeof DollarSign;
  value: string;
  delta: string;
  deltaPositive: boolean;
  color: string;
  spark: number[];
}

const formatTrend = (trend: number) => {
  const rounded = Math.round(trend);
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}% vs yesterday`;
};

const buildStatCards = (stats: ShopDashboardStats): StatCard[] => {
  const rating = stats.reviews.avgRating;
  const fullStars = rating ? Math.round(rating) : 0;
  return [
    {
      key: "revenue",
      label: "Revenue",
      icon: DollarSign,
      value: `$ ${Math.round(stats.revenue.value).toLocaleString("en-US")}`,
      delta: formatTrend(stats.revenue.trend),
      deltaPositive: stats.revenue.trend >= 0,
      color: "#22c55e",
      spark: stats.revenue.spark,
    },
    {
      key: "bookings",
      label: "Bookings",
      icon: CalendarDays,
      value: `${stats.bookings.value}`,
      delta: formatTrend(stats.bookings.trend),
      deltaPositive: stats.bookings.trend >= 0,
      color: "#38bdf8",
      spark: stats.bookings.spark,
    },
    {
      key: "customers",
      label: "New Customers",
      icon: Users,
      value: `${stats.newCustomers.value}`,
      delta: formatTrend(stats.newCustomers.trend),
      deltaPositive: stats.newCustomers.trend >= 0,
      color: "#a855f7",
      spark: stats.newCustomers.spark,
    },
    {
      key: "reviews",
      label: "Reviews",
      icon: Star,
      value: rating ? rating.toFixed(1) : "—",
      delta: `${"★".repeat(fullStars)}${"☆".repeat(5 - fullStars)} (${stats.reviews.reviewCount})`,
      deltaPositive: true,
      color: "#FFCC00",
      spark: stats.reviews.spark,
    },
  ];
};

// ---------------------------------------------------------------------------
// MOCK DATA (temporary — replace with real API data)
// ---------------------------------------------------------------------------

const MOCK_AI_RECOMMENDATIONS = [
  {
    id: 1,
    icon: Megaphone,
    title: "Send a New Customer Campaign",
    desc: "AI detected an opportunity to re-engage 87 inactive customers.",
    category: "Marketing",
    color: "#38bdf8",
  },
  {
    id: 2,
    icon: PackageOpen,
    title: "Low on Stock Alert",
    desc: "8 items running low. Check and review purchase suggestions.",
    category: "RepairCoin",
    color: "#a855f7",
  },
  {
    id: 3,
    icon: CalendarClock,
    title: "Slow Day Tomorrow",
    desc: "Want AI to create a promotion to boost bookings?",
    category: "Revenue",
    color: "#f59e0b",
  },
];

const AI_FILTERS = ["All", "Revenue", "Customers", "Marketing", "RepairCoin"];

const MOCK_PRIORITY_ACTIONS = [
  {
    id: 1,
    icon: Users,
    title: "Follow Up Leads",
    desc: "8 inquiries waiting for response",
    cta: "Contact Leads",
  },
  {
    id: 2,
    icon: Megaphone,
    title: "Promote Tuesday",
    desc: "Expected +5 to 10 bookings.",
    cta: "Launch Campaign",
  },
  {
    id: 3,
    icon: Star,
    title: "Request Reviews",
    desc: "12 recent customers eligible.",
    cta: "Send Requests",
  },
];

// ---------------------------------------------------------------------------
// Recent Activity presentation mapping (data comes from the API)
// ---------------------------------------------------------------------------

const ACTIVITY_ICON: Record<ShopActivityKind, typeof Megaphone> = {
  campaign: Megaphone,
  booking: CalendarDays,
  purchase_order: PackageOpen,
  review: Star,
};

const ACTIVITY_TITLE: Record<ShopActivityKind, string> = {
  campaign: "Campaign Sent",
  booking: "Booking Confirmed",
  purchase_order: "Purchase Order",
  review: "New Review",
};

// Per-status badge label + color. Falls back to a neutral pill for unknowns.
const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  // bookings
  completed: { label: "Completed", className: "bg-green-500/15 text-green-400" },
  paid: { label: "Confirmed", className: "bg-blue-500/15 text-blue-400" },
  pending: { label: "Pending", className: "bg-yellow-500/15 text-yellow-400" },
  cancelled: { label: "Cancelled", className: "bg-red-500/15 text-red-400" },
  refunded: { label: "Refunded", className: "bg-gray-500/15 text-gray-400" },
  no_show: { label: "No Show", className: "bg-gray-500/15 text-gray-400" },
  // campaigns
  sent: { label: "Sent", className: "bg-green-500/15 text-green-400" },
  // purchase orders
  draft: { label: "Draft", className: "bg-gray-500/15 text-gray-400" },
  ordered: { label: "Ordered", className: "bg-blue-500/15 text-blue-400" },
  partial: { label: "Partial", className: "bg-yellow-500/15 text-yellow-400" },
  received: { label: "Received", className: "bg-green-500/15 text-green-400" },
};

const activityBadge = (status: string | null) => {
  if (!status) return null;
  return (
    STATUS_BADGE[status] ?? {
      label: status.replace(/_/g, " "),
      className: "bg-gray-500/15 text-gray-400",
    }
  );
};

const formatActivityTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const now = new Date();
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (sameDay(d, now)) return `Today, ${time}`;
  if (sameDay(d, yesterday)) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${time}`;
};

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

const card = "rounded-2xl border border-[#262626] bg-[#161616]";
// Darker variant used for nested panels inside the left container (Ask AI,
// AI Recommendations, Priority Actions) so they read as black on the panel.
const cardDark = "rounded-2xl border border-[#1f1f1f] bg-[#0a0a0a]";

const todayISO = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

const formatTime = (slot: string | null) => {
  if (!slot) return "";
  const [h, m] = slot.split(":");
  let hour = parseInt(h, 10);
  if (Number.isNaN(hour)) return slot;
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${(m ?? "00").slice(0, 2)} ${ampm}`;
};

function SparkLine({ data, color }: { data: number[]; color: string }) {
  const w = 100;
  const h = 34;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 6) - 3;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const last = points[points.length - 1].split(",");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-9" preserveAspectRatio="none">
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r="2.6" fill={color}>
        <animate attributeName="opacity" values="1;0.4;1" dur="1.6s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

function AgendaThumb({ src, alt }: { src?: string | null; alt: string }) {
  const [err, setErr] = useState(false);
  return (
    <span className="flex w-14 flex-shrink-0 self-stretch items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-gray-800 to-gray-900">
      {src && !err ? (
        <img
          src={src}
          alt={alt}
          onError={() => setErr(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <ImageIcon className="w-6 h-6 text-gray-600" />
      )}
    </span>
  );
}

function SectionHeading({ title, onViewAll }: { title: string; onViewAll?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-[#FFCC00]" />
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      {onViewAll && (
        <button
          onClick={onViewAll}
          className="text-xs text-[#FFCC00] hover:underline flex items-center gap-1"
        >
          View All <ArrowRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  shopData,
  onNavigate,
}) => {
  const userName = useAuthStore((s) => s.userProfile?.name);
  // RCG is on-chain; hide its balance in database-only mode (RCG is admin-set).
  const blockchainEnabled = useBlockchainEnabled();
  // Opens the single Unified Assistant panel + auto-starts its mic (same as the
  // floating VoiceCommandPill on the Profile tab).
  const openWithMic = useUnifiedAssistantStore((s) => s.openWithMic);
  const openAssistant = useUnifiedAssistantStore((s) => s.open);
  // WS2: voice is Growth+. On Starter this card becomes a ✨ "Ask AI Anything"
  // that opens the TEXT assistant — no mic, no "talk", help-oriented examples.
  const voiceEnabled = useVoiceEnabled();
  const askAiExamples = voiceEnabled ? ASK_AI_EXAMPLES : ASK_AI_HELP_EXAMPLES;
  const askAi = () => {
    if (voiceEnabled) {
      unlockAudioPlayback(); // unlock audio in the tap gesture so the spoken greeting can play
      openWithMic();
    } else {
      openAssistant(); // text-only assistant
    }
  };
  // Rotating example prompts (animated slideshow) so the owner sees the breadth
  // of what they can ask — mirrors the VoiceCommandPill.
  const [exampleIndex, setExampleIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(
      () => setExampleIndex((i) => (i + 1) % askAiExamples.length),
      3500
    );
    return () => clearInterval(id);
  }, [askAiExamples.length]);
  const [mascotError, setMascotError] = useState(false);
  const [aiFilter, setAiFilter] = useState("All");

  // Today's Agenda — real appointments for the shop today
  const [agenda, setAgenda] = useState<CalendarBooking[]>([]);
  // serviceId -> imageUrl (the shop calendar doesn't include the service image)
  const [serviceImages, setServiceImages] = useState<Record<string, string>>({});
  // Recent Activity — unified feed (campaigns, bookings, purchase orders, reviews)
  const [activity, setActivity] = useState<ShopActivityEvent[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  // Stat cards — real revenue / bookings / new customers / reviews
  const [stats, setStats] = useState<ShopDashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  useEffect(() => {
    if (!shopData?.shopId) return;
    let active = true;
    const today = todayISO();

    setActivityLoading(true);
    getShopRecentActivity(shopData.shopId, 6)
      .then((items) => {
        if (active) setActivity(items);
      })
      .catch(() => {
        if (active) setActivity([]);
      })
      .finally(() => {
        if (active) setActivityLoading(false);
      });

    setStatsLoading(true);
    getShopDashboardStats(shopData.shopId)
      .then((data) => {
        if (active) setStats(data);
      })
      .catch(() => {
        if (active) setStats(null);
      })
      .finally(() => {
        if (active) setStatsLoading(false);
      });

    appointmentsApi
      .getShopCalendar(today, today)
      .then((bookings) => {
        if (!active) return;
        const upcoming = (bookings || [])
          .filter((b) => b.status !== "cancelled")
          .sort((a, b) =>
            (a.bookingTimeSlot ?? "").localeCompare(b.bookingTimeSlot ?? "")
          );
        setAgenda(upcoming);
      })
      .catch(() => {
        if (active) setAgenda([]);
      });

    getShopServices(shopData.shopId, { limit: 100 })
      .then((res) => {
        if (!active || !res?.data) return;
        const map: Record<string, string> = {};
        for (const s of res.data) {
          if (s.imageUrl) map[s.serviceId] = s.imageUrl;
        }
        setServiceImages(map);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [shopData?.shopId]);
  const agendaVisible = agenda.slice(0, 3);
  const agendaMore = agenda.length - agendaVisible.length;

  const firstName = (userName || shopData?.name || "there").split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";

  const wallet = {
    operational: shopData?.purchasedRcnBalance ?? 0,
    totalPurchased: shopData?.totalRcnPurchased ?? 0,
    tokensIssued: shopData?.totalTokensIssued ?? 0,
    rcgBalance: shopData?.rcg_balance ?? 0,
  };
  const fmt = (n: number) => n.toLocaleString("en-US");

  const visibleRecs =
    aiFilter === "All"
      ? MOCK_AI_RECOMMENDATIONS
      : MOCK_AI_RECOMMENDATIONS.filter((r) => r.category === aiFilter);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5 max-w-[1080px] mx-auto">
      {/* ============================= LEFT COLUMN ============================= */}
      <div className={`${card} p-5`}>
        <div className="space-y-5">
        {/* Greeting */}
        <div className={`${card} relative overflow-hidden p-6`}>
          <div className="relative z-10 max-w-[78%]">
            <p className="text-base font-semibold text-white">
              {greeting}, {firstName}! <span className="ml-1">👋</span>
            </p>
            <h2 className="mt-1 text-2xl font-bold text-white">
              Your business is doing <span className="text-[#FFCC00]">great!</span>
            </h2>
            <p className="mt-2 text-sm text-gray-400">
              Here&apos;s what is happening with your business today!
            </p>
          </div>
          {!mascotError && (
            <img
              src="/img/ai-mascot.png"
              alt="AI assistant"
              onError={() => setMascotError(true)}
              className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 h-24 w-auto object-contain"
            />
          )}
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {statsLoading || !stats
            ? [0, 1, 2, 3].map((i) => (
                <div key={i} className={`${card} p-4 animate-pulse`}>
                  <div className="h-4 w-20 rounded bg-[#2a2a2a]" />
                  <div className="mt-3 h-6 w-16 rounded bg-[#2a2a2a]" />
                  <div className="mt-2 h-2.5 w-24 rounded bg-[#2a2a2a]" />
                  <div className="mt-3 h-9 w-full rounded bg-[#2a2a2a]" />
                </div>
              ))
            : buildStatCards(stats).map((s) => {
                const Icon = s.icon;
                const deltaColor =
                  s.key === "reviews"
                    ? "text-[#FFCC00]"
                    : s.deltaPositive
                    ? "text-green-400"
                    : "text-red-400";
                return (
                  <div
                    key={s.key}
                    className={`${card} p-4`}
                    style={{
                      backgroundImage: `linear-gradient(135deg, ${s.color}26 0%, ${s.color}0d 35%, transparent 70%)`,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4" style={{ color: s.color }} />
                      <div className="leading-tight">
                        <p className="text-xs font-medium text-white">{s.label}</p>
                        <p className="text-[10px] text-gray-500">
                          {s.key === "reviews" ? "All time" : "Today"}
                        </p>
                      </div>
                    </div>
                    <p className="mt-2 text-xl font-bold text-white">{s.value}</p>
                    <p className={`text-[10px] ${deltaColor}`}>{s.delta}</p>
                    <div className="mt-2">
                      <SparkLine data={s.spark} color={s.color} />
                    </div>
                  </div>
                );
              })}
        </div>

        {/* Ask AI Anything — opens the Unified Assistant + starts the mic */}
        <div className={`${cardDark} p-5`}>
          <SectionHeading title="Ask AI Anything" />
          <button onClick={askAi} className="w-full flex items-center gap-3 rounded-xl bg-gradient-to-br from-blue-600 to-purple-700 px-3 py-3 text-left transition-all hover:from-blue-500 hover:to-purple-600 shadow-[0_0_18px_rgba(147,51,234,0.45)]">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-black/30 ring-1 ring-white/20">
              {voiceEnabled ? (
                <Mic className="w-5 h-5 text-white" />
              ) : (
                <Sparkles className="w-5 h-5 text-white" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-white">Ask AI Anything</span>
              <span className="block text-xs text-purple-100/80 truncate h-4 overflow-hidden">
                Example:{" "}
                <span key={exampleIndex} className="animate-fadeIn inline-block align-bottom">
                  {askAiExamples[exampleIndex]}
                </span>
              </span>
            </span>
            <span className="text-[11px] font-bold tracking-wide text-purple-200/80">
              {voiceEnabled ? "TAP TO TALK" : "TAP TO ASK"}
            </span>
          </button>
        </div>

        {/* AI Recommendations (MOCK) */}
        <div className={`${cardDark} p-5`}>
          <SectionHeading title="AI Recommendations for You" onViewAll={() => {}} />
          <div className="mb-3 flex flex-wrap gap-2">
            {AI_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setAiFilter(f)}
                className={`rounded-full px-3 py-1 text-xs transition-colors ${
                  aiFilter === f
                    ? "bg-[#FFCC00] text-[#101010] font-medium"
                    : "bg-[#202020] text-gray-400 hover:text-white"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="space-y-2.5">
            {visibleRecs.map((r) => {
              const Icon = r.icon;
              return (
                <button
                  key={r.id}
                  className="group flex w-full items-center gap-3 rounded-xl border border-[#2e2e2e] bg-gradient-to-br from-[#2a2a2a] to-[#161616] px-3 py-3 text-left transition-all hover:from-[#323232] hover:to-[#1c1c1c]"
                >
                  <span
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${r.color}26` }}
                  >
                    <Icon className="w-4 h-4" style={{ color: r.color }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-white">{r.title}</span>
                    <span className="block text-xs text-gray-400">{r.desc}</span>
                  </span>
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green-500/15 transition-all group-hover:bg-green-500/25 group-hover:translate-x-0.5">
                    <ArrowRight className="w-4 h-4 text-green-400" />
                  </span>
                </button>
              );
            })}
            {visibleRecs.length === 0 && (
              <p className="px-2 py-3 text-xs text-gray-500">No recommendations in this category.</p>
            )}
          </div>
        </div>

        {/* Priority Actions (MOCK) */}
        <div className={`${cardDark} p-5`}>
          <SectionHeading title="Priority Actions" onViewAll={() => {}} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {MOCK_PRIORITY_ACTIONS.map((a) => {
              const Icon = a.icon;
              return (
                <div
                  key={a.id}
                  className="flex flex-col rounded-xl border border-[#2e2e2e] bg-gradient-to-br from-[#2a2a2a] to-[#161616] p-4"
                >
                  <Icon className="w-4 h-4 text-green-400" />
                  <p className="mt-2 text-sm font-semibold text-white">{a.title}</p>
                  <p className="mt-1 flex-1 text-xs text-gray-400">{a.desc}</p>
                  <button className="mt-3 rounded-lg bg-green-600 py-2 text-xs font-semibold text-white transition-colors hover:bg-green-500">
                    {a.cta}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
        </div>
      </div>

      {/* ============================= RIGHT COLUMN ============================= */}
      <div className="space-y-5">
        {/* Wallet (REAL data) */}
        <div className={`${card} p-4 space-y-5`}>
          <h3 className="text-sm font-semibold text-white">My FixFlow Wallet</h3>
          <div
            className="relative flex h-20 flex-col justify-center overflow-hidden rounded-xl bg-cover bg-center px-4"
            style={{ backgroundImage: "url('/img/rcn-balance.png')" }}
          >
            <div className="relative z-10">
              <p className="text-xs font-semibold text-[#4a3200]">Operational RCN</p>
              <p className="text-3xl font-extrabold text-[#211500]">{fmt(wallet.operational)}</p>
            </div>
          </div>

          <div className="mt-3 space-y-2.5">
            {[
              { label: "Total Purchased", value: fmt(wallet.totalPurchased), icon: ShoppingCart },
              { label: "Tokens Issued", value: fmt(wallet.tokensIssued), icon: Coins },
              ...(blockchainEnabled
                ? [{ label: "RCG Balance", value: fmt(wallet.rcgBalance), icon: Gem }]
                : []),
            ].map((row) => {
              const Icon = row.icon;
              return (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-gray-400">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FFCC00]/15">
                      <Icon className="w-4 h-4 text-[#FFCC00]" />
                    </span>
                    {row.label}
                  </span>
                  <span className="text-lg font-bold text-white">{row.value}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Today's Agenda (real appointments for today) */}
        <div className={`${card} p-5`}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Today&apos;s Agenda</h3>
            <button
              onClick={() => onNavigate?.("appointments")}
              className="text-xs text-[#FFCC00] hover:underline"
            >
              View All
            </button>
          </div>
          {agendaVisible.length === 0 ? (
            <p className="rounded-xl bg-[#1d1d1d] px-3 py-4 text-center text-xs text-gray-500">
              No appointments today
            </p>
          ) : (
            <div className="space-y-2">
              {agendaVisible.map((a) => (
                <div
                  key={a.orderId}
                  className="flex items-stretch gap-3 rounded-xl bg-[#1d1d1d] p-2.5"
                >
                  <AgendaThumb
                    src={serviceImages[a.serviceId] || a.serviceImage}
                    alt={a.serviceName}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-gray-500">
                      {formatTime(a.bookingTimeSlot)}
                    </p>
                    <p className="truncate text-sm font-semibold text-white">
                      {a.serviceName}
                    </p>
                    <p className="truncate text-xs text-gray-400">
                      {a.customerName || "Customer"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {agendaMore > 0 && (
            <button
              onClick={() => onNavigate?.("appointments")}
              className="mt-3 flex w-full items-center justify-between rounded-xl bg-[#1d1d1d] px-3 py-2.5 text-xs text-gray-400 hover:text-white"
            >
              +{agendaMore} more appointment{agendaMore > 1 ? "s" : ""}{" "}
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Recent Activity (real data) */}
        <div className={`${card} p-5`}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Recent Activity</h3>
          </div>
          {activityLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="flex animate-pulse items-center gap-3 rounded-xl bg-[#1d1d1d] p-3"
                >
                  <span className="h-9 w-9 flex-shrink-0 rounded-lg bg-[#2a2a2a]" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-1/2 rounded bg-[#2a2a2a]" />
                    <div className="h-2.5 w-3/4 rounded bg-[#2a2a2a]" />
                  </div>
                </div>
              ))}
            </div>
          ) : activity.length === 0 ? (
            <p className="rounded-xl bg-[#1d1d1d] px-3 py-4 text-center text-xs text-gray-500">
              No recent activity yet
            </p>
          ) : (
            <div className="space-y-2">
              {activity.map((a) => {
                const Icon = ACTIVITY_ICON[a.kind];
                const badge = activityBadge(a.status);
                return (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 rounded-xl bg-[#1d1d1d] p-3"
                  >
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#2a2a2a]">
                      <Icon className="w-4 h-4 text-[#FFCC00]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white">
                        {ACTIVITY_TITLE[a.kind]}
                      </p>
                      <p className="truncate text-xs text-gray-400">
                        {a.kind === "review" && a.rating
                          ? `${"★".repeat(a.rating)}${"☆".repeat(5 - a.rating)} ${a.subtitle}`.trim()
                          : a.subtitle}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 flex-col items-end gap-1">
                      {badge && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.className}`}>
                          {badge.label}
                        </span>
                      )}
                      <span className="text-[10px] text-gray-500">
                        {formatActivityTime(a.timestamp)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
