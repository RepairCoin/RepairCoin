import { Image, View, Text, Pressable } from "react-native";
import Screen from "@/components/ui/Screen";
import { router } from "expo-router";

export default function CustomerSuccessScreen() {
  const handleGoToDashboard = () => {
    router.push("/customer/tabs/home");
  };

  return (
    <Screen>
      <View className="mx-4 h-[50%] mt-16">
        <Image
          source={require("@/assets/images/bg_success.png")}
          resizeMode="contain"
          className="w-full h-full"
        />
      </View>
      <Text className="text-white text-4xl font-extrabold text-center mt-8">
        Registration Successful!
      </Text>
      <Text className="text-gray-400 text-lg text-center mt-2">
        Registration complete!{"\n"}
        Keep your account details safe and private.
      </Text>
      <Pressable
        onPress={handleGoToDashboard}
        className="mx-6 items-center justify-centerl py-4 bg-[#FFCC00] mt-auto mb-20 rounded-full flex-row justify-center gap-3"
        style={{ minHeight: 50 }}
        android_ripple={{ color: "rgba(0,0,0,0.08)", borderless: false }}
      >
        <Text className="text-xl font-extrabold text-black">
          Go to Dashboard
        </Text>
      </Pressable>
    </Screen>
  );
}
