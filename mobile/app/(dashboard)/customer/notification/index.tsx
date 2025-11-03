import { View, Text, ScrollView, Pressable, Image } from "react-native";
import { AntDesign, FontAwesome } from "@expo/vector-icons";
import { router } from "expo-router";
import { goBack } from "expo-router/build/global-state/routing";

const NotificationCard = () => {
  return (
    <View className="bg-[#202325] w-full p-4 rounded-xl flex-row items-center my-2">
      <Image source={require("@/assets/images/repaircoin-logo-mini.png")} />
      <View className="flex-1 px-2">
        <View className="flex-row justify-between">
          <Text className="text-white text-xl font-extrabold">
            Redemption Approval
          </Text>
          <Text className="text-[#6C6C6C] text-lg font-semibold">
            Yesterday
          </Text>
        </View>
        <Text className="text-white mt-2">
          A redemption approval from Mike Repair Shop is awaiting your response.
        </Text>
      </View>
    </View>
  );
};

export default function Notification() {
  return (
    <View className="w-full h-full bg-zinc-950">
      <View className="pt-16 px-4 gap-4">
        <View className="flex-row justify-between items-center">
          <AntDesign name="left" color="white" size={25} onPress={goBack} />
          <Text className="text-white text-2xl font-extrabold">
            Notification
          </Text>
          <View className="w-[25px]" />
        </View>
      </View>
      <ScrollView className="px-4 mt-4">
        <Text className="text-white/25 text-2xl my-2">This Week</Text>
        <NotificationCard />
        <NotificationCard />
        <NotificationCard />
        <NotificationCard />
        <Text className="text-white/25 text-2xl my-2">This Month</Text>
        <NotificationCard />
        <NotificationCard />
      </ScrollView>
    </View>
  );
}
