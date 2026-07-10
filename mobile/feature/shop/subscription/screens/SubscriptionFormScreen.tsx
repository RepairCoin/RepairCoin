import {
  ScrollView,
  Text,
  View,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ActivityIndicator,
} from "react-native";
import Screen from "@/shared/components/ui/Screen";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import { useSubscriptionForm } from "../hooks";
import { FormField, TermsCheckbox, ErrorMessage } from "../components";

export default function SubscriptionFormScreen() {
  const {
    formData,
    updateFormData,
    isFormValid,
    isLoading,
    isLoadingShop,
    error,
    selectedPlan,
    handleSubmit,
    handleGoBack,
  } = useSubscriptionForm();

  if (isLoadingShop) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FFCC00" />
          <Text className="text-gray-300 mt-4">Loading shop data...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView>
          <View className="px-6 py-12">
            <Text className="text-[#FFCC00] text-2xl font-bold text-center">
              Start Your Subscription
            </Text>
            <Text className="text-gray-300 text-center mt-2 mb-6">
              Complete the form below to get started
            </Text>

            <View className="bg-[#FFCC00]/10 border border-[#FFCC00]/30 rounded-2xl p-4 mb-6 flex-row items-center justify-between">
              <View>
                <Text className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-1">
                  Selected plan
                </Text>
                <Text className="text-[#FFCC00] text-base font-bold">
                  {selectedPlan.label}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-white text-2xl font-extrabold">
                  ${selectedPlan.price}
                </Text>
                <Text className="text-white/40 text-xs">per month</Text>
              </View>
            </View>

            <ErrorMessage message={error} />

            <FormField
              label="Shop Name"
              placeholder="Enter your shop name"
              value={formData.shopName}
              onChangeText={(value) => updateFormData("shopName", value)}
            />

            <FormField
              label="Email Address"
              placeholder="Enter your email address"
              value={formData.email}
              onChangeText={(value) => updateFormData("email", value)}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <FormField
              label="Phone Number"
              placeholder="Enter your phone number"
              value={formData.phoneNumber}
              onChangeText={(value) => updateFormData("phoneNumber", value)}
              keyboardType="phone-pad"
            />

            <FormField
              label="Shop Address"
              placeholder="Enter your shop address"
              value={formData.shopAddress}
              onChangeText={(value) => updateFormData("shopAddress", value)}
            />

            <TermsCheckbox
              value={formData.acceptTerms}
              onValueChange={(value) => updateFormData("acceptTerms", value)}
            />

            <PrimaryButton
              title="Continue to Payment"
              onPress={handleSubmit}
              disabled={!isFormValid}
              loading={isLoading}
              className="mt-8"
            />

            <Pressable onPress={handleGoBack} className="mt-4 py-3 items-center">
              <Text className="text-gray-300 text-base">Back</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
