import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface WalletOption {
  id: string;
  name: string;
  icon: any;
  type: "wallet" | "social";
  available: boolean;
}

interface WalletSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectWallet: (walletId: string) => void;
  isConnecting: boolean;
  connectingWallet?: string;
}

const walletOptions: WalletOption[] = [
  {
    id: "google",
    name: "Google",
    icon: require("@/assets/icons/icons8-google-100.png"),
    type: "social",
    available: true,
  },
  {
    id: "metamask",
    name: "MetaMask",
    icon: require("@/assets/icons/icons8-metamask-100.png"),
    type: "wallet",
    available: true,
  },
];

export default function WalletSelectionModal({
  visible,
  onClose,
  onSelectWallet,
  isConnecting,
  connectingWallet,
}: WalletSelectionModalProps) {
  const socialOptions = walletOptions.filter((w) => w.type === "social");
  const walletAppOptions = walletOptions.filter((w) => w.type === "wallet");

  const renderWalletOption = (option: WalletOption) => {
    const isCurrentlyConnecting = isConnecting && connectingWallet === option.id;
    const isDisabled = !option.available || (isConnecting && connectingWallet !== option.id);

    return (
      <TouchableOpacity
        key={option.id}
        onPress={() => !isDisabled && onSelectWallet(option.id)}
        disabled={isDisabled}
        className={`bg-gray-800 rounded-xl p-4 mb-3 flex-row items-center justify-between ${
          isDisabled ? "opacity-50" : ""
        }`}
      >
        <View className="flex-row items-center">
          <Image source={option.icon} className="w-8 h-8 mr-3" />
          <View>
            <Text className="text-white font-semibold">{option.name}</Text>
            {!option.available && (
              <Text className="text-gray-500 text-xs">Not available in simulator</Text>
            )}
          </View>
        </View>
        {isCurrentlyConnecting ? (
          <ActivityIndicator size="small" color="#FFCC00" />
        ) : (
          <Ionicons name="chevron-forward" size={20} color="#666" />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-gray-900 rounded-t-3xl p-6 max-h-[80%]">
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-white text-2xl font-bold">Connect Wallet</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text className="text-gray-400 text-sm font-semibold mb-3 uppercase">
              Social Login
            </Text>
            {socialOptions.map(renderWalletOption)}

            <Text className="text-gray-400 text-sm font-semibold mb-3 mt-4 uppercase">
              Wallet Apps
            </Text>
            {walletAppOptions.map(renderWalletOption)}

            <Text className="text-gray-500 text-xs text-center mt-4">
              By connecting, you agree to FixFlow's Terms of Service and Privacy Policy
            </Text>

            {isConnecting && (
              <TouchableOpacity
                onPress={onClose}
                className="bg-gray-700 rounded-xl py-3 mt-4"
              >
                <Text className="text-white text-center font-semibold">Cancel</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
