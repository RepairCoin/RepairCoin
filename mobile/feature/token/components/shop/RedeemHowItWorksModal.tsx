import React from "react";
import { View, Text, TouchableOpacity, Modal, Pressable } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { HOW_IT_WORKS_ITEMS } from "../constants";

interface HowItWorksModalProps {
  visible: boolean;
  onClose: () => void;
}

export const HowItWorksModal: React.FC<HowItWorksModalProps> = ({
  visible,
  onClose,
}) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/80">
        <Pressable className="flex-1" onPress={onClose} />
        <View className="bg-[#1A1A1A] rounded-t-3xl pt-6 pb-8 px-5">
          <View className="w-12 h-1 bg-gray-600 rounded-full self-center mb-6" />

          <Text className="text-white text-xl font-bold mb-6">
            How Redemption Works
          </Text>

          <View className="space-y-4">
            {HOW_IT_WORKS_ITEMS.map((item, index) => (
              <View key={index} className="flex-row items-start">
                <View className="w-10 h-10 bg-[#FFCC00]/20 rounded-xl items-center justify-center mr-4">
                  <MaterialIcons
                    name={item.icon as any}
                    size={20}
                    color="#FFCC00"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-white font-semibold mb-1">
                    {item.title}
                  </Text>
                  <Text className="text-gray-400 text-sm">{item.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          <TouchableOpacity
            onPress={onClose}
            className="bg-[#FFCC00] rounded-xl py-4 mt-6"
          >
            <Text className="text-black text-center font-bold">Got It</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};
