import { AntDesign, Feather } from "@expo/vector-icons";
import { goBack } from "expo-router/build/global-state/routing";
import { View, Text, Pressable } from "react-native";
import Screen from "@/components/ui/Screen";
import { useState } from "react";
import ShareQRCodeModal from "@/components/customer/ShareQRCodeModal";
import QRCode from "react-native-qrcode-svg";
import { useAuthStore } from "@/store/auth.store";
import * as Clipboard from "expo-clipboard";

export default function QRCodeScreen() {
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const { account, userProfile } = useAuthStore();
  const walletAddress = account?.address || userProfile?.address || "";

  const copyToClipboard = async () => {
    if (walletAddress) {
      await Clipboard.setStringAsync(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatAddress = (address: string) => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <View className="w-full h-full px-4 bg-white">
      <View className="h-20" />
      <View className="mx-2 flex-row justify-between items-center">
        <AntDesign name="left" color="black" size={25} onPress={goBack} />
        <Text className="text-black text-[22px] font-extrabold">QR Code</Text>
        <View className="w-[25px]" />
      </View>

      <View className="mt-16 items-center">
        {walletAddress ? (
          <QRCode
            value={walletAddress}
            size={250}
            backgroundColor="white"
            color="#FFCC00"
          />
        ) : (
          <View className="w-[250px] h-[250px] bg-gray-100 rounded-lg items-center justify-center">
            <Text className="text-gray-400">No wallet connected</Text>
          </View>
        )}
      </View>

      <Text className="text-black text-3xl text-center font-extrabold mt-12">
        Your QR Code
      </Text>
      <Text className="text-black text-lg text-center mt-4">
        This QR Code belongs to your personal profile, and can be scanned by
        people and shops.
      </Text>

      {walletAddress && (
        <Pressable 
          onPress={copyToClipboard}
          className="mt-6 bg-gray-100 rounded-lg px-4 py-3 flex-row items-center justify-center"
        >
          <Text className="text-gray-700 font-medium mr-2">
            {formatAddress(walletAddress)}
          </Text>
          <Feather 
            name={copied ? "check" : "copy"} 
            size={18} 
            color={copied ? "#10b981" : "#6b7280"}
          />
        </Pressable>
      )}

      {/* <View className="mx-2 mt-auto mb-20">
        <PrimaryButton
          title="Share QR Code"
          onPress={() => setModalVisible(true)}
        />
      </View> */}

      <ShareQRCodeModal
        visible={modalVisible}
        requestClose={() => setModalVisible(false)}
        walletAddress={walletAddress}
      />
    </View>
  );
}
