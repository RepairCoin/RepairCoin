import { AntDesign, Entypo, Feather, Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { Modal, Pressable, Text, Image, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

type Props = {
  visible: boolean;
  requestClose: () => void;
  walletAddress: string;
};

export default function ShareQRCodeModal({ visible, requestClose, walletAddress }: Props) {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={requestClose}
    >
      <View className="w-full h-full items-center justify-center bg-black/50">
        <View className="w-full py-6 mt-auto bg-white rounded-t-2xl shadow-lg gap-4 relative overflow-hidden items-center">
          {walletAddress ? (
            <QRCode
              value={walletAddress}
              size={200}
              backgroundColor="white"
              color="black"
            />
          ) : (
            <View className="w-[200px] h-[200px] bg-gray-100 rounded-lg items-center justify-center">
              <Text className="text-gray-400">No wallet connected</Text>
            </View>
          )}
          <View className="flex-row w-full justify-between px-16 -mt-10 items-center">
            <Image
              className="h-5 w-5"
              source={require("@/assets/images/repaircoin-logo-mini.png")}
            />
            <Text className="text-[#FFCC00] text-sm font-extrabold">
              RepairCoin
            </Text>
            <View className="h-4 w-0.5 bg-[#FFCC00]" />
            <Text className="text-[#FFCC00] text-sm">
              The Repair Industry's Loyalty Token
            </Text>
          </View>

          <View className="flex-row w-full justify-between px-14 items-center mt-8">
            <View className="h-0.5 w-[30%] bg-black/25" />
            <Ionicons name="eye-off-outline" color="#00000040" size={20} />
            <Text className="text-black/25 text-sm font-bold">
              Hide Tagline
            </Text>
            <View className="h-0.5 w-[30%] bg-black/25" />
          </View>

          <View className="flex-row w-full justify-between px-14 items-center mt-4">
            <View className="flex-1 items-center">
              <Image
                className="h-14 w-14"
                source={require("@/assets/icons/iMessage.png")}
                resizeMode="contain"
              />
              <Text className="text-black/25 text-sm mt-2">iMessage</Text>
            </View>
            <View className="flex-1 items-center">
              <Image
                className="h-14 w-14"
                source={require("@/assets/icons/instagram.png")}
                resizeMode="contain"
              />
              <Text className="text-black/25 text-sm mt-2">Instagram</Text>
            </View>
            <View className="flex-1 items-center">
              <Image
                className="h-14 w-14"
                source={require("@/assets/icons/photos.png")}
                resizeMode="contain"
              />
              <Text className="text-black/25 text-sm mt-2">Photos</Text>
            </View>
            <View className="flex-1 items-center">
              <Image
                className="h-14 w-14"
                source={require("@/assets/icons/messenger.png")}
                resizeMode="contain"
              />
              <Text className="text-black/25 text-sm mt-2">Messenger</Text>
            </View>
            <View className="flex-1 items-center">
              <Image
                className="h-14 w-14"
                source={require("@/assets/icons/more.png")}
                resizeMode="contain"
              />
              <Text className="text-black/25 text-sm mt-2">More</Text>
            </View>
          </View>

          <View className="bg-black/25 w-full h-0.5 mt-8" />

          <Pressable onPress={requestClose} className="items-center mt-4 mb-2">
            <Text className="text-black/25 text-2xl font-extrabold">Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
