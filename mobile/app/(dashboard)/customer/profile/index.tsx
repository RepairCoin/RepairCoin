import { Pressable, ScrollView, Text, View, Switch } from "react-native";
import {
  AntDesign,
  Entypo,
  Feather,
  MaterialIcons,
  SimpleLineIcons,
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
}: CopyableFieldProps) => (
  <Pressable
    onPress={handleCopyValue}
    className={`p-4 ${
      isCopied ? "bg-[#FFCC00] justify-center" : "border-dashed justify-between"
    } border-2 border-[#FFCC00] flex-row  rounded-xl`}
  >
    {isCopied ? (
      <Text className="text-xl text-white font-semibold">
        <Entypo name="check" color="#fff" size={18} />
        {"  "}Code copied to clipboard
      </Text>
    ) : (
      <React.Fragment>
        <Text className="text-xl text-[#FFCC00] font-semibold">{value}</Text>
        <Text className="text-lg text-[#ffcc00a2] font-semibold">
          Tap to copy
        </Text>
      </React.Fragment>
    )}
  </Pressable>
);

export default function MyProfile() {
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isNotificationEnabled, setIsNotificationEnabled] =
    useState<boolean>(false);
  const { logout } = useAuthStore((state) => state);

  const handleCopyValue = async (value: string) => {
    await Clipboard.setStringAsync(value);
    setIsCopied(true);
  };

  useEffect(() => {
    if (isCopied) {
      const timer = setTimeout(() => {
        setIsCopied(false);
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [isCopied]);

  const toggleNotification = () => {
    setIsNotificationEnabled(!isNotificationEnabled);
  };

  const handleLogout = async () => {
    // Logout will clear auth state, disconnect wallet, clear storage, and navigate to onboarding
    await logout();
  }

  return (
    <View className="w-full h-full bg-zinc-950 px-4 pt-24">
      <ScrollView>
        <View className="flex-row py-6 px-4 justify-between bg-[#212121] rounded-xl items-center">
          <View className="gap-2">
            <Text className="text-[#FFCC00] text-3xl font-bold">John Doe</Text>
            <Text className="text-white/50 text-lg">johndoe@gmail.com</Text>
          </View>
          <Pressable
            onPress={() => router.push("/EditProfile")}
            className="bg-white p-2 max-h-12 w-28 rounded-lg flex-row justify-center items-center"
          >
            <Feather name="edit" color="#000" size={16} />
            <Text className="text-black ml-2 text-lg">Edit</Text>
          </Pressable>
        </View>
        <View className="py-6 px-4 bg-[#212121] rounded-xl gap-4 mt-4">
          <View className="flex-row justify-between items-center">
            <Text className="text-white/50 text-2xl">Wallet Address</Text>
            <Pressable className="w-10 h-10 rounded-full bg-yellow-400 justify-center items-center">
              <MaterialIcons name="qr-code-scanner" size={20} color="black" />
            </Pressable>
          </View>
          <CopyableField
            value="0xab....057912345"
            handleCopyValue={() => handleCopyValue("0xab....057912345")}
            isCopied={isCopied}
          />
        </View>
        <View className="py-6 px-4 bg-[#212121] rounded-xl gap-4 mt-4">
          <Text className="text-white/50 text-2xl">General</Text>
          <View className="flex-row justify-between items-center">
            <Pressable
              onPress={() => router.push("/ChangePrivateKey")}
              className="flex-row items-center"
            >
              <View className="rounded-full bg-white w-16 h-16 items-center justify-center">
                <SimpleLineIcons name="lock" color="#000" size={24} />
              </View>
              <View className="px-4 gap-2">
                <Text className="text-white text-xl font-semibold">
                  Change password
                </Text>
                <Text className="text-white/50 text-sm">
                  Customize your notifications preferences
                </Text>
              </View>
            </Pressable>
            <AntDesign name="right" color="#fff" size={24} />
          </View>
        </View>
        <View className="py-6 px-4 bg-[#212121] rounded-xl gap-4 mt-4">
          <Text className="text-white/50 text-2xl">Preferences</Text>
          <View className="flex-row justify-between items-center">
            <View className="flex-row items-center">
              <View className="rounded-full bg-white w-16 h-16 items-center justify-center">
                <SimpleLineIcons name="bell" color="#000" size={24} />
              </View>
              <View className="px-4 gap-2">
                <Text className="text-white text-xl font-semibold">
                  Notifications
                </Text>
                <Text className="text-white/50 text-sm">
                  Customize your notifications preferences
                </Text>
              </View>
            </View>
            <Switch
              trackColor={{ false: "#767577", true: "#81b0ff" }}
              thumbColor={isNotificationEnabled ? "#f5dd4b" : "#f4f3f4"}
              ios_backgroundColor="#3e3e3e"
              onValueChange={toggleNotification}
              value={isNotificationEnabled}
            />
          </View>
          <View className="flex-row justify-between items-center mt-4">
            <View className="flex-row items-center">
              <View className="rounded-full bg-white w-16 h-16 items-center justify-center">
                <SimpleLineIcons name="info" color="#000" size={24} />
              </View>
              <View className="px-4 gap-2">
                <Text className="text-white text-xl font-semibold">FAQ</Text>
                <Text className="text-white/50 text-sm">
                  Securely add payment method
                </Text>
              </View>
            </View>
            <AntDesign name="right" color="#fff" size={24} />
          </View>
          <Pressable onPress={handleLogout} className="flex-row justify-between items-center mt-4">
            <View className="flex-row items-center">
              <View className="rounded-full bg-[#FBCDCD] w-16 h-16 items-center justify-center">
                <MaterialIcons name="logout" color="#E74C4C" size={24} />
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
            <AntDesign name="right" color="#fff" size={24} />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
