import {
  Text,
  View,
  Pressable,
} from "react-native";
import { ThemedView } from "@/components/ui/ThemedView";
import { useState } from "react";
import React from "react";
import ServicesTab from "./tabs/services";
import BookingsTab from "./tabs/bookings";

type ServiceTab = "Services" | "Booking";
const serviceTabs: ServiceTab[] = ["Services", "Booking"];

export default function Service() {
  const [activeTab, setActiveTab] = useState<ServiceTab>("Services");

  return (
    <ThemedView className="w-full h-full">
      <View className="pt-20 px-4 gap-4 flex-1">
        <View className="flex-row w-full h-10 bg-[#121212] rounded-xl">
          {serviceTabs.map((tab, i) => (
            <Pressable
              key={i}
              onPress={() => setActiveTab(tab)}
              className={`flex-1 items-center justify-center ${
                activeTab === tab ? "bg-[#FFCC00]" : "bg-[#121212]"
              } ${i === 0 ? "rounded-l-xl" : "rounded-r-xl"}`}
            >
              <Text
                className={`text-base font-bold ${
                  activeTab === tab ? "text-black" : "text-gray-400"
                }`}
              >
                {tab}
              </Text>
            </Pressable>
          ))}
        </View>
        {activeTab === "Services" && <ServicesTab />}
        {activeTab === "Booking" && <BookingsTab />}
      </View>
    </ThemedView>
  );
}
