import { useState } from "react";
import { AntDesign, Feather, Ionicons } from "@expo/vector-icons";
import { goBack } from "expo-router/build/global-state/routing";
import {
  View,
  Text,
  Platform,
  ScrollView,
  Alert,
  TouchableOpacity,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import PrimaryButton from "@/components/ui/PrimaryButton";
import { ThemedView } from "@/components/ui/ThemedView";
import FormInput from "@/components/ui/FormInput";
import SectionHeader from "@/components/ui/SectionHeader";
import LocationPickerModal, {
  SelectedLocation,
} from "@/components/shared/LocationPickerModal";
import { useAuthStore } from "@/store/auth.store";
import { useShop } from "@/hooks/shop/useShop";

export default function EditShopProfilePage() {
  const { account } = useAuthStore();
  const { useGetShopByWalletAddress, useUpdateShop } = useShop();
  const { data: shopData } = useGetShopByWalletAddress(account?.address || "");
  const updateShopMutation = useUpdateShop(account?.address || "");

  const [shopFormData, setShopFormData] = useState({
    name: shopData?.name || "",
    email: shopData?.email || "",
    phone: shopData?.phone || "",
    address: shopData?.address || "",
    city: shopData?.location?.city || "",
    country: shopData?.country || "",
    facebook: shopData?.facebook || "",
    twitter: shopData?.twitter || "",
    instagram: shopData?.instagram || "",
    website: shopData?.website || "",
    walletAddress: shopData?.walletAddress || "",
    location: {
      lat: shopData?.location?.lat || "",
      lng: shopData?.location?.lng || "",
      city: shopData?.location?.city || "",
      state: shopData?.location?.state || "",
      zipCode: shopData?.location?.zipCode || "",
    },
  });

  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const handleSaveChanges = async () => {
    if (!shopData?.shopId) {
      Alert.alert("Error", "Shop ID not found");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(shopFormData.email)) {
      Alert.alert("Error", "Please enter a valid email address");
      return;
    }

    try {
      await updateShopMutation.mutateAsync({
        shopId: shopData.shopId,
        shopData: shopFormData as any,
      });
      Alert.alert("Success", "Shop details updated successfully", [
        { text: "OK", onPress: () => goBack() },
      ]);
    } catch (error) {
      Alert.alert("Error", "Failed to update shop details");
    }
  };

  const updateField = (field: string) => (text: string) => {
    setShopFormData({ ...shopFormData, [field]: text });
  };

  const handleLocationSelect = (location: SelectedLocation) => {
    setShopFormData({
      ...shopFormData,
      location: {
        ...shopFormData.location,
        lat: location.lat.toString(),
        lng: location.lng.toString(),
      },
    });
    setShowLocationPicker(false);
  };

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
            paddingHorizontal: 16,
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
            icon={<Feather name="shopping-bag" size={20} color="#FFCC00" />}
            value={shopFormData.name}
            onChangeText={updateField("name")}
            placeholder="Enter your shop name"
          />

          <FormInput
            label="Wallet Address"
            icon={<Ionicons name="wallet-outline" size={20} color="#666" />}
            value={shopFormData.walletAddress}
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
            icon={<Ionicons name="location-outline" size={20} color="#FFCC00" />}
            value={shopFormData.address}
            onChangeText={updateField("address")}
            placeholder="Enter your street address"
          />

          <FormInput
            label="City"
            icon={<Ionicons name="business-outline" size={20} color="#FFCC00" />}
            value={shopFormData.city}
            onChangeText={updateField("city")}
            placeholder="Enter your city"
          />

          <FormInput
            label="Country"
            icon={<Feather name="flag" size={20} color="#FFCC00" />}
            value={shopFormData.country}
            onChangeText={updateField("country")}
            placeholder="Enter your country"
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
                  {shopFormData.location.lat && shopFormData.location.lng ? (
                    <Text className="text-white text-base">
                      {parseFloat(shopFormData.location.lat).toFixed(6)}, {parseFloat(shopFormData.location.lng).toFixed(6)}
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
            icon={<Feather name="mail" size={20} color="#FFCC00" />}
            value={shopFormData.email}
            onChangeText={updateField("email")}
            placeholder="Enter your email address"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <FormInput
            label="Phone Number"
            icon={<Feather name="phone" size={20} color="#FFCC00" />}
            value={shopFormData.phone}
            onChangeText={updateField("phone")}
            placeholder="Enter your phone number"
            keyboardType="phone-pad"
          />

          <FormInput
            label="Website"
            icon={<Feather name="globe" size={20} color="#FFCC00" />}
            value={shopFormData.website}
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
            icon={<Feather name="facebook" size={20} color="#FFCC00" />}
            value={shopFormData.facebook}
            onChangeText={updateField("facebook")}
            placeholder="Facebook profile URL"
            keyboardType="url"
            autoCapitalize="none"
          />

          <FormInput
            label="Twitter"
            icon={<Feather name="twitter" size={20} color="#FFCC00" />}
            value={shopFormData.twitter}
            onChangeText={updateField("twitter")}
            placeholder="Twitter handle or URL"
            keyboardType="url"
            autoCapitalize="none"
          />

          <FormInput
            label="Instagram"
            icon={<Feather name="instagram" size={20} color="#FFCC00" />}
            value={shopFormData.instagram}
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
            backgroundColor: "#121212",
            borderTopWidth: 1,
            borderTopColor: "#2A2A2C",
          }}
        >
          <PrimaryButton
            title="Save Changes"
            onPress={handleSaveChanges}
            loading={updateShopMutation.isPending}
          />
        </View>
      </View>

      {/* Location Picker Modal */}
      <LocationPickerModal
        visible={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onConfirm={handleLocationSelect}
        initialLocation={
          shopFormData.location.lat && shopFormData.location.lng
            ? {
                lat: parseFloat(shopFormData.location.lat),
                lng: parseFloat(shopFormData.location.lng),
              }
            : undefined
        }
      />
    </ThemedView>
  );
}
