import { View, Text, Pressable, Image } from "react-native";
import {
  Entypo,
  MaterialCommunityIcons,
  MaterialIcons,
  Octicons,
  SimpleLineIcons,
} from "@expo/vector-icons";
import DetailCard from "@/components/DetailCard";
import TierBenefitsModal from "./TierBenefitsModal";
import { useEffect, useState } from "react";
import TokenSummaryModal from "./TokenSummaryModal";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthStore } from "@/store/authStore";
import { useCustomerStore } from "@/store/customerStore";
import { Tier } from "@/utilities/GlobalTypes";

const TIERS: Record<Tier, { color: [string, string]; label: string; intro: string; }> = {
  GOLD: {
    color: ["#FFCC00", "#FFEC9F"],
    label: "Gold",
    intro: "You are currently at Gold Tier"
  },
  SILVER: {
    color: ["#ABABAB", "#FFFFFF"],
    label: "Silver",
    intro: "You need to 1000 RCN to get to Gold Tier"
  },
  BRONZE: {
    color: ["#95602B", "#FFFFFF"],
    label: "Bronze",
    intro: "You need to 200 RCN to get to Silver Tier"
  }
}

export default function WalletTab() {
  const { userProfile } = useAuthStore((state) => state);
  const { fetchRCNBalance, RCNBalance, customerData } = useCustomerStore((state) => state);
  const [tierModalVisible, setTierModalVisible] = useState<boolean>(false);
  const [tokenSummaryModalVisible, setTokenSummaryModalVisible] =
    useState<boolean>(false);

  useEffect(() => {
    if (!userProfile) return;
    
    const loadData = async () => {
      try {
        await fetchRCNBalance(userProfile.address);
        console.log(RCNBalance);
      } catch (error) {
        console.error("Failed to fetch customer data:", error);
      }
    };

    loadData();
  }, []);
  
  return (
    <View className="mt-4">
      <View className="h-40">
        <View className="w-full h-full bg-[#FFCC00] rounded-3xl flex-row overflow-hidden relative">
          <View
            className="w-[300px] h-[300px] border-[48px] border-[rgba(102,83,7,0.13)] rounded-full absolute"
            style={{
              right: -80,
              top: -20,
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
              {RCNBalance?.totalBalance} RCN <Entypo name="eye-with-line" color="#000" size={30} />
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
                colors={TIERS[customerData.customer.tier as Tier].color}
                start={{ x: 0, y: 1 }}
                end={{ x: 1, y: 1 }}
                className="w-full h-full items-center justify-center"
              >
                <View className="items-center justify-center flex-row">
                  <SimpleLineIcons name="badge" color="#000" size={15} />
                  <Text className="text-black font-semibold ml-2">
                    {TIERS[customerData.customer.tier as Tier].label} Tier
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
        <DetailCard
          icon={
            <MaterialCommunityIcons
              name="hand-coin-outline"
              color="#000"
              size={16}
            />
          }
          title="RCN Balance"
          label="This is the total RCN tokens you currently have"
          badge={
            <>
              <Text className="text-5xl font-semibold">{RCNBalance?.totalBalance}</Text> RCN
            </>
          }
        />
        <DetailCard
          icon={<SimpleLineIcons name="badge" color="#000" size={16} />}
          title="Your Tier Level"
          label={TIERS[customerData.customer.tier as Tier].intro}
          badge={TIERS[customerData.customer.tier as Tier].label}
        />
        <DetailCard
          icon={
            <MaterialCommunityIcons name="screwdriver" color="#000" size={16} />
          }
          title="Total Repairs"
          label="This is the total repairs you've availed"
          badge={
            <>
              <Text className="text-5xl font-semibold">{RCNBalance?.earningHistory.fromRepairs}</Text> RCN
            </>
          }
        />
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
