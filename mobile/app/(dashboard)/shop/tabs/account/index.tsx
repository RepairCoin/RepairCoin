import { Pressable, ScrollView, Text, View } from "react-native";
import {
  AntDesign,
  Entypo,
  Feather,
  MaterialIcons,
} from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useAuthStore } from "@/store/authStore";

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
  const { logout } = useAuthStore((state) => state);
  const { account } = useAuthStore();

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
    <View className="w-full h-full bg-zinc-950 px-4 pt-24">
      <ScrollView>
        <View className="flex-row py-6 px-4 justify-between bg-[#212121] rounded-xl items-center">
          <View className="gap-2">
            <Text className="text-[#FFCC00] text-xl font-bold">
              {"User"}
            </Text>
            <Text className="text-white/50 text-base">
              {"No email"}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push("/customer/profile")}
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
            handleCopyValue={() =>
              handleCopyValue(account?.address || "")
            }
            isCopied={isCopied}
          />
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
    </View>
  );
}
