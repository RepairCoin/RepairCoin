import React from "react";
import { Modal, View, Text, TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface DemoAccountModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectCustomer: () => void;
  onSelectShop: () => void;
  isLoading: boolean;
}

export function DemoAccountModal({
  visible,
  onClose,
  onSelectCustomer,
  onSelectShop,
  isLoading,
}: DemoAccountModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-gray-900 rounded-t-3xl p-6">
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-white text-2xl font-bold">Explore Demo</Text>
            <TouchableOpacity onPress={onClose} disabled={isLoading}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>

          <Text className="text-gray-400 text-sm mb-6">
            Choose an account type to explore the app without signing in.
          </Text>

          <TouchableOpacity
            onPress={onSelectCustomer}
            disabled={isLoading}
            className={`bg-gray-800 rounded-xl p-4 flex-row items-center justify-between ${Platform.OS === "android" ? "mb-6" : "mb-3"} ${isLoading ? "opacity-50" : ""}`}
          >
            <View className="flex-row items-center">
              <View className="w-10 h-10 rounded-full bg-yellow-500/20 items-center justify-center mr-3">
                <Ionicons name="person-outline" size={20} color="#FFCC00" />
              </View>
              <View>
                <Text className="text-white font-semibold">Customer</Text>
                <Text className="text-gray-400 text-xs">Browse services, view rewards</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>

          {Platform.OS !== "android" && (
            <TouchableOpacity
              onPress={onSelectShop}
              disabled={isLoading}
              className={`bg-gray-800 rounded-xl p-4 mb-6 flex-row items-center justify-between ${isLoading ? "opacity-50" : ""}`}
            >
              <View className="flex-row items-center">
                <View className="w-10 h-10 rounded-full bg-blue-500/20 items-center justify-center mr-3">
                  <Ionicons name="storefront-outline" size={20} color="#60a5fa" />
                </View>
                <View>
                  <Text className="text-white font-semibold">Shop</Text>
                  <Text className="text-gray-400 text-xs">Manage services, issue rewards</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
          )}

          <Text className="text-gray-500 text-xs text-center">
            Demo mode is read-only. Sign in with a wallet for full access.
          </Text>
        </View>
      </View>
    </Modal>
  );
}
