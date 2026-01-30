import { View, Text, ScrollView } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { AppHeader } from "@/shared/components/ui/AppHeader";
import FormInput from "@/shared/components/ui/FormInput";
import SectionHeader from "@/shared/components/ui/SectionHeader";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import { ThemedView } from "@/shared/components/ui/ThemedView";
import { useCustomerEditProfile } from "../hooks/ui";
import { THEME_COLORS } from "@/shared/constants/Colors";

export default function CustomerEditProfileScreen() {
  const {
    formData,
    updateField,
    handleSaveChanges,
    isPending,
    walletAddress,
    goBack
  } = useCustomerEditProfile();

  return (
    <ThemedView className="h-full w-full">
      <View className="w-full h-full">
        <AppHeader title="Edit Profile" onBackPress={goBack} />

        <ScrollView
          className="flex-1 px-6"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          <SectionHeader
            icon={<Ionicons name="person" size={16} color="#000" />}
            title="Personal Information"
          />

          <FormInput
            label="Full Name"
            icon={<Ionicons name="person-outline" size={20} color={THEME_COLORS.primary} />}
            value={formData.name}
            onChangeText={updateField("name")}
            placeholder="Enter your full name"
          />

          <FormInput
            label="Email Address"
            icon={<Ionicons name="mail-outline" size={20} color={THEME_COLORS.primary} />}
            value={formData.email}
            onChangeText={updateField("email")}
            placeholder="Enter your email address"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <FormInput
            label="Phone Number"
            icon={<Feather name="phone" size={20} color={THEME_COLORS.primary} />}
            value={formData.phone}
            onChangeText={updateField("phone")}
            placeholder="Enter your phone number"
            keyboardType="phone-pad"
          />

          <SectionHeader
            icon={<Ionicons name="wallet" size={16} color="#000" />}
            title="Wallet Information"
          />

          <FormInput
            label="Connected Wallet"
            icon={<Ionicons name="wallet-outline" size={20} color="#666" />}
            value={walletAddress || "No wallet connected"}
            onChangeText={() => {}}
            placeholder="Wallet address"
            editable={false}
            helperText="Your wallet address cannot be changed"
          />

          <View className="bg-[#2A2A2C] rounded-xl p-4 mt-4 flex-row">
            <Ionicons name="information-circle" size={20} color={THEME_COLORS.primary} />
            <Text className="text-gray-400 text-sm ml-3 flex-1">
              Your profile information helps shops identify you when processing
              rewards and redemptions.
            </Text>
          </View>
        </ScrollView>

        <View
          className="absolute bottom-0 left-0 right-0 px-4 pb-8 pt-4"
          style={{
            backgroundColor: THEME_COLORS.background,
            borderTopWidth: 1,
            borderTopColor: "#2A2A2C"
          }}
        >
          <PrimaryButton
            title={isPending ? "Saving..." : "Save Changes"}
            onPress={handleSaveChanges}
            loading={isPending}
          />
        </View>
      </View>
    </ThemedView>
  );
}
