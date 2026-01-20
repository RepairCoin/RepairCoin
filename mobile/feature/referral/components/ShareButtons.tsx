import { View, Text, Pressable } from "react-native";
import { Ionicons, FontAwesome5 } from "@expo/vector-icons";

interface ShareButtonsProps {
  onWhatsApp: () => void;
  onTwitter: () => void;
  onFacebook: () => void;
  onMore: () => void;
}

export default function ShareButtons({
  onWhatsApp,
  onTwitter,
  onFacebook,
  onMore,
}: ShareButtonsProps) {
  return (
    <View className="px-5 mb-6">
      <Text className="text-white text-lg font-semibold mb-3">Share via</Text>
      <View className="flex-row gap-3">
        <Pressable
          onPress={onWhatsApp}
          className="flex-1 bg-[#25D366] rounded-xl py-4 flex-row items-center justify-center"
        >
          <FontAwesome5 name="whatsapp" size={20} color="white" />
          <Text className="text-white font-semibold ml-2">WhatsApp</Text>
        </Pressable>
        <Pressable
          onPress={onTwitter}
          className="flex-1 bg-[#1DA1F2] rounded-xl py-4 flex-row items-center justify-center"
        >
          <FontAwesome5 name="twitter" size={20} color="white" />
          <Text className="text-white font-semibold ml-2">Twitter</Text>
        </Pressable>
      </View>
      <View className="flex-row gap-3 mt-3">
        <Pressable
          onPress={onFacebook}
          className="flex-1 bg-[#1877F2] rounded-xl py-4 flex-row items-center justify-center"
        >
          <FontAwesome5 name="facebook-f" size={20} color="white" />
          <Text className="text-white font-semibold ml-2">Facebook</Text>
        </Pressable>
        <Pressable
          onPress={onMore}
          className="flex-1 bg-zinc-800 rounded-xl py-4 flex-row items-center justify-center"
        >
          <Ionicons name="share-outline" size={20} color="white" />
          <Text className="text-white font-semibold ml-2">More</Text>
        </Pressable>
      </View>
    </View>
  );
}
