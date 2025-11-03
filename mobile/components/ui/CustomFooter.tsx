import React, { useState } from "react";
import { View, Text, Pressable, ImageBackground } from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";

export default function CustomFooter() {
  const [active, setActive] = useState("Home");

  return (
    <View
      className="flex flex-row justify-center items-center h-full w-full"
    >
      <View className="flex-row items-center justify-around">
        {/* Home */}
        <Pressable
          className="items-center flex-1 z-10"
          onPress={() => {
            setActive("Home");
            active !== "Home" && router.push("/customer/home");
          }}
        >
          <Ionicons
            name="home-outline"
            size={25}
            color={active === "Home" ? "#FFD600" : "#888"}
          />
          <Text
            className={`text-xs mt-1 ${
              active === "Home"
                ? "text-yellow-400 font-semibold"
                : "text-gray-400"
            }`}
          >
            Home
          </Text>
        </Pressable>

        {/* Inbox */}
        <Pressable
          className="items-center flex-1 z-10"
          onPress={() => {
            setActive("Notification");
            active !== "Notification" &&
              router.push("/customer/notification");
          }}
        >
          <Ionicons
            name="notifications"
            size={25}
            color={active === "Notification" ? "#FFD600" : "#888"}
          />
          <Text
            className={`text-xs mt-1 ${
              active === "Notification"
                ? "text-yellow-400 font-semibold"
                : "text-gray-400"
            }`}
          >
            Notification
          </Text>
        </Pressable>

        {/* History */}
        <Pressable
          className="items-center flex-1 z-10"
          onPress={() => {
            setActive("Shop");
            active !== "Shop" &&
              router.push("/showShop/Onboarding");
          }}
        >
          <Ionicons
            name="location-outline"
            size={25}
            color={active === "Shop" ? "#FFD600" : "#888"}
          />
          <Text
            className={`text-xs mt-1 ${
              active === "Shop"
                ? "text-yellow-400 font-semibold"
                : "text-gray-400"
            }`}
          >
            Find Shop
          </Text>
        </Pressable>

        {/* Profile */}
        <Pressable
          className="items-center flex-1 z-10"
          onPress={() => {
            setActive("Profile");
            active !== "Profile" &&
              router.push("/customer/profile");
          }}
        >
          <Ionicons
            name="person-outline"
            size={25}
            color={active === "Profile" ? "#FFD600" : "#888"}
          />
          <Text
            className={`text-xs mt-1 ${
              active === "Profile"
                ? "text-yellow-400 font-semibold"
                : "text-gray-400"
            }`}
          >
            Profile
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
