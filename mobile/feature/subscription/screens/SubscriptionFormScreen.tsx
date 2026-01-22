import {
  ScrollView,
  Text,
  View,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ActivityIndicator,
} from "react-native";
import Screen from "@/components/ui/Screen";
import PrimaryButton from "@/components/ui/PrimaryButton";
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
            <Text className="text-gray-300 text-center mt-2 mb-8">
              Complete the form below to get started
            </Text>

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
