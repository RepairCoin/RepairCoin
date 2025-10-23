import { Image, View, Text, Pressable } from "react-native";
import Screen from "@/components/ui/Screen";
import { goBack } from "expo-router/build/global-state/routing";
import { Ionicons } from "@expo/vector-icons";

export default function ShopRegisterSuccessPage() {
  return (
    <Screen>
      <View className="px-8 py-20">
        <Image
          source={require("@/assets/images/bg_success.png")}
        />
      </View>
    </Screen>
  );
}
