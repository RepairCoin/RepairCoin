import { useState, useEffect } from "react";
import {
  ScrollView,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Linking,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Checkbox } from "expo-checkbox";
import { useRouter } from "expo-router";
import Screen from "@/components/ui/Screen";
import PrimaryButton from "@/components/ui/PrimaryButton";
import { apiClient } from "@/utilities/axios";
import { useShop } from "@/hooks/shop/useShop";
import { useAuthStore } from "@/store/auth.store";

type SubscriptionFormData = {
  shopName: string;
  email: string;
  phoneNumber: string;
  shopAddress: string;
  acceptTerms: boolean;
};

type SubscriptionResponse = {
  success: boolean;
  error?: string;
  data?: {
    isPendingResume?: boolean;
    message?: string;
    paymentUrl?: string;
    nextSteps?: string;
  };
};

export default function SubscriptionForm() {
  const router = useRouter();
  const { account } = useAuthStore();
  const { useGetShopByWalletAddress } = useShop();
  const { data: shopData, isLoading: isLoadingShop } = useGetShopByWalletAddress(
    account?.address || ""
  );

  const [formData, setFormData] = useState<SubscriptionFormData>({
    shopName: "",
    email: "",
    phoneNumber: "",
    shopAddress: "",
    acceptTerms: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill form with existing shop data
  useEffect(() => {
    if (shopData) {
      setFormData((prev) => ({
        ...prev,
        shopName: shopData?.name || "",
        email: shopData?.email || "",
        phoneNumber: shopData?.phone || "",
        shopAddress: shopData?.address || "",
      }));
    }
  }, [shopData]);

  const updateFormData = <K extends keyof SubscriptionFormData>(
    field: K,
    value: SubscriptionFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const isFormValid =
    formData.shopName.trim() !== "" &&
    formData.email.trim() !== "" &&
    formData.phoneNumber.trim() !== "" &&
    formData.shopAddress.trim() !== "" &&
    formData.acceptTerms;

  const handleSubmit = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Validate form
      if (!formData.email || !formData.shopName || !formData.phoneNumber || !formData.shopAddress) {
        setError("Please fill in all required fields");
        setIsLoading(false);
        return;
      }

      const result = await apiClient.post<SubscriptionResponse>("/shops/subscription/subscribe", {
        billingMethod: "credit_card",
        billingEmail: formData.email,
        billingContact: formData.shopName,
        billingPhone: formData.phoneNumber,
        billingAddress: formData.shopAddress,
        notes: "Monthly subscription enrollment via subscription form",
      });

      // Check if response is successful
      if (!result.success) {
        throw new Error(result.error || "Failed to create subscription");
      }

      // Handle pending subscription resume
      if (result.data?.isPendingResume) {
        Alert.alert(
          "Resuming Subscription",
          result.data.message || "Resuming your pending subscription..."
        );
        // Redirect to payment page for pending subscriptions
        if (result.data.paymentUrl) {
          setTimeout(() => {
            Linking.openURL(result.data!.paymentUrl!);
          }, 2000);
        }
      } else if (result.data?.paymentUrl) {
        // Handle payment redirect for new subscriptions
        Alert.alert("Success", "Redirecting to secure payment...");
        setTimeout(() => {
          Linking.openURL(result.data!.paymentUrl!);
        }, 1500);
      } else {
        // Show success message
        Alert.alert(
          "Success",
          result.data?.nextSteps || result.data?.message || "Subscription created successfully!"
        );

        // Redirect to dashboard after a delay
        setTimeout(() => {
          router.push("/shop/tabs/home");
        }, 3000);
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || "Something went wrong";
      setError(errorMessage);
      Alert.alert("Error", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

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

            {error && (
              <View className="bg-red-500/20 border border-red-500 rounded-xl p-3 mb-4">
                <Text className="text-red-500 text-center">{error}</Text>
              </View>
            )}

            <View className="mt-4">
              <Text className="text-sm text-gray-300 mb-1">Shop Name</Text>
              <TextInput
                className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
                placeholder="Enter your shop name"
                placeholderTextColor="#999"
                value={formData.shopName}
                onChangeText={(value) => updateFormData("shopName", value)}
              />
            </View>

            <View className="mt-4">
              <Text className="text-sm text-gray-300 mb-1">Email Address</Text>
              <TextInput
                className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
                placeholder="Enter your email address"
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
                value={formData.email}
                onChangeText={(value) => updateFormData("email", value)}
              />
            </View>

            <View className="mt-4">
              <Text className="text-sm text-gray-300 mb-1">Phone Number</Text>
              <TextInput
                className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
                placeholder="Enter your phone number"
                placeholderTextColor="#999"
                keyboardType="phone-pad"
                value={formData.phoneNumber}
                onChangeText={(value) => updateFormData("phoneNumber", value)}
              />
            </View>

            <View className="mt-4">
              <Text className="text-sm text-gray-300 mb-1">Shop Address</Text>
              <TextInput
                className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
                placeholder="Enter your shop address"
                placeholderTextColor="#999"
                value={formData.shopAddress}
                onChangeText={(value) => updateFormData("shopAddress", value)}
              />
            </View>

            <View className="flex-row items-start mt-8">
              <Checkbox
                value={formData.acceptTerms}
                onValueChange={(value) => updateFormData("acceptTerms", value)}
                style={{
                  borderRadius: 4,
                  backgroundColor: formData.acceptTerms ? "#c8f7c5" : "#f5f5f5",
                  marginTop: 2,
                }}
              />
              <Text className="ml-3 text-white text-sm flex-1">
                I agree to the{" "}
                <Text className="text-[#FFCC00] underline">
                  Terms of Service
                </Text>{" "}
                and{" "}
                <Text className="text-[#FFCC00] underline">Privacy Policy</Text>
              </Text>
            </View>

            <PrimaryButton
              title="Continue to Payment"
              onPress={handleSubmit}
              disabled={!isFormValid}
              loading={isLoading}
              className="mt-8"
            />

            <Pressable
              onPress={() => router.back()}
              className="mt-4 py-3 items-center"
            >
              <Text className="text-gray-300 text-base">Back</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
