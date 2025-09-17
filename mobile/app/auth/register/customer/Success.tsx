import { Image, View, Text, Pressable } from "react-native";
import Screen from "@/components/Screen";
import { goBack } from "expo-router/build/global-state/routing";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

export default function CustomerRegisterSuccessPage() {
  return (
    <Screen>
      <View className="h-full justify-center items-center px-10">
        <View className="h-[64%] bg-[#121212] w-[328px] rounded-2xl">
          <Image
            source={require("@/assets/images/customer_success.png")}
            resizeMode="cover"
          />
          <Text className="text-white font-extrabold text-[32px] mt-6 text-center">
            Registration Successful!
          </Text>
          <Text className="text-gray-400 text-[14px] mt-4 text-center">
            You have successfully registered to{"\n"}RepairCoin App as a
            Customer.
          </Text>
          <Text className="text-gray-400 text-[14px] my-4 text-center">
            Press the button to proceed to your{"\n"}Home Screen!
          </Text>
          <View className="px-8 mt-4">
            <Pressable
              onPress={() => router.push("/dashboard/customer")}
              className="flex-row w-full items-center justify-center rounded-2xl py-3.5 bg-[#FFCC00]"
              android_ripple={{ color: "rgba(0,0,0,0.08)", borderless: false }}
            >
              <Text className="text-lg font-extrabold text-black mr-1">
                Go to Home
              </Text>
              <Ionicons name="arrow-forward" color="black" size={16} />
            </Pressable>
            <Pressable onPress={goBack} className="mt-8">
              <Text className="text-lg font-extrabold text-gray-400 text-center">
                Go Back
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Screen>
  );
}
