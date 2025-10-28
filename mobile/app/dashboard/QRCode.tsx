import { AntDesign } from "@expo/vector-icons";
import { goBack } from "expo-router/build/global-state/routing";
import { View, Text, Image, Pressable } from "react-native";
import { useState } from "react";
import PrimaryButton from "@/components/ui/PrimaryButton";
import ShareQRCodeModal from "@/components/customer/ShareQRCodeModal";
import { router } from "expo-router";

export default function QRCode() {
  const [modalVisible, setModalVisible] = useState<boolean>(false);

  return (
    <View className="w-full h-full px-4 bg-white">
      <View className="mx-2 flex-row justify-between items-center">
        <AntDesign name="left" color="black" size={25} onPress={goBack} />
        <Text className="text-black text-[22px] font-extrabold">QR Code</Text>
        <View className="w-[25px]" />
      </View>

      <Image source={require("@/assets/images/qrcode.png")} className="mt-16 border-2" />

      <Text className="text-black text-3xl text-center font-extrabold mt-2">
        Your QR Code
      </Text>
      <Text className="text-black text-lg text-center mt-4">
        This QR Code belongs to your personal profile, and can be scanned by
        people and shops.
      </Text>

      <View className="mx-2 mt-auto mb-20">
        <PrimaryButton
          title="Share QR Code"
          onPress={() => setModalVisible(true)}
        />
      </View>

      <ShareQRCodeModal
        visible={modalVisible}
        requestClose={() => setModalVisible(false)}
      />
    </View>
  );
}
