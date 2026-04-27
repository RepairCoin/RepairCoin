import React from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { HOW_TO_REDEEM_STEPS } from "../constants";

interface HowToRedeemModalProps {
  visible: boolean;
  onClose: () => void;
}

export const HowToRedeemModal: React.FC<HowToRedeemModalProps> = ({
  visible,
  onClose,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/70 justify-center items-center px-4"
        onPress={onClose}
      >
        <Pressable
          className="bg-zinc-900 rounded-2xl w-full max-w-md"
          onPress={(e) => e.stopPropagation()}
        >
          <View className="flex-row items-center justify-between p-4 border-b border-zinc-800">
            <Text className="text-white text-lg font-bold">How to Redeem</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          <ScrollView className="max-h-[70vh]" showsVerticalScrollIndicator={false}>
            <View className="p-4">
              {/* How to Redeem Steps */}
              {HOW_TO_REDEEM_STEPS.map((step, index) => (
                <View
                  key={index}
                  className={`flex-row items-start ${index < HOW_TO_REDEEM_STEPS.length - 1 ? "mb-4 pb-4 border-b border-zinc-800" : ""}`}
                >
                  <View className="bg-[#FFCC00]/20 rounded-full p-2 mr-3">
                    <Ionicons name={step.icon as any} size={20} color="#FFCC00" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-white font-semibold">{step.title}</Text>
                    <Text className="text-gray-400 text-sm mt-0.5">
                      {step.desc}
                    </Text>
                  </View>
                  <View className="bg-zinc-800 rounded-full w-6 h-6 items-center justify-center">
                    <Text className="text-gray-400 text-xs font-bold">
                      {index + 1}
                    </Text>
                  </View>
                </View>
              ))}

              {/* Redemption Rules */}
              <View className="mt-4 pt-4 border-t border-zinc-700">
                <Text className="text-white font-bold mb-3">Redemption Rules</Text>
                <View className="flex-row items-start mb-3">
                  <MaterialIcons name="check-circle" size={18} color="#22C55E" />
                  <Text className="text-gray-300 ml-2 flex-1">
                    <Text className="text-green-400 font-semibold">100%</Text>{" "}
                    redemption at the shop where you earned RCN
                  </Text>
                </View>
                <View className="flex-row items-start mb-3">
                  <MaterialIcons name="check-circle" size={18} color="#22C55E" />
                  <Text className="text-gray-300 ml-2 flex-1">
                    <Text className="text-[#FFCC00] font-semibold">20%</Text>{" "}
                    redemption at any other partner shop
                  </Text>
                </View>
                <View className="flex-row items-start">
                  <Ionicons name="information-circle" size={18} color="#3B82F6" />
                  <Text className="text-gray-400 ml-2 flex-1 text-sm">
                    Redemption requires shop approval. You'll receive a
                    notification when a shop initiates a redemption.
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
