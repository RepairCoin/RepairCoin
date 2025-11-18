import { View, Text, ScrollView } from "react-native";
import { ThemedView } from "@/components/ui/ThemedView";
import {
  Feather,
  Fontisto,
  MaterialCommunityIcons,
  Octicons,
} from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import HorizontalCard from "@/components/ui/HorizontalCard";
import React from "react";

export default function CustomerList() {
  const horizontalCardList: {
    label: string;
    Icon: any;
    number: number;
  }[] = [
    {
      label: "Total Referrals",
      Icon: <Octicons name="people" color="#ffcc00" size={22} />,
      number: 12,
    },
    {
      label: "RCN Earned",
      Icon: (
        <MaterialCommunityIcons
          name="hand-coin-outline"
          color="#ffcc00"
          size={22}
        />
      ),
      number: 12,
    },
    {
      label: "Pending\nReferrals",
      Icon: <Fontisto name="clock" color="#ffcc00" size={22} />,
      number: 12,
    },
    {
      label: "Successful\nReferrals",
      Icon: <Feather name="user-check" color="#ffcc00" size={22} />,
      number: 12,
    },
  ];

  return (
    <ThemedView className="w-full h-full">
      <ScrollView className="mb-[144px]">
        <View className="flex-row flex-wrap my-4 -mx-2">
          {horizontalCardList.map((props, i) => (
            <View key={i} style={{ width: "50%" }}>
              <HorizontalCard {...props} />
            </View>
          ))}
        </View>
      </ScrollView>
    </ThemedView>
  );
}
