import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SUBSCRIPTION_PERIOD } from "@/shared/constants/shopAccount";

type PlanCardProps = {
  isSubscribed: boolean;
  planLabel: string;
  price: number;
  includesLabel?: string;
  features: string[];
  popular?: boolean;
};

export default function PlanCard({
  isSubscribed,
  planLabel,
  price,
  includesLabel,
  features,
  popular,
}: PlanCardProps) {
  const accent = isSubscribed ? "#4CAF50" : "#FFCC00";

  return (
    <View
      className="rounded-2xl overflow-hidden mb-5 border"
      style={{ borderColor: isSubscribed ? "#4CAF5040" : "#FFCC0040" }}
    >
      <LinearGradient
        colors={isSubscribed ? ["#1F2E20", "#181818"] : ["#2E2913", "#181818"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.6, y: 1 }}
        className="p-5 relative overflow-hidden"
      >
        {/* Decorative circle */}
        <View
          className="w-[160px] h-[160px] border-[22px] rounded-full absolute"
          style={{
            borderColor: isSubscribed
              ? "rgba(76,175,80,0.08)"
              : "rgba(255,204,0,0.08)",
            right: -50,
            top: -50,
          }}
        />

        <View className="flex-row items-center justify-between mb-3">
          <Text
            className="text-base font-bold uppercase tracking-widest"
            style={{ color: accent }}
          >
            {planLabel}
          </Text>
          {isSubscribed ? (
            <View className="bg-[#4CAF50]/20 rounded-full px-3 py-1">
              <Text className="text-[#4CAF50] text-xs font-bold">
                CURRENT PLAN
              </Text>
            </View>
          ) : (
            popular && (
              <View className="bg-[#FFCC00] rounded-full px-3 py-1">
                <Text className="text-black text-xs font-bold">
                  MOST POPULAR
                </Text>
              </View>
            )
          )}
        </View>

        <View className="flex-row items-end mb-4">
          <Text className="text-white text-5xl font-extrabold">${price}</Text>
          <Text className="text-white/40 text-base mb-1.5 ml-1.5">
            / {SUBSCRIPTION_PERIOD}
          </Text>
        </View>

        <View className="border-t border-white/10 pt-4">
          {includesLabel && (
            <Text className="text-white/40 text-xs font-semibold uppercase tracking-wide mb-3">
              {includesLabel}
            </Text>
          )}
          <View className="gap-2.5">
            {features.map((feature) => (
              <View key={feature} className="flex-row items-center gap-2.5">
                <Ionicons name="checkmark-circle" color={accent} size={18} />
                <Text className="text-white/90 text-sm flex-1">{feature}</Text>
              </View>
            ))}
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}
