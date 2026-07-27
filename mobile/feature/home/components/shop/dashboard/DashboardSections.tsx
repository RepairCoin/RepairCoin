import { ReactNode } from "react";
import { View, Text, TouchableOpacity, Image as RNImage } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import Svg, { Polyline } from "react-native-svg";

/* ── Mini sparkline (svg) ────────────────────────────────────────────────── */
export function MiniSparkline({
  data,
  color = "#FFCC00",
  width = 96,
  height = 34,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (!data || data.length < 2) {
    return <View style={{ width, height }} />;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min;
  const stepX = width / (data.length - 1);
  const pad = 3;
  const points = data
    .map((v, i) => {
      const x = i * stepX;
      // Flat series (no change) draws mid-height, not at the bottom —
      // a constant value shouldn't read as "zero".
      const y =
        range === 0
          ? height / 2
          : pad + (1 - (v - min) / range) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <Svg width={width} height={height}>
      <Polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/* ── Gold gradient header wrapper is provided by the screen (LinearGradient) ── */

/* ── Section header (title + optional "See All") ─────────────────────────── */
export function SectionHeader({
  title,
  onSeeAll,
  sparkle = false,
}: {
  title: string;
  onSeeAll?: () => void;
  sparkle?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        minHeight: 24,
        marginBottom: 12,
      }}
    >
      {/* Sparkle is a plain emoji in the SAME string — a nested Ionicons run
          (different font family) mis-measures on Android and line-breaks the
          header. allowFontScaling={false} keeps measure and render in
          agreement for this fixed chrome label. */}
      <Text
        className="text-white font-bold"
        style={{
          fontSize: 16,
          includeFontPadding: false,
          lineHeight: 20,
        }}
        allowFontScaling={false}
      >
        {sparkle ? `${title} ✨` : title}
      </Text>
      {onSeeAll && (
        <TouchableOpacity
          onPress={onSeeAll}
          activeOpacity={0.7}
          hitSlop={8}
          style={{ marginLeft: "auto", paddingLeft: 12 }}
        >
          <Text
            className="text-white font-semibold"
            style={{ fontSize: 12, includeFontPadding: false, lineHeight: 20 }}
            allowFontScaling={false}
          >
            See All
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/* ── Stat card (Revenue / Bookings / New Customers / Reviews) ─────────────── */
export function StatCard({
  icon,
  label,
  sublabel,
  value,
  delta,
  caption,
  spark,
  accent = "#FFCC00",
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  sublabel?: string;
  value: string;
  delta?: string;
  caption?: string;
  spark?: number[];
  accent?: string;
}) {
  return (
    <View className="w-40 bg-[#1E1E20] rounded-2xl p-4 mr-3 border border-[#2A2A2A]">
      <View className="flex-row items-center mb-2">
        <Feather name={icon} size={14} color={accent} />
        <Text className="text-gray-300 text-xs font-semibold ml-1.5">
          {label}
        </Text>
      </View>
      {sublabel ? (
        <Text className="text-gray-600 text-[10px] mb-1">{sublabel}</Text>
      ) : null}
      <Text className="text-white text-xl font-bold" numberOfLines={1}>
        {value}
      </Text>
      {delta ? (
        <View className="flex-row items-center mt-1">
          <Feather name="trending-up" size={11} color="#22C55E" />
          <Text className="text-[#22C55E] text-[10px] font-semibold ml-1">
            {delta}
          </Text>
          <Text className="text-gray-600 text-[10px] ml-1">vs yesterday</Text>
        </View>
      ) : null}
      {caption ? (
        <Text className="text-gray-500 text-[10px] mt-1">{caption}</Text>
      ) : null}
      {spark ? (
        <View className="mt-2">
          <MiniSparkline data={spark} color={accent} />
        </View>
      ) : null}
    </View>
  );
}

/* ── Filter chips (All / Revenue / Customers / …) ────────────────────────── */
export function FilterChips({
  chips,
  active,
  onSelect,
}: {
  chips: string[];
  active: string;
  onSelect: (chip: string) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2 mb-3">
      {chips.map((chip) => {
        const isActive = chip === active;
        return (
          <TouchableOpacity
            key={chip}
            onPress={() => onSelect(chip)}
            activeOpacity={0.7}
            className={`px-3 py-1.5 rounded-full border ${
              isActive
                ? "bg-[#FFCC00] border-[#FFCC00]"
                : "bg-transparent border-[#333]"
            }`}
          >
            <Text
              className={`text-xs font-medium ${
                isActive ? "text-black" : "text-gray-400"
              }`}
            >
              {chip}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/* ── Recommendation / list row card ──────────────────────────────────────── */
export function ListRowCard({
  icon,
  iconColor = "#FFCC00",
  title,
  subtitle,
  right,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
      className="bg-[#121212] rounded-2xl p-3.5 mb-2.5 flex-row items-center border border-[#222]"
    >
      <View
        className="w-9 h-9 rounded-full items-center justify-center mr-3"
        style={{ backgroundColor: iconColor + "22" }}
      >
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View className="flex-1">
        <Text className="text-white text-sm font-semibold" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-gray-500 text-xs mt-0.5" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? (
        <Ionicons name="chevron-forward" size={18} color="#4B5563" />
      )}
    </TouchableOpacity>
  );
}

/* ── Agenda row (image thumb · title/customer/time · green arrow) ────────── */
export function AgendaCard({
  imageUrl,
  title,
  customer,
  time,
  onPress,
}: {
  imageUrl?: string | null;
  title: string;
  customer: string;
  time?: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
      className="bg-[#121212] rounded-2xl p-3 mb-2.5 flex-row items-center border border-[#222]"
    >
      {imageUrl ? (
        <RNImage
          source={{ uri: imageUrl }}
          style={{ width: 48, height: 48, borderRadius: 10 }}
        />
      ) : (
        <View
          style={{ width: 48, height: 48, borderRadius: 10 }}
          className="bg-[#1E1E23] items-center justify-center"
        >
          <Ionicons name="construct-outline" size={20} color="#6B7280" />
        </View>
      )}
      <View className="flex-1 ml-3">
        <Text className="text-white text-sm font-bold" numberOfLines={1}>
          {title}
        </Text>
        <Text className="text-gray-500 text-xs mt-0.5" numberOfLines={1}>
          {customer}
        </Text>
        {time ? (
          <Text className="text-gray-500 text-xs mt-0.5">{time}</Text>
        ) : null}
      </View>
      <View className="w-8 h-8 rounded-full bg-[#22C55E]/15 items-center justify-center ml-2">
        <Ionicons name="arrow-forward" size={16} color="#22C55E" />
      </View>
    </TouchableOpacity>
  );
}

/* ── Recent-activity row (icon · title/subtitle · status pill + date) ────── */
export function ActivityCard({
  icon,
  iconColor = "#FFCC00",
  title,
  subtitle,
  pill,
  pillColor,
  timestamp,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  title: string;
  subtitle: string;
  pill?: string;
  pillColor?: string;
  timestamp: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
      className="bg-[#121212] rounded-2xl p-3.5 mb-2.5 flex-row items-center border border-[#222]"
    >
      <View
        className="w-10 h-10 rounded-xl items-center justify-center mr-3"
        style={{ backgroundColor: iconColor + "1A" }}
      >
        <Ionicons name={icon} size={19} color={iconColor} />
      </View>
      <View className="flex-1 mr-2">
        <Text className="text-white text-sm font-bold" numberOfLines={1}>
          {title}
        </Text>
        <Text className="text-gray-500 text-xs mt-0.5" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <View className="items-end">
        {pill && pillColor ? (
          <View
            className="px-2.5 py-1 rounded-full mb-1"
            style={{ backgroundColor: pillColor + "22" }}
          >
            <Text
              className="text-[10px] font-semibold"
              style={{ color: pillColor }}
            >
              {pill}
            </Text>
          </View>
        ) : null}
        <Text className="text-gray-500 text-[10px]">{timestamp}</Text>
      </View>
    </TouchableOpacity>
  );
}

/* ── Priority action card (horizontal) ───────────────────────────────────── */
export function PriorityCard({
  icon,
  iconColor,
  title,
  subtitle,
  ctaLabel,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  onPress?: () => void;
}) {
  return (
    <View className="bg-[#121212] rounded-2xl p-4 mr-3 border border-[#222] w-44">
      <View
        className="w-9 h-9 rounded-full items-center justify-center mb-3"
        style={{ backgroundColor: iconColor + "22" }}
      >
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text className="text-white text-sm font-semibold" numberOfLines={1}>
        {title}
      </Text>
      <Text className="text-gray-500 text-[11px] mt-1 mb-3" numberOfLines={2}>
        {subtitle}
      </Text>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        className="bg-[#22C55E] rounded-lg py-2 items-center"
      >
        <Text className="text-white text-xs font-bold">{ctaLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ── Quick action button ─────────────────────────────────────────────────── */
export function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="items-center flex-1"
    >
      <View className="w-14 h-14 rounded-2xl bg-[#121212] border border-[#222] items-center justify-center mb-2">
        <Ionicons name={icon} size={22} color="#FFCC00" />
      </View>
      <Text className="text-gray-400 text-[11px] text-center" numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/* ── Empty state row ─────────────────────────────────────────────────────── */
export function EmptyRow({ text }: { text: string }) {
  return (
    <View className="bg-[#121212] rounded-2xl p-5 items-center border border-[#222]">
      <Ionicons name="calendar-outline" size={22} color="#374151" />
      <Text className="text-gray-500 text-xs mt-2">{text}</Text>
    </View>
  );
}
