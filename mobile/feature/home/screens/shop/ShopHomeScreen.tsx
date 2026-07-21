import React, { useCallback, useMemo, useState } from "react";
import {
  Image,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { ThemedView } from "@/shared/components/ui/ThemedView";
import { DemoBanner } from "@/shared/components/ui/DemoBanner";
import { useHomeDataUI } from "@/feature/shop/account/hooks";
import { useEndBootWhenReady } from "@/shared/hooks/useEndBootWhenReady";
import { useBookingsData } from "@/feature/services/booking/hooks/useBookingsData";
import { useShopReviewsQuery } from "@/feature/services/services-main/services-tab/hooks/useServicesTabQuery";
import { MessageButton, NotificationBell } from "../../components";
import {
  SectionHeader,
  StatCard,
  AgendaCard,
  ActivityCard,
  PriorityCard,
  QuickAction,
  EmptyRow,
} from "../../components/shop/dashboard/DashboardSections";
import { ShopSidebar } from "../../components/shop/dashboard/ShopSidebar";

function isToday(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/* "14:30", "14:30:00", or ISO "2026-07-16T16:07:00" -> "2:30 PM". */
function formatTime12h(time?: string | null): string {
  if (!time) return "";
  // For ISO datetimes, format the time portion only.
  const timePart = time.includes("T") ? time.split("T")[1] : time;
  const match = timePart?.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "";
  let hour = parseInt(match[1], 10);
  const mins = match[2];
  const period = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${mins} ${period}`;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/* Bucket items into a per-day series for the last 7 days (oldest -> today). */
function buildDailySeries<T>(
  items: T[],
  getDate: (item: T) => string | null | undefined,
  getValue: (item: T) => number,
): number[] {
  const keys: string[] = [];
  const buckets = new Map<string, number>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    keys.push(key);
    buckets.set(key, 0);
  }
  for (const item of items) {
    const raw = getDate(item);
    if (!raw) continue;
    const d = new Date(raw);
    if (isNaN(d.getTime())) continue;
    const key = dayKey(d);
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + getValue(item));
    }
  }
  return keys.map((k) => buckets.get(k) ?? 0);
}

/* "today vs yesterday" delta from the last two points of a daily series. */
function deltaLabel(series: number[]): string {
  const today = series[series.length - 1] ?? 0;
  const yesterday = series[series.length - 2] ?? 0;
  if (yesterday === 0) return today > 0 ? "+100%" : "0%";
  const pct = Math.round(((today - yesterday) / yesterday) * 100);
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

/* "Jul 10, 11:55 AM" */
function formatActivityDate(dateStr?: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${date}, ${time}`;
}

const BOOKING_ACTIVITY: Record<
  string,
  { title: string; pill: string; color: string }
> = {
  paid: { title: "Booking Confirmed", pill: "Confirmed", color: "#3B82F6" },
  in_progress: { title: "Booking In Progress", pill: "In Progress", color: "#38BDF8" },
  completed: { title: "Booking Completed", pill: "Completed", color: "#22C55E" },
  cancelled: { title: "Booking Cancelled", pill: "Cancelled", color: "#EF4444" },
  refunded: { title: "Booking Refunded", pill: "Refunded", color: "#9CA3AF" },
  no_show: { title: "Booking No-Show", pill: "No Show", color: "#F97316" },
  expired: { title: "Booking Expired", pill: "Expired", color: "#6B7280" },
};

type ActivityItem = {
  key: string;
  icon: "calendar-outline" | "star-outline";
  title: string;
  subtitle: string;
  pill?: string;
  pillColor?: string;
  date: string;
};

export default function Home() {
  const { shopData, growthData, refetch } = useHomeDataUI();
  const { bookings, refetch: refetchBookings } = useBookingsData("all");
  const { data: reviewsData, refetch: refetchReviews } = useShopReviewsQuery();

  useEndBootWhenReady(!!shopData);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refetch();
      refetchBookings();
    }, []),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      refetch(); // shop profile + growth (fire-and-forget; not promise-based)
      await Promise.all([refetchBookings(), refetchReviews()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetch, refetchBookings, refetchReviews]);

  const todaysAgenda = useMemo(
    () => (bookings ?? []).filter((b) => isToday(b.bookingDate)),
    [bookings],
  );

  const shopInitial = shopData?.name?.charAt(0).toUpperCase() ?? "?";

  // Reviews stat — prefer server stats; fall back to averaging the review list.
  const reviewList = reviewsData?.data ?? [];
  const reviewCount = reviewsData?.stats?.totalReviews ?? reviewList.length;
  const avgRating =
    reviewsData?.stats?.averageRating ??
    (reviewList.length
      ? reviewList.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) /
        reviewList.length
      : 0);

  // Real 7-day series from the data already on hand (no time-series endpoint).
  const bookingList = bookings ?? [];
  const bookingDate = (b: (typeof bookingList)[number]) =>
    b.bookingDate || b.createdAt;
  const bookingSeries = useMemo(
    () => buildDailySeries(bookingList, bookingDate, () => 1),
    [bookingList],
  );
  const revenueSeries = useMemo(
    () =>
      buildDailySeries(
        bookingList.filter((b) => b.status === "paid" || b.status === "completed"),
        bookingDate,
        (b) => Number(b.totalAmount) || 0,
      ),
    [bookingList],
  );
  const todayRevenue = revenueSeries[revenueSeries.length - 1] ?? 0;
  const newCustomers = growthData?.newCustomers ?? 0;

  // Cumulative average rating at the end of each of the last 7 days — the
  // line moves only when a new review actually changes the average.
  const reviewTrend = useMemo(() => {
    const dated = reviewList
      .filter((r: any) => r.createdAt && !isNaN(new Date(r.createdAt).getTime()))
      .sort(
        (a: any, b: any) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    const points: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayEnd = new Date();
      dayEnd.setDate(dayEnd.getDate() - i);
      dayEnd.setHours(23, 59, 59, 999);
      let sum = 0;
      let count = 0;
      for (const r of dated) {
        if (new Date(r.createdAt) > dayEnd) break;
        sum += r.rating || 0;
        count++;
      }
      points.push(count ? sum / count : 0);
    }
    return points;
  }, [reviewList]);

  // Recent Activity — merged feed of booking events + new reviews, newest first.
  const activityFeed = useMemo<ActivityItem[]>(() => {
    const bookingEvents: ActivityItem[] = bookingList
      .filter((b) => BOOKING_ACTIVITY[b.status])
      .map((b) => {
        const meta = BOOKING_ACTIVITY[b.status];
        return {
          key: `booking-${b.orderId}`,
          icon: "calendar-outline" as const,
          title: meta.title,
          subtitle: `${b.serviceName} · ${b.customerName ?? "Customer"}`,
          pill: meta.pill,
          pillColor: meta.color,
          date: b.updatedAt || b.createdAt,
        };
      });

    const reviewEvents: ActivityItem[] = reviewList.map((r: any, i: number) => {
      const rating = Math.max(0, Math.min(5, Math.round(r.rating ?? 0)));
      const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
      const who = r.customerName ?? r.reviewerName ?? "Customer";
      const what = r.serviceName ? ` · ${r.serviceName}` : "";
      return {
        key: `review-${r.reviewId ?? r.id ?? i}`,
        icon: "star-outline" as const,
        title: "New Review",
        subtitle: `${stars} ${who}${what}`,
        date: r.createdAt,
      };
    });

    return [...bookingEvents, ...reviewEvents]
      .filter((e) => e.date && !isNaN(new Date(e.date).getTime()))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6);
  }, [bookingList, reviewList]);

  const insets = useSafeAreaInsets();

  return (
    <ThemedView className="h-full w-full">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFCC00"
            colors={["#FFCC00"]}
            progressViewOffset={insets.top}
          />
        }
      >
        {/* Gradient header */}
        <LinearGradient
          colors={["#E0A800", "#4A3B00", "#0A0A0A"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{
            paddingTop: insets.top + 16,
            paddingHorizontal: 16,
            paddingBottom: 22,
            borderBottomLeftRadius: 24,
            borderBottomRightRadius: 24,
          }}
        >
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center flex-1">
              <TouchableOpacity
                onPress={() => setSidebarOpen(true)}
                hitSlop={10}
                className="mr-3"
              >
                <Ionicons name="menu" size={26} color="#FFFFFF" />
              </TouchableOpacity>
              <Image
                source={require("@/assets/images/logo.png")}
                style={{ width: 160, height: 40 }}
                resizeMode="contain"
              />
            </View>
            <View className="flex-row items-center gap-2" style={{ marginRight: -10 }}>
              {shopData?.logoUrl ? (
                <Image
                  source={{ uri: shopData.logoUrl }}
                  style={{ width: 40, height: 40, borderRadius: 20 }}
                />
              ) : (
                <View
                  style={{ width: 40, height: 40, borderRadius: 20 }}
                  className="bg-black/30 items-center justify-center"
                >
                  <Text className="text-white font-bold text-sm">{shopInitial}</Text>
                </View>
              )}
              <MessageButton userType="shop" />
              <NotificationBell userType="shop" />
            </View>
          </View>

          <View className="flex-row items-center">
            <Text className="text-white text-base font-semibold">Welcome back! </Text>
            <Text className="text-white text-base font-bold">
              {shopData?.name ?? "Your Shop"} 👋
            </Text>
          </View>
          <Text className="text-white text-xl font-extrabold mt-1">
            Your business is doing great!
          </Text>
          <Text className="text-white/70 text-xs mt-1">
            Here's what is happening with your business today!
          </Text>
        </LinearGradient>

        {/* Stat cards */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16 }}
        >
          <StatCard
            icon="dollar-sign"
            label="Revenue"
            sublabel="Today"
            value={`$ ${todayRevenue.toLocaleString()}`}
            delta={deltaLabel(revenueSeries)}
            spark={revenueSeries}
            accent="#22C55E"
          />
          <StatCard
            icon="calendar"
            label="Bookings"
            sublabel="Today"
            value={String(todaysAgenda.length)}
            delta={deltaLabel(bookingSeries)}
            spark={bookingSeries}
            accent="#38BDF8"
          />
          <StatCard
            icon="users"
            label="New Customers"
            sublabel="Today"
            value={String(newCustomers)}
            delta={
              growthData?.growthPercentage != null
                ? `${growthData.growthPercentage > 0 ? "+" : ""}${growthData.growthPercentage}%`
                : undefined
            }
            spark={Array(7).fill(newCustomers)}
            accent="#A78BFA"
          />
          <StatCard
            icon="star"
            label="Reviews"
            sublabel="All time"
            value={reviewCount > 0 ? avgRating.toFixed(1) : "0.0"}
            caption={
              reviewCount > 0 ? `(${reviewCount}) reviews` : "No reviews yet"
            }
            spark={reviewTrend}
            accent="#FFCC00"
          />
        </ScrollView>

        <View className="px-4 pt-4">
          <DemoBanner />

          {/* Priority Actions */}
        <View>
          <SectionHeader title="Priority Actions" onSeeAll={() => {}} />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-6 -mx-1 px-1"
        >
          <PriorityCard
            icon="people-outline"
            iconColor="#38BDF8"
            title="Follow Up Leads"
            subtitle="6 inquiries waiting for response"
            ctaLabel="Contact Leads"
            onPress={() => router.push("/shop/messages" as never)}
          />
          <PriorityCard
            icon="megaphone-outline"
            iconColor="#22C55E"
            title="Promote Tuesday"
            subtitle="Expected +5 to 10 bookings"
            ctaLabel="Launch Campaign"
            onPress={() => router.push("/shop/promo-code" as never)}
          />
          <PriorityCard
            icon="star-outline"
            iconColor="#FFCC00"
            title="Request Reviews"
            subtitle="12 recent customers eligible"
            ctaLabel="Send Request"
            onPress={() => router.push("/shop/service-orders" as never)}
          />
        </ScrollView>

        {/* Agenda for Today */}
        <SectionHeader
          title="Agenda for Today"
          sparkle
          onSeeAll={() => router.push("/shop/tabs/service?tab=Booking" as never)}
        />
        {todaysAgenda.length === 0 ? (
          <EmptyRow text="No bookings scheduled for today" />
        ) : (
          todaysAgenda.slice(0, 5).map((b) => (
            <AgendaCard
              key={b.orderId}
              imageUrl={b.serviceImageUrl}
              title={b.serviceName}
              customer={b.customerName ?? "Customer"}
              time={formatTime12h(b.bookingTimeSlot)}
              onPress={() =>
                router.push(`/shop/booking/${b.orderId}` as never)
              }
            />
          ))
        )}

        {/* Recent Activity */}
        <View className="mt-6">
          <SectionHeader
            title="Recent Activity"
            onSeeAll={() =>
              router.push("/shop/tabs/service?tab=Booking" as never)
            }
          />
        </View>
        {activityFeed.length === 0 ? (
          <EmptyRow text="No recent activity" />
        ) : (
          activityFeed.map((item) => (
            <ActivityCard
              key={item.key}
              icon={item.icon}
              title={item.title}
              subtitle={item.subtitle}
              pill={item.pill}
              pillColor={item.pillColor}
              timestamp={formatActivityDate(item.date)}
            />
          ))
        )}

        {/* Quick Actions */}
        <View className="mt-6">
          <SectionHeader title="Quick Actions" />
        </View>
        <View className="flex-row gap-2 mb-4">
          <QuickAction
            icon="people-outline"
            label="Customers"
            onPress={() => router.push("/shop/tabs/customer" as never)}
          />
          <QuickAction
            icon="qr-code-outline"
            label="QR Code"
            onPress={() => router.push("/shop/reward-token" as never)}
          />
          <QuickAction
            icon="cash-outline"
            label="Redeem"
            onPress={() => router.push("/shop/redeem-token" as never)}
          />
          <QuickAction
            icon="briefcase-outline"
            label="My Bookings"
            onPress={() => router.push("/shop/tabs/service?tab=Booking" as never)}
          />
        </View>

        </View>
      </ScrollView>

      <ShopSidebar visible={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </ThemedView>
  );
}
