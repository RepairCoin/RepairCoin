import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";

import { AppHeader } from "@/components/ui/AppHeader";
import FormInput from "@/components/ui/FormInput";
import SectionHeader from "@/components/ui/SectionHeader";
import PrimaryButton from "@/components/ui/PrimaryButton";
import { ThemedView } from "@/components/ui/ThemedView";
import { useAuthStore } from "@/store/auth.store";
import { EmailValidation } from "@/utilities/validation";
import { useCustomer } from "@/hooks/customer/useCustomer";

// Types
interface FormData {
  fullName: string;
  email: string;
  referral: string;
}

export default function RegisterAsCustomerPage() {
  const { useRegisterCustomer } = useCustomer();
  const { mutate: registerCustomer, isPending: isLoading } =
    useRegisterCustomer();

  // State Management
  const [formData, setFormData] = useState<FormData>({
    fullName: "",
    email: "",
    referral: "",
  });

  // Auth Store
  const account = useAuthStore((state) => state.account);

  // Form Handlers
  const updateFormData = useCallback(
    (field: keyof FormData, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  // Validation
  const validateAndSubmit = useCallback(() => {
    const errors: string[] = [];

    // Full Name validation
    if (!formData.fullName.trim()) {
      errors.push("Full name is required");
    } else if (formData.fullName.trim().length < 2) {
      errors.push("Full name must be at least 2 characters");
    }

    // Email validation
    if (!formData.email.trim()) {
      errors.push("Email is required");
    } else if (!EmailValidation(formData.email)) {
      errors.push("Please enter a valid email address");
    }

    if (errors.length > 0) {
      Alert.alert("Validation Error", errors.join("\n"));
      return;
    }

    // Submit form
    try {
      const submissionData = {
        ...formData,
        walletAddress: account.address,
      };

      registerCustomer(submissionData);
    } catch (error) {
      console.error("Registration error:", error);
      Alert.alert(
        "Registration Error",
        "Unable to complete registration. Please check your connection and try again."
      );
    }
  }, [formData, account, registerCustomer]);

  // Check if form is valid for submission
  const isFormValid = useMemo(() => {
    return (
      formData.fullName.trim().length >= 2 && EmailValidation(formData.email)
    );
  }, [formData]);

  // Navigation
  const handleGoBack = useCallback(() => {
    router.back();
  }, []);

  return (
    <ThemedView className="flex-1">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="w-full h-full">
          {/* Header */}
          <AppHeader title="Customer Registration" onBackPress={handleGoBack} />

          <ScrollView
            className="flex-1 px-6"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 120 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Welcome Message */}
            <View className="mt-4 mb-2">
              <Text className="text-[#FFCC00] font-bold text-xl">
                Join RepairCoin
              </Text>
              <Text className="text-gray-400 text-sm mt-2">
                Create your account and turn every repair into rewards.
              </Text>
            </View>

            {/* Personal Information Section */}
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

            {/* Referral Section */}
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

            {/* Wallet Section */}
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

            {/* Info Note */}
            <View className="bg-[#FFCC00]/10 rounded-xl p-4 mt-4 flex-row border border-[#FFCC00]/30">
              <Ionicons name="sparkles" size={20} color="#FFCC00" />
              <Text className="text-gray-300 text-sm ml-3 flex-1">
                As a RepairCoin customer, you'll earn RCN tokens for every
                repair. Use them for discounts or redeem them at partner shops!
              </Text>
            </View>
          </ScrollView>

          {/* Fixed Bottom Button */}
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
