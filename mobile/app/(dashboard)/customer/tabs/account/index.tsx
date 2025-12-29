import {
  Pressable,
  ScrollView,
  Text,
  View,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import {
  AntDesign,
  Entypo,
  Feather,
  Ionicons,
  MaterialIcons,
} from "@expo/vector-icons";
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
    router.push("/customer/referral");
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
    <View className="w-full h-full bg-zinc-950">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-16 pb-4">
        <Text className="text-white text-xl font-semibold">Profile</Text>
        <TouchableOpacity
          onPress={() => router.push("/customer/settings")}
          className="p-2"
        >
          <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView className="px-4" showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View className="rounded-2xl flex-row items-center">
          <View className="w-16 h-16 rounded-full bg-[#FFCC00]/20 items-center justify-center">
            <Ionicons name="person" size={32} color="#FFCC00" />
          </View>
          <View className="flex-1 ml-4">
            <Text className="text-white text-lg font-bold">
              {customerData?.customer?.name || "User"}
            </Text>
            <Text className="text-gray-500 text-sm mt-0.5">
              {customerData?.customer?.email || "No email"}
            </Text>
            <View className="flex-row items-center mt-1">
              <View className="bg-[#FFCC00]/20 px-2 py-0.5 rounded-full">
                <Text className="text-[#FFCC00] text-xs font-medium capitalize">
                  {customerData?.customer?.tier || "Bronze"} Member
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
