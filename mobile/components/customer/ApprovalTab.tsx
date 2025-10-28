import {
  View,
  Text,
  Pressable,
  Image,
  TextInput,
  ScrollView,
} from "react-native";
import React from "react";
import { router } from "expo-router";

const RequestCard = () => (
  <View className="bg-[#202325] py-4 px-8 rounded-xl mt-4">
    <View className="flex-row justify-between">
      <Text className="text-xl text-white font-extrabold">Jenny Wilson</Text>
      <Text className="text-xl text-white font-extrabold">10 RCN</Text>
    </View>
    <View className="flex-row justify-between mt-2">
      <Text className="text-white/50">Mike Repair Shop</Text>
      <Text className="text-white/50">3:02 PM • July 22, 2025</Text>
    </View>
    <View className="flex-row justify-between mt-4 mb-2">
      <Pressable className="bg-[#DDF6E2] py-1 w-40 items-center rounded-lg">
        <Text className="text-[#1A9D5B]">Accept</Text>
      </Pressable>
      <Pressable className="bg-[#F6C8C8] py-1 w-40 items-center rounded-lg">
        <Text className="text-[#E34C4C]">Reject</Text>
      </Pressable>
    </View>
  </View>
);

export default function ApprovalTab() {
  return (
    <ScrollView className="h-full w-full mt-4">
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
          <View className="pl-4 mt-2">
            <Pressable
              onPress={() => router.push("/dashboard/QRCode")}
              className="bg-black w-36 rounded-xl py-2 mt-4 justify-center items-center"
            >
              <Text className="text-[#FFCC00] font-bold text-sm">
                Generate QR Code
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
      <View className="bg-[#FFCC00] p-4 rounded-t-xl mt-4 flex-row justify-between items-center">
        <Text className="text-black text-lg font-extrabold">
          Redemption Requests
        </Text>
        <Pressable
          onPress={() => router.push("/dashboard/customer/RedemptionHistory")}
        >
          <Text className="text-black font-semibold">See All</Text>
        </Pressable>
      </View>
      <RequestCard />
      <RequestCard />
      <RequestCard />
    </ScrollView>
  );
}
