import React, { useState } from "react";
import { View, Text, Pressable, ImageBackground } from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

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
          onPress={() => setActive("Home")}
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
          onPress={() => setActive("Inbox")}
        >
          <Ionicons
            name="mail-outline"
            size={30}
            color={active === "Inbox" ? "#FFD600" : "#888"}
          />
          <Text
            className={`text-xs mt-1 ${
              active === "Inbox"
                ? "text-yellow-400 font-semibold"
                : "text-gray-400"
            }`}
          >
            Inbox
          </Text>
        </Pressable>

        {/* Center QR Button */}
        <View className="-mt-12 items-center justify-center relative">
          <View className="absolute items-center justify-center">
            <Svg height={260} width={260}>
              <Defs>
                <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor="yellow" stopOpacity={0.2} />
                  <Stop offset="25%" stopColor="yellow" stopOpacity={0.12} />
                  <Stop offset="45%" stopColor="yellow" stopOpacity={0.08} />
                  <Stop offset="65%" stopColor="yellow" stopOpacity={0.05} />
                  <Stop offset="80%" stopColor="yellow" stopOpacity={0.03} />
                  <Stop offset="90%" stopColor="yellow" stopOpacity={0.015} />
                  <Stop offset="100%" stopColor="yellow" stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Rect x="0" y="0" width="260" height="260" fill="url(#glow)" />
            </Svg>
          </View>
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
          onPress={() => setActive("History")}
        >
          <Ionicons
            name="time-outline"
            size={30}
            color={active === "History" ? "#FFD600" : "#888"}
          />
          <Text
            className={`text-xs mt-1 ${
              active === "History"
                ? "text-yellow-400 font-semibold"
                : "text-gray-400"
            }`}
          >
            History
          </Text>
        </Pressable>

        {/* Profile */}
        <Pressable
          className="items-center flex-1 z-10"
          onPress={() => setActive("Profile")}
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
