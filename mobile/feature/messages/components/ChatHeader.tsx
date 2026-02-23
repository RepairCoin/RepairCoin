import { View, Text, Pressable, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

type ChatHeaderProps = {
  name?: string;
  subtitle: string;
  onBack: () => void;
  shopImageUrl?: string;
  shopId?: string;
  customerImageUrl?: string;
  customerAddress?: string;
  isCustomer?: boolean;
};

export default function ChatHeader({
  name,
  subtitle,
  onBack,
  shopImageUrl,
  shopId,
  customerImageUrl,
  customerAddress,
  isCustomer,
}: ChatHeaderProps) {
  const router = useRouter();

  const handleAvatarPress = () => {
    if (isCustomer && shopId) {
      router.push(`/customer/profile/shop-profile/${shopId}` as any);
    } else if (!isCustomer && customerAddress) {
      router.push(`/shop/profile/customer-profile/${customerAddress}` as any);
    }
  };
  return (
    <View className="flex-row items-center px-4 py-3 border-b border-zinc-800 bg-zinc-900">
      <Pressable
        onPress={onBack}
        className="w-10 h-10 items-center justify-center mr-2"
      >
        <Ionicons name="arrow-back" size={24} color="white" />
      </Pressable>

      <Pressable
        onPress={handleAvatarPress}
        disabled={isCustomer ? !shopId : !customerAddress}
      >
        {isCustomer && shopImageUrl ? (
          <Image
            source={{ uri: shopImageUrl }}
            className="w-10 h-10 rounded-full mr-3 bg-zinc-800"
            resizeMode="cover"
          />
        ) : !isCustomer && customerImageUrl ? (
          <Image
            source={{ uri: customerImageUrl }}
            className="w-10 h-10 rounded-full mr-3 bg-zinc-800"
            resizeMode="cover"
          />
        ) : (
          <View className="w-10 h-10 rounded-full bg-[#FFCC00] items-center justify-center mr-3">
            <Text className="text-black font-bold">
              {name?.charAt(0).toUpperCase() || "?"}
            </Text>
          </View>
        )}
      </Pressable>

      <View className="flex-1">
        <Text className="text-white font-semibold">{name || "Conversation"}</Text>
        <Text className="text-zinc-400 text-xs">{subtitle}</Text>
      </View>

      <Pressable className="w-10 h-10 items-center justify-center">
        <Ionicons name="ellipsis-vertical" size={20} color="white" />
      </Pressable>
    </View>
  );
}
