import { useMemo } from "react";
import { View, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { SkeletonBox } from "@/shared/components/ui/Skeleton";
import { useAiRecommendationsQuery } from "../../../hooks/useAiRecommendationsQuery";
import {
  RecAction,
  RecCategory,
} from "../../../services/aiRecommendations.interface";
import { SectionHeader, PriorityCard } from "./DashboardSections";

/** Icon + accent per category. Mirrors REC_STYLE in the web DashboardOverview. */
const REC_STYLE: Record<
  RecCategory,
  { icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  revenue: { icon: "calendar-outline", color: "#F59E0B" },
  customers: { icon: "people-outline", color: "#38BDF8" },
  marketing: { icon: "megaphone-outline", color: "#38BDF8" },
  inventory: { icon: "cube-outline", color: "#A855F7" },
  operations: { icon: "sparkles-outline", color: "#34D399" },
};

/**
 * Web tab names → mobile routes. Tabs with no mobile screen (ads, automation)
 * are absent on purpose: a tile whose button goes nowhere is worse than one
 * fewer tile, so unmapped recommendations are dropped rather than guessed at.
 */
const TAB_ROUTES: Record<string, string> = {
  messages: "/shop/messages",
  customers: "/shop/tabs/customer",
  bookings: "/shop/tabs/service?tab=Booking",
  services: "/shop/tabs/service",
  promo: "/shop/promo-code",
  orders: "/shop/service-orders",
};

/**
 * Only `navigate` actions can be honoured on mobile. `assistant`, `campaign`
 * and `workflow` all open surfaces that only exist on web (the AI assistant and
 * the automation builder), so those recommendations are filtered out until
 * mobile has an equivalent screen.
 */
function routeForAction(action: RecAction): string | null {
  if (action.kind !== "navigate") return null;
  return TAB_ROUTES[action.tab] ?? null;
}

/**
 * Priority Actions — server-driven, same engine and surface as web
 * (`GET /ai/recommendations?presentation=action`). The section hides itself
 * when the shop has nothing pending or its tier doesn't include AI insights,
 * rather than padding the dashboard with placeholders.
 */
export function PriorityActions() {
  const { data, isLoading } = useAiRecommendationsQuery("action", 3);

  const items = useMemo(
    () =>
      (data?.recommendations ?? [])
        .map((rec) => ({ rec, route: routeForAction(rec.action) }))
        .filter((item): item is { rec: typeof item.rec; route: string } =>
          Boolean(item.route),
        ),
    [data],
  );

  if (!isLoading && items.length === 0) return null;

  return (
    <>
      <View>
        <SectionHeader title="Priority Actions" />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-6 -mx-1 px-1"
      >
        {isLoading
          ? [0, 1, 2].map((i) => (
              <View
                key={i}
                className="bg-[#121212] rounded-2xl p-4 mr-3 border border-[#222] w-44"
              >
                <SkeletonBox width={36} height={36} borderRadius={18} />
                <View className="mt-3">
                  <SkeletonBox width="70%" height={12} />
                </View>
                <View className="mt-2 mb-3">
                  <SkeletonBox width="100%" height={10} />
                </View>
                <SkeletonBox width="100%" height={32} borderRadius={8} />
              </View>
            ))
          : items.map(({ rec, route }) => {
              const style = REC_STYLE[rec.category] ?? REC_STYLE.operations;
              return (
                <PriorityCard
                  key={rec.id}
                  icon={style.icon}
                  iconColor={style.color}
                  title={rec.title}
                  subtitle={rec.description}
                  ctaLabel={rec.ctaLabel ?? "Open"}
                  onPress={() => router.push(route as never)}
                />
              );
            })}
      </ScrollView>
    </>
  );
}
