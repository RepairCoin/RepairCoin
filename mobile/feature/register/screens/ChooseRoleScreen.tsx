import Screen from "@/components/ui/Screen";
import { Entypo, MaterialIcons, Ionicons } from "@expo/vector-icons";
import { View, Text, ImageBackground, Pressable } from "react-native";
import { useChooseRole } from "../hooks";

export default function ChooseRoleScreen() {
  const { handleLogout, handleCustomerPress, handleShopPress } = useChooseRole();

  return (
    <Screen>
      <ImageBackground
        source={require("@/assets/images/bg_register.png")}
        className="h-full w-full"
        resizeMode="cover"
      >
        <View className="px-6 pt-16 pb-20 h-full">
          <Text className="text-4xl text-white">Welcome to</Text>
          <Text className="text-6xl text-[#FFCC00] font-extrabold mt-4">
            RepairCoin
          </Text>
          <Text className="text-gray-400 mt-4">
            Choose how you'd like to join our blockchain-powered{"\n"}repair
            ecosystem
          </Text>
          <Pressable
            onPress={handleCustomerPress}
            className="w-full items-center justify-centerl py-4 bg-[#FFCC00] mt-auto rounded-full flex-row justify-center gap-2"
            style={{ minHeight: 50 }}
            android_ripple={{ color: "rgba(0,0,0,0.08)", borderless: false }}
          >
            <MaterialIcons name="person" color="#000" size={24} />
            <Text className="text-xl font-extrabold text-black">
              I'm a Customer
            </Text>
          </Pressable>
          <Pressable
            onPress={handleShopPress}
            className="w-full items-center justify-centerl py-4 bg-[#FFCC00] mt-6 rounded-full flex-row justify-center gap-3"
            style={{ minHeight: 50 }}
            android_ripple={{ color: "rgba(0,0,0,0.08)", borderless: false }}
          >
            <Entypo name="shop" color="#000" size={24} />
            <Text className="text-xl font-extrabold text-black">
              I'm a Shop Owner
            </Text>
          </Pressable>

          <Pressable
            onPress={handleLogout}
            className="w-full items-center py-4 bg-gray-700 mt-6 rounded-full flex-row justify-center gap-3"
            style={{ minHeight: 50 }}
            android_ripple={{ color: "rgba(255,255,255,0.1)", borderless: false }}
          >
            <Ionicons name="log-out-outline" color="#FFF" size={24} />
            <Text className="text-xl font-semibold text-white">Logout</Text>
          </Pressable>
        </View>
      </ImageBackground>
    </Screen>
  );
}
