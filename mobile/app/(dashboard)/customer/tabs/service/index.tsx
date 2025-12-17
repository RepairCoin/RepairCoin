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
import FavoritesTab from "./tabs/favorites";

type ServiceTab = "Services" | "Favorites" | "Bookings";
const serviceTabs: ServiceTab[] = ["Services", "Favorites", "Bookings"];

export default function Service() {
  const [activeTab, setActiveTab] = useState<ServiceTab>("Services");

  const getTabStyle = (tab: ServiceTab, index: number) => {
    const isActive = activeTab === tab;
    let roundedClass = "";
    if (index === 0) roundedClass = "rounded-l-xl";
    else if (index === serviceTabs.length - 1) roundedClass = "rounded-r-xl";

    return `flex-1 items-center justify-center ${
      isActive ? "bg-[#FFCC00]" : "bg-[#121212]"
    } ${roundedClass}`;
  };

  return (
    <ThemedView className="w-full h-full">
      <View className="pt-20 px-4 gap-4 flex-1">
        <View className="flex-row w-full h-10 bg-[#121212] rounded-xl">
          {serviceTabs.map((tab, i) => (
            <Pressable
              key={i}
              onPress={() => setActiveTab(tab)}
              className={getTabStyle(tab, i)}
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
        {activeTab === "Favorites" && <FavoritesTab />}
        {activeTab === "Bookings" && <BookingsTab />}
      </View>
    </ThemedView>
  );
}
