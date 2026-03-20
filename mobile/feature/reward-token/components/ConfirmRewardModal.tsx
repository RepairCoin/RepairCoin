import { View, Text, Modal, Pressable, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";

interface ConfirmRewardModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isIssuing: boolean;
  customerName?: string;
  customerTier?: string;
  customerAddress: string;
  baseReward: number;
  tierBonus: number;
  promoBonus: number;
  totalReward: number;
}

export default function ConfirmRewardModal({
  visible,
  onClose,
  onConfirm,
  isIssuing,
  customerName,
  customerTier,
  customerAddress,
  baseReward,
  tierBonus,
  promoBonus,
  totalReward,
}: ConfirmRewardModalProps) {
  const shortAddress = customerAddress
    ? `${customerAddress.slice(0, 6)}...${customerAddress.slice(-4)}`
    : "";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/70 justify-center items-center px-6"
        onPress={onClose}
      >
        <Pressable
          className="bg-zinc-900 rounded-3xl w-full overflow-hidden"
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View className="items-center pt-6 pb-4 px-6">
            <View className="w-16 h-16 rounded-full bg-[#FFCC00]/15 items-center justify-center mb-3">
              <MaterialIcons name="card-giftcard" size={32} color="#FFCC00" />
            </View>
            <Text className="text-white text-xl font-bold">Confirm Reward</Text>
            <Text className="text-gray-400 text-sm mt-1">
              Please review before issuing
            </Text>
          </View>

          {/* Recipient Info */}
          <View className="mx-6 bg-zinc-800 rounded-xl p-4 mb-4">
            <Text className="text-gray-400 text-xs uppercase tracking-wide mb-2">
              Recipient
            </Text>
            <Text className="text-white font-semibold text-base">
              {customerName || "Unknown Customer"}
            </Text>
            <Text className="text-gray-500 text-xs mt-1 font-mono">
              {shortAddress}
            </Text>
            {customerTier && (
              <View className="flex-row mt-2">
                <View className="bg-[#FFCC00]/10 px-2.5 py-1 rounded-full">
                  <Text className="text-[#FFCC00] text-xs font-semibold">
                    {customerTier.toUpperCase()}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Reward Breakdown */}
          <View className="mx-6 bg-zinc-800 rounded-xl p-4 mb-4">
            <Text className="text-gray-400 text-xs uppercase tracking-wide mb-3">
              Reward Breakdown
            </Text>
            <View className="flex-row justify-between mb-2">
              <Text className="text-gray-300">Base Reward</Text>
              <Text className="text-white font-semibold">{baseReward} RCN</Text>
            </View>
            {tierBonus > 0 && (
              <View className="flex-row justify-between mb-2">
                <Text className="text-gray-300">{customerTier} Bonus</Text>
                <Text className="text-green-400 font-semibold">+{tierBonus} RCN</Text>
              </View>
            )}
            {promoBonus > 0 && (
              <View className="flex-row justify-between mb-2">
                <Text className="text-gray-300">Promo Bonus</Text>
                <Text className="text-[#FFCC00] font-semibold">+{promoBonus} RCN</Text>
              </View>
            )}
            <View className="border-t border-zinc-700 mt-2 pt-3 flex-row justify-between">
              <Text className="text-white font-bold text-lg">Total</Text>
              <Text className="text-[#FFCC00] font-bold text-xl">{totalReward} RCN</Text>
            </View>
          </View>

          {/* Actions */}
          <View className="px-6 pb-6 flex-row gap-3">
            <TouchableOpacity
              onPress={onClose}
              disabled={isIssuing}
              className="flex-1 py-3.5 rounded-xl bg-zinc-800 items-center"
              activeOpacity={0.7}
            >
              <Text className="text-white font-semibold">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onConfirm}
              disabled={isIssuing}
              className="flex-1 py-3.5 rounded-xl bg-[#FFCC00] items-center flex-row justify-center"
              activeOpacity={0.7}
            >
              {isIssuing ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#000" />
                  <Text className="text-black font-bold ml-1.5">Confirm</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
