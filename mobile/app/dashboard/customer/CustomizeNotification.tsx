import { AntDesign, FontAwesome } from "@expo/vector-icons";
import { goBack } from "expo-router/build/global-state/routing";
import { View, Text } from "react-native";

export default function CustomizeNotification() {
  return (
    <View className="w-full h-full bg-zinc-950">
      <View className="pt-16 px-4 gap-2">
        <View className="flex-row justify-between items-center">
          <AntDesign name="left" color="white" size={25} onPress={goBack} />
          <Text className="text-white text-2xl font-extrabold">
            Customize Notification
          </Text>
          <View className="w-[25px]" />
        </View>
        <Text className="text-white/25 text-center text-lg my-2">
          Choose your notification preference
        </Text>
        <View className="bg-[#202325] w-full p-4 rounded-t-xl flex-row items-center">
          <View className="flex-1 px-2">
            <View className="flex-row justify-between">
              <Text className="text-white text-xl font-extrabold">
                Everything
              </Text>
              <View className="bg-[#DDF6E2] py-1 w-40 items-center rounded-lg">
                <Text className="text-[#1A9D5B]">Recommended</Text>
              </View>
            </View>
            <Text className="text-white mt-2">
              All notifications, including alerts, updates, redemption requests,
              and more
            </Text>
          </View>
        </View>
        <View className="bg-[#202325] w-full p-4 flex-row items-center">
          <View className="flex-1 px-2">
            <View className="flex-row justify-between">
              <Text className="text-white text-xl font-extrabold">
                Essential
              </Text>
            </View>
            <Text className="text-white mt-2">
              Essential updates, like big price changes and important account
              activities
            </Text>
          </View>
        </View>
        <View className="bg-[#202325] w-full p-4 flex-row items-center">
          <View className="flex-1 px-2">
            <View className="flex-row justify-between">
              <Text className="text-white text-xl font-extrabold">Minimal</Text>
            </View>
            <Text className="text-white mt-2">
              Only the most critical account notifications.
            </Text>
          </View>
        </View>
        <View className="bg-[#202325] w-full p-4 rounded-b-xl flex-row items-center">
          <View className="flex-1 px-2">
            <View className="flex-row justify-between">
              <Text className="text-white text-xl font-extrabold">Custom</Text>
            </View>
            <Text className="text-white mt-2">
              You’ve customized your notifications
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
