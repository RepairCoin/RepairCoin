import React from "react";
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { AppHeader } from "@/shared/components/ui/AppHeader";
import FormInput from "@/shared/components/ui/FormInput";
import SectionHeader from "@/shared/components/ui/SectionHeader";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import { ThemedView } from "@/shared/components/ui/ThemedView";
import { useCustomerRegister } from "../hooks";

export default function CustomerRegisterScreen() {
  const {
    formData,
    updateFormData,
    isFormValid,
    isLoading,
    validateAndSubmit,
    handleGoBack,
    account,
  } = useCustomerRegister();

  return (
    <ThemedView className="flex-1">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="w-full h-full">
          <AppHeader title="Customer Registration" onBackPress={handleGoBack} />

          <ScrollView
            className="flex-1 px-6"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 120 }}
            keyboardShouldPersistTaps="handled"
          >
            <View className="mt-4 mb-2">
              <Text className="text-[#FFCC00] font-bold text-xl">
                Join RepairCoin
              </Text>
              <Text className="text-gray-400 text-sm mt-2">
                Create your account and turn every repair into rewards.
              </Text>
            </View>

            <SectionHeader
              icon={<Ionicons name="person" size={16} color="#000" />}
              title="Personal Information"
            />

            <FormInput
              label="Full Name"
              icon={<Ionicons name="person-outline" size={20} color="#FFCC00" />}
              value={formData.fullName}
              onChangeText={(text) => updateFormData("fullName", text)}
              placeholder="Enter your full name"
            />

            <FormInput
              label="Email Address"
              icon={<Ionicons name="mail-outline" size={20} color="#FFCC00" />}
              value={formData.email}
              onChangeText={(text) => updateFormData("email", text)}
              placeholder="Enter your email address"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <SectionHeader
              icon={<Ionicons name="gift" size={16} color="#000" />}
              title="Referral (Optional)"
            />

            <FormInput
              label="Referral Code"
              icon={<Feather name="gift" size={20} color="#FFCC00" />}
              value={formData.referral}
              onChangeText={(text) => updateFormData("referral", text)}
              placeholder="Enter referral code"
              autoCapitalize="none"
              helperText="Earn bonus tokens when you sign up with a referral code"
            />

            <SectionHeader
              icon={<Ionicons name="wallet" size={16} color="#000" />}
              title="Wallet Information"
            />

            <FormInput
              label="Connected Wallet"
              icon={<Ionicons name="wallet-outline" size={20} color="#666" />}
              value={account?.address || "Connect wallet to continue"}
              onChangeText={() => {}}
              placeholder="Wallet address"
              editable={false}
              helperText="Your wallet will be used for receiving rewards"
            />

            <View className="bg-[#FFCC00]/10 rounded-xl p-4 mt-4 flex-row border border-[#FFCC00]/30">
              <Ionicons name="sparkles" size={20} color="#FFCC00" />
              <Text className="text-gray-300 text-sm ml-3 flex-1">
                As a RepairCoin customer, you'll earn RCN tokens for every
                repair. Use them for discounts or redeem them at partner shops!
              </Text>
            </View>
          </ScrollView>

          <View
            className="absolute bottom-0 left-0 right-0 px-4 pb-8 pt-4"
            style={{
              backgroundColor: "#121212",
              borderTopWidth: 1,
              borderTopColor: "#2A2A2C",
            }}
          >
            <PrimaryButton
              title={isLoading ? "Creating Account..." : "Create Account"}
              onPress={validateAndSubmit}
              disabled={!isFormValid || isLoading}
              loading={isLoading}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}
