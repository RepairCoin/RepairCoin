import { Text, View, Pressable } from "react-native";
import { ThemedView } from "@/components/ui/ThemedView";
import { AntDesign, MaterialIcons } from "@expo/vector-icons";
import { goBack } from "expo-router/build/global-state/routing";
import { useShopByWalletAddress } from "@/hooks";
import { useAuthStore } from "@/store/auth.store";

export default function Subscription() {
  const { account } = useAuthStore();
  const { data: shopData } = useShopByWalletAddress(account?.address || "");

  const isSubscribed = shopData?.data?.operational_status === "subscription_qualified";

  const handleSubscribe = () => {
    // TODO: Implement Stripe subscription
  };

  const handleCancelSubscription = () => {
    // TODO: Implement cancel subscription
  };

  return (
    <ThemedView className="w-full h-full">
      <View className="pt-16 px-4 gap-4 flex-1">
        <View className="flex-row justify-between items-center">
          <AntDesign name="left" color="white" size={18} onPress={goBack} />
          <Text className="text-white text-2xl font-extrabold">
            Subscription
          </Text>
          <View className="w-[25px]" />
        </View>

        <View className="flex-1 justify-center items-center">
          <View className="bg-[#212121] rounded-2xl p-6 w-full">
            <View className="items-center mb-6">
              <View className={`rounded-full w-20 h-20 items-center justify-center mb-4 ${isSubscribed ? "bg-[#2B4D2B]" : "bg-[#2B2B2B]"}`}>
                <MaterialIcons
                  name={isSubscribed ? "check-circle" : "card-membership"}
                  color={isSubscribed ? "#4CAF50" : "#FFCC00"}
                  size={40}
                />
              </View>
              <Text className="text-white text-xl font-bold mb-2">
                {isSubscribed ? "You're Subscribed!" : "Shop Pro Subscription"}
              </Text>
              <Text className="text-white/50 text-center text-sm">
                {isSubscribed
                  ? "Enjoy all premium features for your repair business"
                  : "Unlock all features and grow your repair business"}
              </Text>
            </View>

            {isSubscribed && (
              <View className="bg-[#2B4D2B] rounded-xl p-3 mb-4 flex-row items-center justify-center gap-2">
                <AntDesign name="checkcircle" color="#4CAF50" size={18} />
                <Text className="text-[#4CAF50] font-semibold">Active Subscription</Text>
              </View>
            )}

            <View className="bg-[#2B2B2B] rounded-xl p-4 mb-6">
              <View className="items-center">
                <Text className={`text-5xl font-extrabold ${isSubscribed ? "text-[#4CAF50]" : "text-[#FFCC00]"}`}>
                  $500
                </Text>
                <Text className="text-white/50 text-base mt-1">
                  per month
                </Text>
              </View>
            </View>

            <View className="gap-3 mb-6">
              <View className="flex-row items-center gap-3">
                <AntDesign name="checkcircle" color={isSubscribed ? "#4CAF50" : "#FFCC00"} size={20} />
                <Text className="text-white text-base">Unlimited RCN purchases</Text>
              </View>
              <View className="flex-row items-center gap-3">
                <AntDesign name="checkcircle" color={isSubscribed ? "#4CAF50" : "#FFCC00"} size={20} />
                <Text className="text-white text-base">Issue rewards to customers</Text>
              </View>
              <View className="flex-row items-center gap-3">
                <AntDesign name="checkcircle" color={isSubscribed ? "#4CAF50" : "#FFCC00"} size={20} />
                <Text className="text-white text-base">Process redemptions</Text>
              </View>
              <View className="flex-row items-center gap-3">
                <AntDesign name="checkcircle" color={isSubscribed ? "#4CAF50" : "#FFCC00"} size={20} />
                <Text className="text-white text-base">Customer management tools</Text>
              </View>
              <View className="flex-row items-center gap-3">
                <AntDesign name="checkcircle" color={isSubscribed ? "#4CAF50" : "#FFCC00"} size={20} />
                <Text className="text-white text-base">Analytics dashboard</Text>
              </View>
            </View>

            {isSubscribed ? (
              <Pressable
                onPress={handleCancelSubscription}
                className="bg-[#E74C4C] rounded-xl py-4 items-center active:opacity-80"
              >
                <Text className="text-white text-lg font-bold">
                  Cancel Subscription
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={handleSubscribe}
                className="bg-[#FFCC00] rounded-xl py-4 items-center active:opacity-80"
              >
                <Text className="text-black text-lg font-bold">
                  Subscribe Now
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </ThemedView>
  );
}
