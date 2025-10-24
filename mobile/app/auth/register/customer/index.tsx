import React, { useCallback, useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { router } from "expo-router";
import { AntDesign } from "@expo/vector-icons";

import Screen from "@/components/ui/Screen";
import PrimaryButton from "@/components/ui/PrimaryButton";
import { RegisterAsCustomerService } from "@/services/RegisterServices";
import { useAuthStore } from "@/store/authStore";
import { EmailValidation } from "@/utilities/Validation";

// Types
interface FormData {
  fullName: string;
  email: string;
  referral: string;
}

interface FormErrors {
  fullName?: string;
  email?: string;
}

// Form Input Component
interface FormInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  error?: string;
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad";
  editable?: boolean;
  multiline?: boolean;
}

const FormInput: React.FC<FormInputProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  keyboardType = "default",
  editable = true,
  multiline = false,
}) => (
  <View className="mt-4">
    <Text className="text-sm text-gray-300 mb-1">{label}</Text>
    <TextInput
      className={`w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base ${error ? 'border border-red-500' : ''}`}
      placeholder={placeholder}
      placeholderTextColor="#999"
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      editable={editable}
      multiline={multiline}
      autoCapitalize="none"
      autoCorrect={false}
    />
    {error && <Text className="text-red-500 text-xs mt-1">{error}</Text>}
  </View>
);

// Main Component
export default function RegisterAsCustomerPage() {
  // State Management
  const [formData, setFormData] = useState<FormData>({
    fullName: "",
    email: "",
    referral: "",
  });
  
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  // Auth Store
  const account = useAuthStore((state) => state.account);
  const login = useAuthStore((state) => state.login);

  // Form Handlers
  const updateFormData = useCallback((field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (formErrors[field as keyof FormErrors]) {
      setFormErrors(prev => ({ ...prev, [field]: undefined }));
    }
  }, [formErrors]);

  // Validation
  const validateForm = useCallback((): boolean => {
    const errors: FormErrors = {};
    
    // Full Name validation
    if (!formData.fullName.trim()) {
      errors.fullName = "Full name is required";
    } else if (formData.fullName.trim().length < 2) {
      errors.fullName = "Full name must be at least 2 characters";
    }
    
    // Email validation
    if (!formData.email.trim()) {
      errors.email = "Email is required";
    } else if (!EmailValidation(formData.email)) {
      errors.email = "Please enter a valid email address";
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  // Form Submission
  const handleSubmit = useCallback(async () => {
    if (!validateForm()) {
      return;
    }

    if (!account?.address) {
      Alert.alert("Error", "Wallet not connected. Please connect your wallet first.");
      router.push("/auth/wallet");
      return;
    }

    setIsLoading(true);

    try {
      const response = await RegisterAsCustomerService({
        walletAddress: account.address,
        name: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: "", // Phone is optional/not required anymore
        referralCode: formData.referral.trim() || undefined,
      });

      if (response.success) {
        // Login the user after successful registration
        await login();
        router.push("/auth/register/customer/Success");
      } else {
        Alert.alert(
          "Registration Failed",
          "An error occurred during registration. Please try again."
        );
      }
    } catch (error) {
      console.error("Registration error:", error);
      Alert.alert(
        "Registration Error",
        "Unable to complete registration. Please check your connection and try again."
      );
    } finally {
      setIsLoading(false);
    }
  }, [validateForm, account, formData, login]);

  // Check if form is valid for submission
  const isFormValid = useMemo(() => {
    return (
      formData.fullName.trim().length >= 2 &&
      EmailValidation(formData.email)
    );
  }, [formData]);

  // Navigation
  const handleGoBack = useCallback(() => {
    router.back();
  }, []);

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="px-10 py-20">
            {/* Header */}
            <Pressable onPress={handleGoBack} hitSlop={10}>
              <AntDesign name="left" color="white" size={25} />
            </Pressable>
            
            <Text className="text-[#FFCC00] font-extrabold text-[32px] mt-4">
              Register as Customer
            </Text>
            <Text className="text-white text-[12px] my-4">
              Create your RepairCoin account and turn every{"\n"}
              repair into rewards.
            </Text>

            {/* Form Fields */}
            <FormInput
              label="Full Name"
              value={formData.fullName}
              onChangeText={(text) => updateFormData("fullName", text)}
              placeholder="Enter Your Full Name"
              error={formErrors.fullName}
            />

            <FormInput
              label="Email"
              value={formData.email}
              onChangeText={(text) => updateFormData("email", text)}
              placeholder="Enter Email"
              keyboardType="email-address"
              error={formErrors.email}
            />

            {/* Referral Code */}
            <FormInput
              label="Referral Code (Optional)"
              value={formData.referral}
              onChangeText={(text) => updateFormData("referral", text)}
              placeholder="Enter Referral Code"
            />
            <Text className="text-sm text-gray-300 mt-1 mb-10">
              Earn bonus tokens when you sign up with a referral code.
            </Text>

            {/* Submit Button */}
            <PrimaryButton
              title={isLoading ? "Registering..." : "Register as Customer"}
              onPress={handleSubmit}
              disabled={!isFormValid || isLoading}
            />
            
            {/* Loading Indicator */}
            {isLoading && (
              <View className="absolute inset-0 bg-black/50 items-center justify-center">
                <ActivityIndicator size="large" color="#FFCC00" />
                <Text className="text-white mt-2">Creating your account...</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}