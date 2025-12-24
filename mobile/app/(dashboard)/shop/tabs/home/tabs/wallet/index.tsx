import React from "react";
import {
  View,
  Text,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from "react-native";
import { MaterialCommunityIcons, MaterialIcons, Octicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/store/auth.store";
import DetailCard from "@/components/ui/DetailCard";
import ActionCard from "@/components/shared/ActionCard";
import { ShopData } from "@/interfaces/shop.interface";

export default function WalletTab({ shopData }: { shopData: ShopData }) {
  const router = useRouter();
  const { account } = useAuthStore();

  // Early return for missing data
  if (!account) {
    return (
      <View className="flex-1 justify-center items-center mt-20">
        <Text className="text-white text-lg">No wallet connected</Text>
      </View>
    );
  }

  // if (error) {
  //   return (
  //     <View className="flex-1 justify-center items-center mt-20">
  //       <Text className="text-red-500 text-lg">Failed to load balance</Text>
  //       <Pressable
  //         onPress={() => refetch()}
  //         className="mt-4 px-6 py-3 bg-[#FFCC00] rounded-lg"
  //       >
  //         <Text className="text-black font-semibold">Retry</Text>
  //       </Pressable>
  //     </View>
  //   );
  // }

  return (
    <View className="mt-4 flex-1">
      <ScrollView
        className="flex-1 mt-5"
        showsVerticalScrollIndicator={true}
        showsHorizontalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => {}}
            colors={["#FFCC00"]}
            tintColor="#FFCC00"
            progressBackgroundColor="#1A1A1C"
          />
        }
        contentContainerStyle={{
          paddingBottom: 20,
          gap: 16,
        }}
        scrollEventThrottle={16}
        bounces={true}
      >
        {/* Balance Card with Quick Actions */}
        <ActionCard
          balance={shopData?.purchasedRcnBalance}
          isLoading={false}
          quickActions={[
            {
              icon: <MaterialIcons name="add-shopping-cart" size={24} color="#000" />,
              label: "Buy",
              onPress: () => router.push("/shop/buy-token"),
            },
            {
              icon: <MaterialIcons name="card-giftcard" size={24} color="#000" />,
              label: "Reward",
              onPress: () => router.push("/shop/reward-token"),
            },
            {
              icon: <Octicons name="history" size={24} color="#000" />,
              label: "Redeem",
              onPress: () => router.push("/shop/redeem-token"),
            },
          ]}
        />

        {/* Detail Cards - Scrollable Section */}

        <DetailCard
          icon={
            <MaterialCommunityIcons name="screwdriver" color="#000" size={16} />
          }
          title="Total Purchased"
          label="Total RCN tokens you've purchased"
          badge={
            false ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <Text className="text-3xl font-semibold">
                  {shopData?.totalRcnPurchased}
                </Text>{" "}
              </>
            )
          }
        />
        <DetailCard
          icon={
            <MaterialCommunityIcons name="screwdriver" color="#000" size={16} />
          }
          title="Tokens Issued"
          label="Total RCN tokens issued to customers"
          badge={
            false ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <Text className="text-3xl font-semibold">
                  {shopData?.totalTokensIssued}
                </Text>{" "}
              </>
            )
          }
        />
        <DetailCard
          icon={
            <MaterialCommunityIcons name="screwdriver" color="#000" size={16} />
          }
          title="RCG Balance"
          label="RCG tokens in your wallet"
          badge={
            false ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <Text className="text-3xl font-semibold">2</Text>{" "}
              </>
            )
          }
        />
      </ScrollView>
    </View>
  );
}
