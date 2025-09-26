import { View, Text, Pressable, Image } from "react-native";
import {
  Entypo,
  MaterialIcons,
  Octicons,
  SimpleLineIcons,
} from "@expo/vector-icons";
import DetailCard from "@/components/DetailCard";
import TierBenefitsModal from "./TierBenefitsModal";
import { useState } from "react";
import TokenSummaryModal from "./TokenSummaryModal";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

export default function WalletTab() {
  const [tierModalVisible, setTierModalVisible] = useState<boolean>(false);
  const [tokenSummaryModalVisible, setTokenSummaryModalVisible] =
    useState<boolean>(false);

  return (
    <View className="mt-4">
      <View className="h-40">
        <View className="w-full h-full bg-[#FFCC00] rounded-3xl flex-row overflow-hidden relative">
          <View
            className="w-[300px] h-[300px] border-[48px] border-[rgba(102,83,7,0.13)] rounded-full absolute"
            style={{
              right: -80,
              top: -20
            }}
          />
          <Image
            source={require("@/assets/images/customer_wallet_card.png")}
            className="w-98 h-98 bottom-0 right-0 absolute"
            resizeMode="contain"
          />
          <View className="pl-4">
            <Text className="text-black font-semibold mt-4">
              Your Current RCN Balance
            </Text>
            <Text className="text-black text-4xl font-extrabold mt-2">
              1000 RCN <Entypo name="eye-with-line" color="#000" size={30} />
            </Text>
            <View
              className="w-32 h-9 mt-4 rounded-full overflow-hidden"
              style={{
                shadowColor: "black",
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.25,
                shadowRadius: 10,
                elevation: 12,
              }}
            >
              <LinearGradient
                colors={["#FFCC00", "#FFEC9F"]}
                start={{ x: 0, y: 1 }}
                end={{ x: 1, y: 1 }}
                className="w-full h-full items-center justify-center"
              >
                <View className="items-center justify-center flex-row">
                  <SimpleLineIcons name="badge" color="#000" size={15} />
                  <Text className="text-black font-semibold ml-2">
                    Gold Tier
                  </Text>
                </View>
              </LinearGradient>
            </View>
          </View>
        </View>
      </View>
      <View className="flex-row justify-between mt-6 px-8">
        <View className="items-center">
          <Pressable
            onPress={() => setTokenSummaryModalVisible(true)}
            className="w-16 h-16 rounded-full bg-[#1A1A1C] justify-center items-center"
          >
            <MaterialIcons name="summarize" color="#fff" size={24} />
          </Pressable>
          <Text className="text-white text-lg font-semibold mt-2">Summary</Text>
        </View>
        <View className="items-center">
          <Pressable
            onPress={() => setTierModalVisible(true)}
            className="w-16 h-16 rounded-full bg-[#1A1A1C] justify-center items-center"
          >
            <MaterialIcons name="info" color="#fff" size={24} />
          </Pressable>
          <Text className="text-white text-lg font-semibold mt-2">
            Tier Benefits
          </Text>
        </View>
        <View className="items-center">
          <Pressable
            onPress={() =>
              router.push("/dashboard/customer/TransactionHistory")
            }
            className="w-16 h-16 rounded-full bg-[#1A1A1C] justify-center items-center"
          >
            <Octicons name="history" color="#fff" size={24} />
          </Pressable>
          <Text className="text-white text-lg font-semibold mt-2">History</Text>
        </View>
      </View>
      <View className="mt-5 gap-4">
        <DetailCard />
        <DetailCard />
        <DetailCard />
      </View>
      <TierBenefitsModal
        visible={tierModalVisible}
        requestClose={() => setTierModalVisible(false)}
      />
      <TokenSummaryModal
        visible={tokenSummaryModalVisible}
        requestClose={() => setTokenSummaryModalVisible(false)}
      />
    </View>
  );
}
