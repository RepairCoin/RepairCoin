import {
  Pressable,
  ScrollView,
  Text,
  View,
  ActivityIndicator,
} from "react-native";
import { AntDesign, Entypo, Feather, MaterialIcons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useAuthStore } from "@/store/auth.store";
import { useCustomer } from "@/hooks/customer/useCustomer";
import { useAuth } from "@/hooks/auth/useAuth";

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
  const { account } = useAuthStore();
  const { useGetCustomerByWalletAddress } = useCustomer();
  const { useLogout } = useAuth();
  const { logout, isLoggingOut } = useLogout();

  // Use the token balance hook
  const { data: customerData } = useGetCustomerByWalletAddress(
    account?.address
  );

  const [isCopied, setIsCopied] = useState<boolean>(false);

  const handleLogout = async () => {
    await logout();
  };

  const handleReferFriends = () => {
    // TODO: Implement refer friends functionality
    router.push("/customer/referral")
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
              {customerData?.customer?.name || "User"}
            </Text>
            <Text className="text-white/50 text-base">
              {customerData?.customer?.email || "No email"}
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
        <View className="p-4 bg-[#212121] rounded-xl mt-4">
          <Pressable
            onPress={handleReferFriends}
            className="flex-row justify-between items-center"
          >
            <View className="flex-row items-center">
              <MaterialIcons name="group" size={18} color="#FFCC00" />
              <View className="px-4 gap-2">
                <Text className="text-white text-lg font-semibold">
                  Refer your friends
                </Text>
              </View>
            </View>
            <AntDesign name="right" color="#fff" size={18} />
          </Pressable>
        </View>
        <View className="p-4 bg-[#212121] rounded-xl mt-4">
          <Pressable
            onPress={handleLogout}
            disabled={isLoggingOut}
            className={`flex-row justify-between items-center ${isLoggingOut ? "opacity-50" : ""}`}
          >
            <View className="flex-row items-center">
              {isLoggingOut ? (
                <ActivityIndicator size="small" color="#E74C4C" />
              ) : (
                <MaterialIcons name="logout" color="#E74C4C" size={18} />
              )}
              <View className="px-4 gap-2">
                <Text className="text-white text-lg font-semibold">
                  {isLoggingOut ? "Logging Out..." : "Log Out"}
                </Text>
              </View>
            </View>
            {!isLoggingOut && <AntDesign name="right" color="#fff" size={18} />}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
