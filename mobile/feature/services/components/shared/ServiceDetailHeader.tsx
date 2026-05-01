import { View, Image, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface ServiceDetailHeaderProps {
  imageUrl?: string;
  isCustomer: boolean;
  isStartingChat: boolean;
  onGoBack: () => void;
  onMessageShop: () => void;
  onShare: () => void;
}

export function ServiceDetailHeader({
  imageUrl,
  isCustomer,
  isStartingChat,
  onGoBack,
  onMessageShop,
  onShare,
}: ServiceDetailHeaderProps) {
  return (
    <View className="relative">
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          className="w-full h-64"
          resizeMode="cover"
        />
      ) : (
        <View className="w-full h-64 bg-gray-800 items-center justify-center">
          <Ionicons name="image-outline" size={64} color="#6B7280" />
        </View>
      )}

      {/* Back Button Overlay */}
      <TouchableOpacity
        onPress={onGoBack}
        className="absolute top-14 left-4 bg-black/50 rounded-full p-2"
      >
        <Ionicons name="arrow-back" color="white" size={24} />
      </TouchableOpacity>

      {/* Action Buttons (Top Right) */}
      <View className="absolute top-14 right-4 flex-row">
        {/* Message Button - Only visible for customers */}
        {isCustomer && (
          <TouchableOpacity
            onPress={onMessageShop}
            disabled={isStartingChat}
            className="bg-black/50 rounded-full p-2 mr-2"
          >
            {isStartingChat ? (
              <ActivityIndicator size={22} color="#FFCC00" />
            ) : (
              <Ionicons name="chatbubble-outline" color="#FFCC00" size={22} />
            )}
          </TouchableOpacity>
        )}

        {/* Share Button */}
        <TouchableOpacity
          onPress={onShare}
          className="bg-black/50 rounded-full p-2"
        >
          <Ionicons name="share-social-outline" color="#FFCC00" size={22} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
