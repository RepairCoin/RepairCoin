import Screen from "@/shared/components/ui/Screen";
import { Entypo, Ionicons, Octicons } from "@expo/vector-icons";
import { View, Text, Image, ImageBackground, Pressable } from "react-native";
import { useChooseRole } from "../../hooks/useChooseRole";

export default function ChooseRoleScreen() {
  const { handleLogout, handleCustomerPress, handleShopPress } =
    useChooseRole();

  return (
    <Screen>
      <ImageBackground className="h-full w-full" resizeMode="cover">
        <View className="px-6 pt-16 pb-20 w-full h-full items-center">
          <View className="w-full flex-1 items-center justify-center">
            <Image
              source={require("@/assets/images/logo2.png")}
              className="w-80 h-80"
              resizeMode="contain"
            />
            <Text className="text-[#ffffff] mt-4 text-center w-full">
              Choose how you'd like to join our blockchain-powered repair
              ecosystem
            </Text>
          </View>
          <View className="w-[90%]">
            <Pressable
              onPress={handleCustomerPress}
              className="w-full items-center justify-centerl py-4 bg-[#FFCC00] mt-auto rounded-2xl flex-row justify-center gap-4"
              style={{ minHeight: 50 }}
              android_ripple={{ color: "rgba(0,0,0,0.08)", borderless: false }}
            >
              <Octicons name="person" color="#000" size={24} />
              <Text className="text-xl font-semibold text-black">
                I'm a Customer
              </Text>
            </Pressable>
            <Pressable
              onPress={handleShopPress}
              className="w-full items-center justify-centerl py-4 bg-[#FFCC00] mt-4 rounded-2xl flex-row justify-center gap-4"
              style={{ minHeight: 50 }}
              android_ripple={{ color: "rgba(0,0,0,0.08)", borderless: false }}
            >
              <Entypo name="shop" color="#000" size={24} />
              <Text className="text-xl font-semibold text-black">
                I'm a Shop Owner
              </Text>
            </Pressable>
          </View>

          <Pressable
            onPress={handleLogout}
            className="w-[90%] items-center py-4 bg-[#504F4F] mt-12 rounded-2xl flex-row justify-center gap-4"
            style={{ minHeight: 50 }}
            android_ripple={{
              color: "rgba(255,255,255,0.1)",
              borderless: false,
            }}
          >
            <Ionicons name="log-out-outline" color="#FFF" size={24} />
            <Text className="text-xl font-semibold text-white">Logout</Text>
          </Pressable>
        </View>
      </ImageBackground>
    </Screen>
  );
}
