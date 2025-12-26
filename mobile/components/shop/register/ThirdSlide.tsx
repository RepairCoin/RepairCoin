import { View, Text, ScrollView, Alert, TouchableOpacity } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { ShopFormData } from "@/interfaces/shop.interface";
import { AppHeader } from "@/components/ui/AppHeader";
import FormInput from "@/components/ui/FormInput";
import SectionHeader from "@/components/ui/SectionHeader";
import PrimaryButton from "@/components/ui/PrimaryButton";
import LocationPickerModal, {
  SelectedLocation,
} from "@/components/shared/LocationPickerModal";

type Props = {
  handleGoBack: () => void;
  handleGoNext: () => void;
  formData: ShopFormData;
  updateFormData: <K extends keyof ShopFormData>(
    field: K,
    value: ShopFormData[K]
  ) => void;
  address: string;
};

export default function ThirdShopRegisterSlide({
  handleGoBack,
  handleGoNext,
  formData,
  updateFormData,
  address,
}: Props) {
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  // Handle location selection from map
  const handleLocationSelect = (location: SelectedLocation) => {
    updateFormData("location", {
      ...formData.location,
      lat: location.lat.toString(),
      lng: location.lng.toString(),
    });
    setShowLocationPicker(false);
  };

  // Validation function
  const validateAndProceed = () => {
    const errors = [];

    if (!formData.address.trim() || formData.address.trim().length < 3) {
      errors.push("Street address must be at least 3 characters");
    }

    if (!formData.city.trim() || formData.city.trim().length < 2) {
      errors.push("City must be at least 2 characters");
    }

    if (!formData.country.trim() || formData.country.trim().length < 2) {
      errors.push("Country must be at least 2 characters");
    }

    // Ethereum address validation
    const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!address || !ethAddressRegex.test(address)) {
      errors.push("Please connect your wallet first");
    }

    // Reimbursement address is optional, but if provided should be valid
    if (
      formData.reimbursementAddress.trim() &&
      !ethAddressRegex.test(formData.reimbursementAddress.trim())
    ) {
      errors.push("If provided, reimbursement address must be valid (0x...)");
    }

    if (errors.length > 0) {
      Alert.alert("Validation Error", errors.join("\n"));
      return;
    }

    handleGoNext();
  };

  // Check if all required fields are filled
  const isFormValid = useMemo(() => {
    const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    return (
      formData.address.trim().length >= 3 &&
      formData.city.trim().length >= 2 &&
      formData.country.trim().length >= 2 &&
      address &&
      ethAddressRegex.test(address) &&
      (formData.reimbursementAddress.trim() === "" ||
        ethAddressRegex.test(formData.reimbursementAddress.trim()))
    );
  }, [
    formData.address,
    formData.city,
    formData.country,
    address,
    formData.reimbursementAddress,
  ]);

  return (
    <>
      <View className="w-full h-full">
        {/* Header */}
        <AppHeader title="Location & Wallet" onBackPress={handleGoBack} />

        <ScrollView
          className="flex-1 px-6"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {/* Location Section */}
          <SectionHeader
            icon={<Ionicons name="location" size={16} color="#000" />}
            title="Shop Location"
          />

          <FormInput
            label="Street Address"
            icon={<Ionicons name="location-outline" size={20} color="#FFCC00" />}
            value={formData.address}
            onChangeText={(value) => updateFormData("address", value)}
            placeholder="Enter your street address"
          />

          <FormInput
            label="City"
            icon={<Ionicons name="business-outline" size={20} color="#FFCC00" />}
            value={formData.city}
            onChangeText={(value) => updateFormData("city", value)}
            placeholder="Enter your city"
          />

          <FormInput
            label="Country"
            icon={<Feather name="flag" size={20} color="#FFCC00" />}
            value={formData.country}
            onChangeText={(value) => updateFormData("country", value)}
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

          {/* Wallet Section */}
          <SectionHeader
            icon={<Ionicons name="wallet" size={16} color="#000" />}
            title="Wallet Information"
          />

          <FormInput
            label="Connected Wallet"
            icon={<Ionicons name="wallet-outline" size={20} color="#666" />}
            value={address || "Connect wallet to continue"}
            onChangeText={() => {}}
            placeholder="Wallet address"
            editable={false}
            helperText="Used for shop operations and token management"
          />

          <FormInput
            label="Reimbursement Address (Optional)"
            icon={<Ionicons name="card-outline" size={20} color="#FFCC00" />}
            value={formData.reimbursementAddress}
            onChangeText={(value) =>
              updateFormData("reimbursementAddress", value)
            }
            placeholder="Enter reimbursement address (0x...)"
            autoCapitalize="none"
            helperText="Where to receive payments for token redemptions"
          />

          {/* Info Note */}
          <View className="bg-[#2A2A2C] rounded-xl p-4 mt-2 flex-row">
            <Ionicons name="information-circle" size={20} color="#FFCC00" />
            <Text className="text-gray-400 text-sm ml-3 flex-1">
              Your wallet address will be used for all token operations. The
              reimbursement address is optional and can be set later.
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
            title="Continue"
            onPress={validateAndProceed}
            disabled={!isFormValid}
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
                lng: parseFloat(formData.location.lng),
              }
            : undefined
        }
      />
    </>
  );
}
