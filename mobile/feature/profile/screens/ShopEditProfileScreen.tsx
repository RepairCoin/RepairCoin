import { View, Text, ScrollView, TouchableOpacity, Platform } from "react-native";
import { AntDesign, Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import FormInput from "@/shared/components/ui/FormInput";
import PhoneInput from "@/shared/components/ui/PhoneInput";
import SectionHeader from "@/shared/components/ui/SectionHeader";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import { ThemedView } from "@/shared/components/ui/ThemedView";
import LocationPickerModal from "@/shared/components/shared/LocationPickerModal";
import { useShopEditProfile } from "../hooks/ui";
import { PROFILE_COLORS } from "../constants";

export default function ShopEditProfileScreen() {
  const {
    formData,
    updateField,
    handleSaveChanges,
    handleLocationSelect,
    showLocationPicker,
    setShowLocationPicker,
    isPending,
    goBack
  } = useShopEditProfile();

  return (
    <ThemedView className="h-full w-full">
      <View className="w-full h-full">
        {/* Header */}
        <LinearGradient
          colors={["#2A2A2C", "#1A1A1C"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{
            paddingTop: Platform.OS === "ios" ? 60 : 50,
            paddingBottom: 20,
            paddingHorizontal: 16
          }}
        >
          <View className="flex-row justify-between items-center">
            <TouchableOpacity
              onPress={goBack}
              className="w-10 h-10 rounded-full bg-[#333] items-center justify-center"
            >
              <AntDesign name="left" color="white" size={18} />
            </TouchableOpacity>
            <Text className="text-white text-xl font-bold">Edit Profile</Text>
            <View className="w-10" />
          </View>
        </LinearGradient>

        <ScrollView
          className="flex-1 px-4"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {/* Basic Information Section */}
          <SectionHeader
            icon={<Feather name="info" size={16} color="#000" />}
            title="Basic Information"
          />

          <FormInput
            label="Shop Name"
            icon={<Feather name="shopping-bag" size={20} color={PROFILE_COLORS.primary} />}
            value={formData.name}
            onChangeText={updateField("name")}
            placeholder="Enter your shop name"
          />

          <FormInput
            label="Wallet Address"
            icon={<Ionicons name="wallet-outline" size={20} color="#666" />}
            value={formData.walletAddress}
            onChangeText={() => {}}
            placeholder="Wallet address"
            editable={false}
          />

          {/* Location Section */}
          <SectionHeader
            icon={<Ionicons name="location" size={16} color="#000" />}
            title="Location"
          />

          <FormInput
            label="Street Address"
            icon={<Ionicons name="location-outline" size={20} color={PROFILE_COLORS.primary} />}
            value={formData.address}
            onChangeText={updateField("address")}
            placeholder="Enter your street address"
          />

          {/* Pin Location on Map */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-400 mb-2 ml-1">
              Pin Location on Map
            </Text>
            <TouchableOpacity
              onPress={() => setShowLocationPicker(true)}
              activeOpacity={0.7}
            >
              <View className="flex-row items-center rounded-xl px-4 py-3 bg-[#2A2A2C]">
                <View className="w-10 h-10 rounded-full bg-[#FFCC00] items-center justify-center mr-3">
                  <Ionicons name="map" size={20} color="#000" />
                </View>
                <View className="flex-1">
                  {formData.location.lat && formData.location.lng ? (
                    <Text className="text-white text-base">
                      {parseFloat(formData.location.lat).toFixed(6)},{" "}
                      {parseFloat(formData.location.lng).toFixed(6)}
                    </Text>
                  ) : (
                    <Text className="text-gray-500 text-base">
                      Tap to select location
                    </Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </View>
            </TouchableOpacity>
          </View>

          {/* Contact Information Section */}
          <SectionHeader
            icon={<Feather name="phone" size={16} color="#000" />}
            title="Contact Information"
          />

          <FormInput
            label="Email Address"
            icon={<Feather name="mail" size={20} color={PROFILE_COLORS.primary} />}
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
            defaultCountryCode="PH"
          />

          <FormInput
            label="Website"
            icon={<Feather name="globe" size={20} color={PROFILE_COLORS.primary} />}
            value={formData.website}
            onChangeText={updateField("website")}
            placeholder="Enter your website URL"
            keyboardType="url"
            autoCapitalize="none"
          />

          {/* Social Media Section */}
          <SectionHeader
            icon={<Feather name="share-2" size={16} color="#000" />}
            title="Social Media"
          />

          <FormInput
            label="Facebook"
            icon={<Feather name="facebook" size={20} color={PROFILE_COLORS.primary} />}
            value={formData.facebook}
            onChangeText={updateField("facebook")}
            placeholder="Facebook profile URL"
            keyboardType="url"
            autoCapitalize="none"
          />

          <FormInput
            label="Twitter"
            icon={<Feather name="twitter" size={20} color={PROFILE_COLORS.primary} />}
            value={formData.twitter}
            onChangeText={updateField("twitter")}
            placeholder="Twitter handle or URL"
            keyboardType="url"
            autoCapitalize="none"
          />

          <FormInput
            label="Instagram"
            icon={<Feather name="instagram" size={20} color={PROFILE_COLORS.primary} />}
            value={formData.instagram}
            onChangeText={updateField("instagram")}
            placeholder="Instagram handle or URL"
            keyboardType="url"
            autoCapitalize="none"
          />
        </ScrollView>

        {/* Fixed Bottom Button */}
        <View
          className="absolute bottom-0 left-0 right-0 px-4 pb-8 pt-4"
          style={{
            backgroundColor: PROFILE_COLORS.background,
            borderTopWidth: 1,
            borderTopColor: "#2A2A2C"
          }}
        >
          <PrimaryButton
            title="Save Changes"
            onPress={handleSaveChanges}
            loading={isPending}
          />
        </View>
      </View>

      {/* Location Picker Modal */}
      <LocationPickerModal
        visible={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onConfirm={handleLocationSelect}
        initialLocation={
          formData.location.lat && formData.location.lng
            ? {
                lat: parseFloat(formData.location.lat),
                lng: parseFloat(formData.location.lng)
              }
            : undefined
        }
      />
    </ThemedView>
  );
}
