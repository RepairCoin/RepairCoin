import Screen from "@/components/Screen"
import { Entypo } from "@expo/vector-icons"
import { Image, View, Text } from "react-native"

export default function CustomerDashboard () {
  return (
    <Screen>
      <View className="pt-14 px-6">
        <View className="flex-row justify-between items-center">
          <Image source={require("@/assets/images/logo.png")} className="w-[40%] h-10" resizeMode="contain"  />
          <Entypo name="help-with-circle" color="#fff" size={24} />
        </View>
        <View className="flex-row my-4">
          <Text className="text-lg font-semibold text-[#FFCC00] mr-2">Hello!</Text>
          <Text className="text-lg font-semibold text-white">John Doe!</Text>
        </View>
        <View className="flex-row w-full h-12 bg-[#121212] rounded-xl justify-between">
          <View className="w-[33%] bg-[#FFCC00] my-1 ml-[0.5%] rounded-xl items-center justify-center">
            <Text className="text-lg font-semibold text-black">Wallet</Text>
          </View>
          <View className="w-[33%] bg-[#121212] my-1 rounded-xl items-center justify-center border-r-[#4B4B4B]">
            <Text className="text-lg font-semibold text-[#4B4B4B]">Referrals</Text>
          </View>
          <View className="w-[33%] bg-[#121212] my-1 mr-[0.5%] rounded-xl items-center justify-center">
              <Text className="text-lg font-semibold text-[#4B4B4B]">Approvals</Text>
          </View>
        </View>
      </View>
    </Screen>
  )
}