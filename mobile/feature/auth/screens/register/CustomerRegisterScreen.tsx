import React from "react";
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Controller } from "react-hook-form";
import { Feather, Ionicons } from "@expo/vector-icons";
import { AppHeader } from "@/shared/components/ui/AppHeader";
import FormInput from "@/shared/components/ui/FormInput";
import SectionHeader from "@/shared/components/ui/SectionHeader";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import { ThemedView } from "@/shared/components/ui/ThemedView";
import { useCustomerRegister } from "../../hooks/useCustomerRegister";

export default function CustomerRegisterScreen() {
  const {
    control,
    errors,
    isFormValid,
    isLoading,
    onSubmit,
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
            <View className="mb-2">
              <Text className="text-gray-400 text-sm mt-2">
                Create your account and turn every repair into rewards.
              </Text>
            </View>

            <SectionHeader 
              title="Personal Information" 
              customClassName="text-[#FFCC00]"
            />

            <Controller
              control={control}
              name="fullName"
              render={({ field: { onChange, value } }) => (
                <FormInput
                  label="Full Name"
                  value={value}
                  onChangeText={onChange}
                  placeholder="Enter your full name"
                  maxLength={100}
                  error={errors.fullName?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, value } }) => (
                <FormInput
                  label="Email Address"
                  value={value}
                  onChangeText={onChange}
                  placeholder="Enter your email address"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  maxLength={255}
                  error={errors.email?.message}
                />
              )}
            />

            <SectionHeader 
              title="Referral "
              optional={true}
              customClassName="text-[#FFCC00]"
            />

            <Controller
              control={control}
              name="referral"
              render={({ field: { onChange, value } }) => (
                <FormInput
                  label="Referral Code"
                  value={value ?? ""}
                  onChangeText={onChange}
                  placeholder="Enter referral code"
                  autoCapitalize="none"
                  helperText="Earn bonus tokens when you sign up with a referral code"
                  maxLength={50}
                />
              )}
            />

            <SectionHeader 
              title="Wallet Information"
              customClassName="text-[#FFCC00]"
            />

            <FormInput
              label="Connected Wallet"
              value={account?.address || "Connect wallet to continue"}
              onChangeText={() => {}}
              placeholder="Wallet address"
              editable={false}
              helperText="Your wallet will be used for receiving rewards"
            />

            <View className="bg-[#FFCC00]/10 rounded-xl p-4 mt-4 flex-row border border-[#FFCC00]/30">
              <Ionicons name="sparkles" size={20} color="#FFCC00" />
              <Text className="text-gray-300 text-sm ml-3 flex-1">
                As a FixFlow customer, you'll earn RCN tokens for every
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
              onPress={onSubmit}
              disabled={!isFormValid || isLoading}
              loading={isLoading}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}
