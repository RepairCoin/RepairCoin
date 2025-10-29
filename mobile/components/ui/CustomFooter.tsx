import React, { useState } from "react";
import { View, Text, Pressable, ImageBackground } from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";

export default function CustomFooter() {
  const [active, setActive] = useState("Home");

  return (
    <ImageBackground
      source={require("@/assets/images/footer_curve.png")}
      className="h-full w-full"
      resizeMode="stretch"
    >
      <View className="flex-row items-center justify-around pt-6 pb-3 mt-7">
        {/* Home */}
        <Pressable
          className="items-center flex-1 z-10"
          onPress={() => {
            setActive("Home");
            active !== "Home" && router.push("/customer");
          }}
        >
          <Ionicons
            name="home-outline"
            size={30}
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
              router.push("/customer/Notification");
          }}
        >
          <Ionicons
            name="notifications"
            size={30}
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

        {/* Center QR Button */}
        <View className="-mt-12 items-center justify-center relative">
          <Pressable
            className="w-20 h-20 rounded-full bg-yellow-400 justify-center items-center"
            onPress={() => setActive("QR")}
          >
            <MaterialIcons name="qr-code-scanner" size={30} color="black" />
          </Pressable>
        </View>

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
            size={30}
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
              router.push("/customer/MyProfile");
          }}
        >
          <Ionicons
            name="person-outline"
            size={30}
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
    </ImageBackground>
  );
}
