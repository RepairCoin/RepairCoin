import React, { useState } from "react";
import { View, Text, Pressable, ImageBackground } from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";

export default function CustomFooter() {
  const [active, setActive] = useState("Home");

  return (
    <View className="flex flex-row justify-center items-center h-full w-full">
      <View className="flex-row items-center justify-around">
        {/* Home */}
        <Pressable
          className="items-center flex-1 z-10"
          onPress={() => {
            setActive("Home");
            active !== "Home" && router.push("/customer/tabs/home");
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
            setActive("Transaction");
            active !== "Transaction" &&
              router.push("/customer/tabs/transaction");
          }}
        >
          <Ionicons
            name="cash-outline"
            size={25}
            color={active === "Transaction" ? "#FFD600" : "#888"}
          />
          <Text
            className={`text-xs mt-1 ${
              active === "Transaction"
                ? "text-yellow-400 font-semibold"
                : "text-gray-400"
            }`}
          >
            Transaction
          </Text>
        </Pressable>

        {/* History */}
        <Pressable
          className="items-center flex-1 z-10"
          onPress={() => {
            setActive("Shop");
            active !== "Shop" && router.push("/customer/tabs/find-shop");
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

        {/* Account */}
        <Pressable
          className="items-center flex-1 z-10"
          onPress={() => {
            setActive("Account");
            active !== "Account" && router.push("/customer/tabs/account");
          }}
        >
          <Ionicons
            name="person-outline"
            size={25}
            color={active === "Account" ? "#FFD600" : "#888"}
          />
          <Text
            className={`text-xs mt-1 ${
              active === "Account"
                ? "text-yellow-400 font-semibold"
                : "text-gray-400"
            }`}
          >
            Account
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
