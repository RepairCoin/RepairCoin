import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatDistanceToNow } from "date-fns";
import { useLocalSearchParams, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { notificationApi } from "@/feature/notification/services/notification.services";
import { Notification } from "@/feature/notification/services/notification.interface";

function DesignBlock({ block, metadata }: { block: any; metadata: any }) {
  const style = block.style || {};

  switch (block.type) {
    case "headline":
      return (
        <Text
          className="text-lg font-bold text-center mb-3"
          style={{ color: style.color || "#111827" }}
        >
          {block.content}
        </Text>
      );

    case "text":
      return (
        <Text
          className="text-sm mb-3 leading-5"
          style={{
            color: style.color || "#374151",
            textAlign: style.textAlign || "left",
          }}
        >
          {block.content?.replace(/<[^>]*>/g, "") || ""}
        </Text>
      );

    case "button": {
      const hasService = !!metadata.serviceId;
      return (
        <TouchableOpacity
          onPress={() => {
            if (hasService) {
              router.push(`/customer/service/${metadata.serviceId}`);
            }
          }}
          className="items-center my-3"
          activeOpacity={0.8}
        >
          <View
            className="rounded-lg px-8 py-3"
            style={{ backgroundColor: style.backgroundColor || "#eab308" }}
          >
            <Text
              className="font-bold text-sm"
              style={{ color: style.textColor || "#000" }}
            >
              {block.content}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }

    case "coupon": {
      if (!metadata.couponValue) return null;
      const couponDisplay =
        metadata.couponType === "percentage"
          ? `${metadata.couponValue}%`
          : `$${metadata.couponValue}`;
      const expiryText = metadata.couponExpiresAt
        ? `Expires: ${new Date(metadata.couponExpiresAt).toLocaleDateString()}`
        : "";

      return (
        <View
          className="rounded-xl p-5 items-center my-3"
          style={{ backgroundColor: style.backgroundColor || "#10B981" }}
        >
          <Text
            className="text-4xl font-bold mb-1"
            style={{ color: style.textColor || "white" }}
          >
            {couponDisplay}
          </Text>
          <Text
            className="text-base font-bold"
            style={{ color: style.textColor || "white" }}
          >
            OFF your next visit!
          </Text>
          {expiryText ? (
            <Text className="text-xs text-white/70 mt-2">{expiryText}</Text>
          ) : null}
        </View>
      );
    }

    case "service_card":
      return (
        <View className="rounded-xl overflow-hidden my-3 bg-[#1a1a2e]">
          {block.serviceImage ? (
            <Image
              source={{ uri: block.serviceImage }}
              className="w-full h-36"
              resizeMode="cover"
            />
          ) : (
            <View className="w-full h-24 items-center justify-center bg-black/20">
              <Text className="text-3xl">🔧</Text>
            </View>
          )}
          <View className="p-4 border-t border-white/10">
            <Text className="text-white font-bold text-base">
              {block.serviceName || "Featured Service"}
            </Text>
            {block.servicePrice != null && (
              <Text className="text-emerald-400 font-semibold mt-1">
                ${typeof block.servicePrice === "number" ? block.servicePrice.toFixed(2) : block.servicePrice}
              </Text>
            )}
          </View>
        </View>
      );

    case "image":
      return block.src ? (
        <Image
          source={{ uri: block.src }}
          className="w-full h-48 rounded my-3"
          resizeMode="cover"
        />
      ) : null;

    case "divider":
      return <View className="border-t border-gray-600 my-3" />;

    case "spacer":
      return <View style={{ height: parseInt(style.height) || 16 }} />;

    default:
      return null;
  }
}

export default function CampaignDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [notification, setNotification] = useState<Notification | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchNotification() {
      try {
        const response = await notificationApi.getNotifications(1, 50);
        const found = (response.items || []).find((n) => n.id === id);
        setNotification(found || null);
      } catch (error) {
        console.error("Failed to fetch campaign:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchNotification();
  }, [id]);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-zinc-950 items-center justify-center">
        <ActivityIndicator size="large" color="#FFCC00" />
      </SafeAreaView>
    );
  }

  if (!notification) {
    return (
      <SafeAreaView className="flex-1 bg-zinc-950 items-center justify-center px-6">
        <Ionicons name="alert-circle-outline" size={48} color="#666" />
        <Text className="text-gray-400 text-base mt-3">Campaign not found</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-4 bg-[#FFCC00] rounded-xl px-6 py-3"
        >
          <Text className="text-black font-bold">Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const metadata = notification.metadata || {};
  const design = metadata.designContent;
  const hasBlocks = design?.blocks && Array.isArray(design.blocks);
  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), {
    addSuffix: true,
  });

  return (
    <SafeAreaView className="flex-1 bg-zinc-950" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-gray-800">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text className="text-white font-semibold text-lg flex-1" numberOfLines={1}>
          {metadata.campaignName || "Campaign"}
        </Text>
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1 px-4 py-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Shop info banner */}
        <View className="flex-row items-center mb-4">
          <View className="w-8 h-8 rounded-full bg-[#FFCC00]/20 items-center justify-center mr-2">
            <Text className="text-sm">📢</Text>
          </View>
          <View>
            <Text className="text-gray-400 text-xs">
              from <Text className="text-[#FFCC00]">{metadata.shopName || "RepairCoin"}</Text>
            </Text>
            <Text className="text-gray-500 text-xs">{timeAgo}</Text>
          </View>
        </View>

        {hasBlocks ? (
          <View className="bg-white rounded-xl overflow-hidden">
            {/* Shop header */}
            {design.header?.enabled !== false && (
              <View
                className="p-5 items-center"
                style={{ backgroundColor: design.header?.backgroundColor || "#1a1a2e" }}
              >
                <Text className="text-white text-lg font-bold">
                  {metadata.shopName}
                </Text>
              </View>
            )}

            {/* Blocks */}
            <View className="p-4">
              {design.blocks.map((block: any, index: number) => (
                <DesignBlock key={block.id || index} block={block} metadata={metadata} />
              ))}
            </View>

            {/* Footer */}
            {design.footer?.showUnsubscribe && (
              <View className="border-t border-gray-200 p-4 bg-gray-50">
                <Text className="text-gray-400 text-xs text-center">
                  You received this because you are a customer of {metadata.shopName}.
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View className="bg-zinc-900 rounded-xl p-4">
            <Text className="text-gray-300 text-sm leading-5">
              {notification.message}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
