import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { Controller, useWatch } from "react-hook-form";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { AppHeader } from "@/shared/components/ui/AppHeader";
import FormInput from "@/shared/components/ui/FormInput";
import SectionHeader from "@/shared/components/ui/SectionHeader";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import LocationPickerModal, {
  SelectedLocation,
} from "@/shared/components/shared/LocationPickerModal";
import { ThirdSlideProps } from "../types";

export default function ThirdSlide({
  handleGoBack,
  handleGoNext,
  control,
  errors,
  address,
}: ThirdSlideProps) {
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const location = useWatch({ control, name: "location" });

  return (
    <>
      <View className="w-full h-full">
        <AppHeader title="Location & Wallet" onBackPress={handleGoBack} />

        <ScrollView
          className="flex-1 px-6"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          <SectionHeader
            icon={<Ionicons name="location" size={16} color="#000" />}
            title="Shop Location"
          />

          <Controller
            control={control}
            name="address"
            render={({ field: { onChange, value } }) => (
              <FormInput
                label="Street Address"
                icon={<Ionicons name="location-outline" size={20} color="#FFCC00" />}
                value={value}
                onChangeText={onChange}
                placeholder="Enter your street address"
                maxLength={255}
                error={errors.address?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="city"
            render={({ field: { onChange, value } }) => (
              <FormInput
                label="City"
                icon={<Ionicons name="business-outline" size={20} color="#FFCC00" />}
                value={value}
                onChangeText={onChange}
                placeholder="Enter your city"
                maxLength={100}
                error={errors.city?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="country"
            render={({ field: { onChange, value } }) => (
              <FormInput
                label="Country"
                icon={<Feather name="flag" size={20} color="#FFCC00" />}
                value={value}
                onChangeText={onChange}
                placeholder="Enter your country"
                maxLength={100}
                error={errors.country?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="location"
            render={({ field: { onChange } }) => (
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
                      {location?.lat && location?.lng ? (
                        <Text className="text-white text-base">
                          {parseFloat(location.lat).toFixed(6)},{" "}
                          {parseFloat(location.lng).toFixed(6)}
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

                <LocationPickerModal
                  visible={showLocationPicker}
                  onClose={() => setShowLocationPicker(false)}
                  onConfirm={(loc: SelectedLocation) => {
                    onChange({
                      ...location,
                      lat: loc.lat.toString(),
                      lng: loc.lng.toString(),
                    });
                    setShowLocationPicker(false);
                  }}
                  initialLocation={
                    location?.lat && location?.lng
                      ? {
                          lat: parseFloat(location.lat),
                          lng: parseFloat(location.lng),
                        }
                      : undefined
                  }
                />
              </View>
            )}
          />

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
            error={!address ? "Wallet not connected — return to the welcome screen and reconnect to continue." : undefined}
            helperText={address ? "Used for shop operations and token management" : undefined}
          />

          <Controller
            control={control}
            name="reimbursementAddress"
            render={({ field: { onChange, value } }) => (
              <FormInput
                label="Reimbursement Address (Optional)"
                icon={<Ionicons name="card-outline" size={20} color="#FFCC00" />}
                value={value}
                onChangeText={onChange}
                placeholder="Enter reimbursement address (0x...)"
                autoCapitalize="none"
                maxLength={42}
                helperText="Where to receive payments for token redemptions"
              />
            )}
          />

          <View className="bg-[#2A2A2C] rounded-xl p-4 mt-2 flex-row">
            <Ionicons name="information-circle" size={20} color="#FFCC00" />
            <Text className="text-gray-400 text-sm ml-3 flex-1">
              Your wallet address will be used for all token operations. The
              reimbursement address is optional and can be set later.
            </Text>
          </View>
        </ScrollView>

        <View
          className="absolute bottom-0 left-0 right-0 px-4 pb-8 pt-4"
          style={{
            backgroundColor: "#121212",
            borderTopWidth: 1,
            borderTopColor: "#2A2A2C",
          }}
        >
          <PrimaryButton title="Continue" onPress={handleGoNext} />
        </View>
      </View>
    </>
  );
}
