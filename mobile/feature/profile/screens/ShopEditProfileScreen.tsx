import { View, Text, ScrollView, TouchableOpacity, Platform, Image } from "react-native";
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
    goBack,
    // Image upload
    selectedLogo,
    selectedBanner,
    isUploadingLogo,
    isUploadingBanner,
    handleLogoPick,
    handleBannerPick,
    removeLogo,
    removeBanner,
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
          {/* Shop Images Section */}
          <SectionHeader
            icon={<Ionicons name="image" size={16} color="#000" />}
            title="Shop Images"
          />

          {/* Banner Upload */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-400 mb-2 ml-1">
              Shop Banner
            </Text>
            <TouchableOpacity
              onPress={handleBannerPick}
              disabled={isUploadingBanner}
              className="relative overflow-hidden"
            >
              {isUploadingBanner ? (
                <View className="bg-gray-800 rounded-lg border-2 border-dashed border-gray-700 h-32 items-center justify-center">
                  <View className="bg-gray-700/50 rounded-full p-3 mb-2">
                    <Ionicons name="cloud-upload-outline" size={24} color="#FFCC00" />
                  </View>
                  <Text className="text-white font-medium text-sm">Uploading Banner...</Text>
                  <Text className="text-gray-500 text-xs">Please wait</Text>
                </View>
              ) : selectedBanner ? (
                <View className="relative">
                  <Image
                    source={{ uri: selectedBanner }}
                    className="w-full h-32 rounded-lg"
                    resizeMode="cover"
                  />
                  <View className="absolute inset-0 bg-black/20 rounded-lg" />
                  <View className="absolute bottom-0 left-0 right-0 bg-black/60 p-2 rounded-b-lg">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center">
                        <Ionicons name="image" size={14} color="white" />
                        <Text className="text-white text-xs ml-2">Banner Selected</Text>
                      </View>
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          removeBanner();
                        }}
                        className="bg-red-500/80 rounded-full p-1"
                      >
                        <Ionicons name="close" size={14} color="white" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ) : (
                <View className="bg-gray-800 rounded-lg border-2 border-dashed border-gray-700 h-32 items-center justify-center">
                  <View className="bg-gray-700/50 rounded-full p-3 mb-2">
                    <Ionicons name="image-outline" size={24} color="#FFCC00" />
                  </View>
                  <Text className="text-white font-medium text-sm">Add Shop Banner</Text>
                  <Text className="text-gray-500 text-xs">Recommended: 16:9 ratio</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Logo Upload */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-400 mb-2 ml-1">
              Shop Logo
            </Text>
            <TouchableOpacity
              onPress={handleLogoPick}
              disabled={isUploadingLogo}
              className="relative overflow-hidden self-start"
            >
              {isUploadingLogo ? (
                <View className="bg-gray-800 rounded-full border-2 border-dashed border-gray-700 w-24 h-24 items-center justify-center">
                  <Ionicons name="cloud-upload-outline" size={24} color="#FFCC00" />
                  <Text className="text-gray-500 text-xs mt-1">Uploading...</Text>
                </View>
              ) : selectedLogo ? (
                <View className="relative">
                  <Image
                    source={{ uri: selectedLogo }}
                    className="w-24 h-24 rounded-full"
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      removeLogo();
                    }}
                    className="absolute -top-1 -right-1 bg-red-500 rounded-full p-1"
                  >
                    <Ionicons name="close" size={14} color="white" />
                  </TouchableOpacity>
                  <View className="absolute bottom-0 right-0 bg-[#FFCC00] rounded-full p-1.5">
                    <Ionicons name="camera" size={14} color="#000" />
                  </View>
                </View>
              ) : (
                <View className="bg-gray-800 rounded-full border-2 border-dashed border-gray-700 w-24 h-24 items-center justify-center">
                  <Ionicons name="storefront-outline" size={28} color="#FFCC00" />
                  <Text className="text-gray-500 text-xs mt-1">Add Logo</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

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
            defaultCountryCode="US"
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
