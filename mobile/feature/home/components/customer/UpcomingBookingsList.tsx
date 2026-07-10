import React from "react";
import { View, Text, Pressable, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMyAppointmentsQuery } from "@/feature/services/services-main/booking-tab/hooks";
import { MyAppointment } from "@/feature/services/services/service.interface";
import SectionHeader from "@/shared/components/ui/SectionHeader";
import { rScale } from "@/shared/utilities/responsive";

// Concrete pixel sizes scaled from the 375pt baseline so the row adapts
// across small phones and tablets. (Spacing/text stay as NativeWind dp.)
const AVATAR_SIZE = rScale(100); // w-14 / h-14
const ICON_MAIN = rScale(22);
const ICON_PIN = rScale(12);
const ICON_CHEVRON = rScale(18);

const DONE_STATUSES = ["cancelled", "canceled", "completed", "no_show"];

function formatWhen(dateStr: string, timeSlot: string | null) {
  const date = new Date(dateStr);
  const datePart = date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return timeSlot ? `${datePart} • ${timeSlot}` : datePart;
}

/**
 * V2 Home "Upcoming Bookings": the next few appointments pulled from
 * useMyAppointmentsQuery over a 90-day window.
 */
function UpcomingBookingsList() {
  const { start, end } = React.useMemo(() => {
    const now = new Date();
    const in90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    return {
      start: now.toISOString().slice(0, 10),
      end: in90.toISOString().slice(0, 10),
    };
  }, []);

  const { data } = useMyAppointmentsQuery(start, end);

  const upcoming: MyAppointment[] = React.useMemo(() => {
    const list = data ?? [];
    return list
      .filter((a) => !DONE_STATUSES.includes(a.status?.toLowerCase()))
      .sort(
        (a, b) =>
          new Date(a.bookingDate).getTime() - new Date(b.bookingDate).getTime()
      )
      .slice(0, 3);
  }, [data]);

  if (upcoming.length === 0) return null;

  return (
    <View>
      <SectionHeader
        title="Upcoming Bookings"
        onSeeAll={() =>
          router.navigate({
            pathname: "/customer/tabs/service",
            params: { tab: "Bookings" },
          })
        }
      />
      <View className="bg-zinc-900 border border-zinc-800 rounded-2xl p-2">
        {upcoming.map((item, idx) => (
          <Pressable
            key={item.orderId}
            onPress={() => router.push(`/customer/booking/${item.orderId}`)}
            className={`flex-row items-center p-2 ${
              idx < upcoming.length - 1 ? "border-b border-zinc-800" : ""
            }`}
          >
            {item.serviceImage ? (
              <Image
                source={{ uri: item.serviceImage }}
                className="rounded-xl"
                style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
                resizeMode="cover"
              />
            ) : (
              <View
                className="rounded-xl bg-zinc-800 items-center justify-center"
                style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
              >
                <Ionicons name="cube-outline" size={ICON_MAIN} color="#FFCC00" />
              </View>
            )}
            <View className="flex-1 ml-3">
              <Text className="text-white text-sm font-bold" numberOfLines={1}>
                {item.serviceName}
              </Text>
              <View className="flex-row items-center mt-0.5">
                <Ionicons
                  name="location-outline"
                  size={ICON_PIN}
                  color="#9CA3AF"
                />
                <Text className="text-zinc-400 text-xs ml-1" numberOfLines={1}>
                  {item.shopName}
                </Text>
              </View>
              <Text className="text-zinc-500 text-xs mt-0.5">
                {formatWhen(item.bookingDate, item.bookingTimeSlot)}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={ICON_CHEVRON}
              color="#52525b"
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default React.memo(UpcomingBookingsList);
