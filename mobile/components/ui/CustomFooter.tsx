import React, { useState, useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons, MaterialIcons, FontAwesome5 } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { useAuthStore } from "@/store/authStore";

interface TabItem {
  id: string;
  label: string;
  icon: (isActive: boolean) => React.ReactNode;
  route: string;
}

export default function CustomFooter() {
  const pathname = usePathname();
  const { userType } = useAuthStore();
  const [active, setActive] = useState("Home");

  // Define tabs based on user role
  const getTabsForRole = (): TabItem[] => {
    if (userType === "shop") {
      return [
        {
          id: "Home",
          label: "Home",
          icon: (isActive: boolean) => (
            <Ionicons
              name="home-outline"
              size={25}
              color={isActive ? "#FFD600" : "#888"}
            />
          ),
          route: "/shop/tabs/home",
        },
        {
          id: "Account",
          label: "Account",
          icon: (isActive: boolean) => (
            <Ionicons
              name="person-outline"
              size={25}
              color={isActive ? "#FFD600" : "#888"}
            />
          ),
          route: "/shop/tabs/account",
        },
      ];
    }

    // Default customer tabs
    return [
      {
        id: "Home",
        label: "Home",
        icon: (isActive: boolean) => (
          <Ionicons
            name="home-outline"
            size={25}
            color={isActive ? "#FFD600" : "#888"}
          />
        ),
        route: "/customer/tabs/home",
      },
      {
        id: "Transaction",
        label: "History",
        icon: (isActive: boolean) => (
          <Ionicons
            name="cash-outline"
            size={25}
            color={isActive ? "#FFD600" : "#888"}
          />
        ),
        route: "/customer/tabs/transaction",
      },
      {
        id: "Shop",
        label: "Find Shop",
        icon: (isActive: boolean) => (
          <Ionicons
            name="location-outline"
            size={25}
            color={isActive ? "#FFD600" : "#888"}
          />
        ),
        route: "/customer/tabs/find-shop",
      },
      {
        id: "Account",
        label: "Account",
        icon: (isActive: boolean) => (
          <Ionicons
            name="person-outline"
            size={25}
            color={isActive ? "#FFD600" : "#888"}
          />
        ),
        route: "/customer/tabs/account",
      },
    ];
  };

  const tabs = getTabsForRole();

  // Update active tab based on current route
  useEffect(() => {
    const currentTab = tabs.find((tab) => pathname.includes(tab.route));
    if (currentTab) {
      setActive(currentTab.id);
    }
  }, [pathname, userType]);

  const handleTabPress = (tab: TabItem) => {
    if (active !== tab.id) {
      setActive(tab.id);
      router.push(tab.route as any);
    }
  };

  return (
    <View className="flex flex-row justify-center items-center h-full w-full">
      <View className="flex-row items-center justify-around w-full px-4">
        {tabs.map((tab) => (
          <Pressable
            key={tab.id}
            className="items-center flex-1 z-10"
            onPress={() => handleTabPress(tab)}
          >
            {tab.icon(active === tab.id)}
            <Text
              className={`text-xs mt-1 ${
                active === tab.id
                  ? "text-yellow-400 font-semibold"
                  : "text-gray-400"
              }`}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
