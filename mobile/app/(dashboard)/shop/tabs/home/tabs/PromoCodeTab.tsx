import {
  View,
  Text,
  Pressable,
  Image,
  ScrollView,
} from "react-native";
import { router } from "expo-router";

export default function PromoCodeTab() {
  return (
    <ScrollView className="h-full w-full mt-4" pointerEvents="auto">
      <View className="h-52">
        <View className="w-full h-full bg-[#FFCC00] rounded-3xl flex-row overflow-hidden relative">
          <View
            className="w-[300px] h-[300px] border-[48px] border-[rgba(102,83,7,0.13)] rounded-full absolute"
            style={{
              right: -80,
              top: -20,
            }}
          />
          <Image
            source={require("@/assets/images/customer_approval_card.png")}
            className="w-98 h-98 bottom-0 right-0 absolute"
            resizeMode="contain"
          />
          <View className="pl-4 mt-10 w-[60%]">
            <Text className="text-black font-bold text-2xl">Promo Code</Text>
            <Text className="text-black/60 text-base">
              Code to redeem an offer
            </Text>
            <Pressable
              onPress={() => router.push("/shop/promo-code")}
              className="bg-black w-40 rounded-xl py-2 mt-4 justify-center items-center"
            >
              <Text className="text-[#FFCC00] font-bold text-sm">
                Create Promo Code
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
