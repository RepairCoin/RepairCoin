import { useState } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { goBack } from "expo-router/build/global-state/routing";
import { useAuthStore } from "@/store/auth.store";
import { useCustomer } from "@/hooks/customer/useCustomer";
import { AppHeader } from "@/components/ui/AppHeader";
import FormInput from "@/components/ui/FormInput";
import SectionHeader from "@/components/ui/SectionHeader";
import PrimaryButton from "@/components/ui/PrimaryButton";
import { ThemedView } from "@/components/ui/ThemedView";

export default function EditProfilePage() {
  const { account } = useAuthStore();
  const { useGetCustomerByWalletAddress, useUpdateCustomerProfile } =
    useCustomer();
  const { data: customerData } = useGetCustomerByWalletAddress(
    account?.address
  );
  const updateProfileMutation = useUpdateCustomerProfile(account?.address);

  const [formData, setFormData] = useState({
    
    name: customerData?.customer?.name || "",
    email: customerData?.customer?.email || "",
    phone: customerData?.customer?.phone || "",
  });

  const updateField = (field: string) => (text: string) => {
    setFormData({ ...formData, [field]: text });
  };

  const handleSaveChanges = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      Alert.alert("Error", "Please enter a valid email address");
      return;
    }

    try {
      await updateProfileMutation.mutateAsync({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
      });

      Alert.alert("Success", "Profile updated successfully", [
        { text: "OK", onPress: () => goBack() },
      ]);
    } catch (error) {
      Alert.alert("Error", "Failed to update profile. Please try again.");
      console.error("Error updating profile:", error);
    }
  };

  return (
    <ThemedView className="h-full w-full">
      <View className="w-full h-full">
        {/* Header */}
        <AppHeader title="Edit Profile" onBackPress={goBack} />

        <ScrollView
          className="flex-1 px-6"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {/* Personal Information Section */}
          <SectionHeader
            icon={<Ionicons name="person" size={16} color="#000" />}
            title="Personal Information"
          />

          <FormInput
            label="Full Name"
            icon={<Ionicons name="person-outline" size={20} color="#FFCC00" />}
            value={formData.name}
            onChangeText={updateField("name")}
            placeholder="Enter your full name"
          />

          <FormInput
            label="Email Address"
            icon={<Ionicons name="mail-outline" size={20} color="#FFCC00" />}
            value={formData.email}
            onChangeText={updateField("email")}
            placeholder="Enter your email address"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <FormInput
            label="Phone Number"
            icon={<Feather name="phone" size={20} color="#FFCC00" />}
            value={formData.phone}
            onChangeText={updateField("phone")}
            placeholder="Enter your phone number"
            keyboardType="phone-pad"
          />

          {/* Wallet Section */}
          <SectionHeader
            icon={<Ionicons name="wallet" size={16} color="#000" />}
            title="Wallet Information"
          />

          <FormInput
            label="Connected Wallet"
            icon={<Ionicons name="wallet-outline" size={20} color="#666" />}
            value={account?.address || "No wallet connected"}
            onChangeText={() => {}}
            placeholder="Wallet address"
            editable={false}
            helperText="Your wallet address cannot be changed"
          />

          {/* Info Note */}
          <View className="bg-[#2A2A2C] rounded-xl p-4 mt-4 flex-row">
            <Ionicons name="information-circle" size={20} color="#FFCC00" />
            <Text className="text-gray-400 text-sm ml-3 flex-1">
              Your profile information helps shops identify you when processing
              rewards and redemptions.
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
            title={
              updateProfileMutation.isPending ? "Saving..." : "Save Changes"
            }
            onPress={handleSaveChanges}
            loading={updateProfileMutation.isPending}
          />
        </View>
      </View>
    </ThemedView>
  );
}
