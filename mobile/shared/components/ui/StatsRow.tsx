import React from "react";
import { View, Text } from "react-native";

export interface StatItem {
  value: string | number;
  label: string;
}

interface StatsRowProps {
  items: StatItem[];
  /** Container className override (defaults to the V2 dark card). */
  className?: string;
}

/**
 * Multi-column divider stat block (e.g. the V2 Account row:
 * Rewards Balance / Successful Bookings / Referred Friends / Reviews Submitted).
 * Data-driven so any screen can pass its own set of stats.
 */
function StatsRow({
  items,
  className = "flex-row mx-4 bg-zinc-900 rounded-2xl p-4",
}: StatsRowProps) {
  return (
    <View className={className}>
      {items.map((item, index) => (
        <React.Fragment key={`${item.label}-${index}`}>
          {index > 0 && <View className="w-px bg-zinc-800" />}
          <View className="flex-1 items-center px-1">
            <Text
              className="text-white text-xl font-bold"
              numberOfLines={1}
            >
              {item.value}
            </Text>
            <Text
              className="text-zinc-500 text-xs mt-1 text-center"
              numberOfLines={2}
            >
              {item.label}
            </Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

export default React.memo(StatsRow);
