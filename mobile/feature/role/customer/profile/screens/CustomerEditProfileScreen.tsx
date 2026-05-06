import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppHeader } from "@/shared/components/ui/AppHeader";
import FormInput from "@/shared/components/ui/FormInput";
import PhoneInput from "@/shared/components/ui/PhoneInput";
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
    goBack,
    selectedAvatar,
    isUploadingAvatar,
    handleAvatarPick,
    removeAvatar,
  } = useCustomerEditProfile();

  const getInitials = (name: string) => {
    if (!name) return "U";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <ThemedView className="h-full w-full">
      <View className="w-full h-full">
        <AppHeader title="Edit Profile" onBackPress={goBack} />

        <ScrollView
          className="flex-1 px-6"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {/* Avatar Section */}
          <View className="items-center mt-4 mb-6">
            <View className="relative">
              <TouchableOpacity
                onPress={handleAvatarPick}
                disabled={isUploadingAvatar}
                activeOpacity={0.7}
              >
                <View className="w-28 h-28 rounded-full overflow-hidden items-center justify-center bg-[#2A2A2C] border-2 border-[#3A3A3C]">
                  {isUploadingAvatar ? (
                    <ActivityIndicator size="large" color={THEME_COLORS.primary} />
                  ) : selectedAvatar ? (
                    <Image
                      source={{ uri: selectedAvatar }}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <Text className="text-3xl font-bold" style={{ color: THEME_COLORS.primary }}>
                      {getInitials(formData.name)}
                    </Text>
                  )}
                </View>

                {/* Camera icon overlay */}
                <View
                  className="absolute bottom-0 right-0 w-9 h-9 rounded-full items-center justify-center border-2 border-[#1C1C1E]"
                  style={{ backgroundColor: THEME_COLORS.primary }}
                >
                  <Ionicons name="camera" size={18} color="#000" />
                </View>
              </TouchableOpacity>

              {/* Remove button */}
              {selectedAvatar && !isUploadingAvatar && (
                <TouchableOpacity
                  onPress={removeAvatar}
                  className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-red-500 items-center justify-center border-2 border-[#1C1C1E]"
                >
                  <Ionicons name="close" size={14} color="#fff" />
                </TouchableOpacity>
              )}
            </View>

            <Text className="text-gray-400 text-sm mt-3">
              {isUploadingAvatar ? "Uploading..." : "Tap to change photo"}
            </Text>
          </View>

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

          <PhoneInput
            label="Phone Number"
            value={formData.phone}
            onChangePhone={updateField("phone")}
            defaultCountryCode="US"
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
