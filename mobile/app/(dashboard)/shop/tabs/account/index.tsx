import { Pressable, ScrollView, Text, View, Switch } from "react-native";
import {
  AntDesign,
  Entypo,
  Feather,
  MaterialIcons,
  Ionicons,
} from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useAuthStore } from "@/store/auth.store";
import { useTheme } from "@/hooks/theme/useTheme";
import { ThemedView } from "@/components/ui/ThemedView";
import { useShop } from "@/hooks/shop/useShop";

type CopyableFieldProps = {
  value: string;
  isCopied: boolean;
  handleCopyValue: () => void;
};

const CopyableField = ({
  value,
  isCopied,
  handleCopyValue,
}: CopyableFieldProps) => {
  const displayValue =
    value && value.length > 20 ? `${value.substring(0, 20)}...` : value || "";

  return (
    <Pressable
      onPress={handleCopyValue}
      className={`p-4 ${
        isCopied
          ? "bg-[#FFCC00] justify-center"
          : "border-dashed justify-between"
      } border-2 border-[#FFCC00] flex-row rounded-xl`}
    >
      {isCopied ? (
        <Text className="text-base text-white font-semibold">
          <Entypo name="check" color="#fff" size={18} />
          {"  "}Code copied to clipboard
        </Text>
      ) : (
        <React.Fragment>
          <Text className="text-base text-[#FFCC00] font-semibold">
            {displayValue}
          </Text>
          <Text className="text-base text-[#ffcc00a2] font-semibold">
            Tap to copy
          </Text>
        </React.Fragment>
      )}
    </Pressable>
  );
};

export default function Account() {
  const { useGetShopByWalletAddress } = useShop();
  const { useThemeColor } = useTheme();

  const { logout } = useAuthStore((state) => state);
  const { account } = useAuthStore();
  const { data: shopData } = useGetShopByWalletAddress(account?.address || "");
  const { isLightMode, toggleColorScheme } = useThemeColor();

  const [isCopied, setIsCopied] = useState<boolean>(false);

  const handleCopyValue = async (value: string) => {
    await Clipboard.setStringAsync(value);
    setIsCopied(true);
  };

  const handleLogout = async () => {
    await logout();
  };

  useEffect(() => {
    if (isCopied) {
      const timer = setTimeout(() => {
        setIsCopied(false);
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [isCopied]);

  return (
    <ThemedView className="w-full h-full px-4 pt-24">
      <ScrollView>
        <View className="flex-row py-6 px-4 justify-between bg-[#212121] rounded-xl items-center">
          <View className="gap-2">
            <Text className="text-[#FFCC00] text-xl font-bold">
              {shopData?.name || "No name"}
            </Text>
            <Text className="text-white/50 text-base">
              {shopData?.email || "No email"}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push("/shop/profile/edit-profile")}
            className="bg-white p-2 max-h-12 w-24 rounded-lg flex-row justify-center items-center"
          >
            <Feather name="edit" color="#000" size={14} />
            <Text className="text-black ml-2 text-base">Edit</Text>
          </Pressable>
        </View>
        <View className="py-6 px-4 bg-[#212121] rounded-xl gap-4 mt-4">
          <View className="flex-row justify-between items-center">
            <Text className="text-white/50 text-xl">Wallet Address</Text>
          </View>
          <CopyableField
            value={account?.address || ""}
            handleCopyValue={() => handleCopyValue(account?.address || "")}
            isCopied={isCopied}
          />
        </View>
        <View className="p-4 bg-[#212121] rounded-xl mt-4">
          <View className="flex-row justify-between items-center pb-4 border-b border-zinc-700">
            <View className="flex-row items-center">
              <View className="rounded-full bg-[#2B2B2B] w-12 h-12 items-center justify-center">
                <Ionicons
                  name={isLightMode ? "sunny" : "moon"}
                  color="#FFCC00"
                  size={20}
                />
              </View>
              <View className="px-4 gap-1">
                <Text className="text-white text-xl font-semibold">Theme</Text>
                <Text className="text-white/50 text-sm">
                  {isLightMode ? "Light Mode" : "Dark Mode"}
                </Text>
              </View>
            </View>
            <Switch
              trackColor={{ false: "#767577", true: "#FFCC00" }}
              thumbColor={isLightMode ? "#fff" : "#f4f3f4"}
              ios_backgroundColor="#767577"
              onValueChange={toggleColorScheme}
              value={isLightMode}
            />
          </View>
          <Pressable
            onPress={() => router.push("/shop/subscription")}
            className="flex-row justify-between items-center py-4 border-b border-zinc-700"
          >
            <View className="flex-row items-center">
              <View className="rounded-full bg-[#2B2B2B] w-12 h-12 items-center justify-center">
                <MaterialIcons
                  name="card-membership"
                  color="#FFCC00"
                  size={20}
                />
              </View>
              <View className="px-4 gap-1">
                <Text className="text-white text-xl font-semibold">
                  Subscription
                </Text>
                <Text className="text-white/50 text-sm">
                  Manage your subscription
                </Text>
              </View>
            </View>
            <AntDesign name="right" color="#fff" size={18} />
          </Pressable>
        </View>
        <View className="p-4 bg-[#212121] rounded-xl mt-4">
          <Pressable
            onPress={handleLogout}
            className="flex-row justify-between items-center"
          >
            <View className="flex-row items-center">
              <View className="rounded-full bg-[#FBCDCD] w-12 h-12 items-center justify-center">
                <MaterialIcons name="logout" color="#E74C4C" size={18} />
              </View>
              <View className="px-4 gap-2">
                <Text className="text-white text-xl font-semibold">
                  Log Out
                </Text>
                <Text className="text-white/50 text-sm">
                  Surely log out an account
                </Text>
              </View>
            </View>
            <AntDesign name="right" color="#fff" size={18} />
          </Pressable>
        </View>
      </ScrollView>
    </ThemedView>
  );
}
