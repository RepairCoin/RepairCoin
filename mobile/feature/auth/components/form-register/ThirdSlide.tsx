import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { Controller, useWatch, useFormContext } from "react-hook-form";
import { Feather, Ionicons } from "@expo/vector-icons";
import FormInput from "@/shared/components/ui/FormInput";
import SectionHeader from "@/shared/components/ui/SectionHeader";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import LocationPickerModal, {
  SelectedLocation,
} from "@/shared/components/shared/LocationPickerModal";
import { reverseGeocode } from "@/feature/find-shop/services/geocoding.services";
import { ThirdSlideProps } from "../../types";
import type { ShopRegisterData } from "../../dto/register.dto";

export default function ThirdSlide({
  handleGoNext,
  address,
}: ThirdSlideProps) {
  const { control, setValue, formState: { errors } } = useFormContext<ShopRegisterData>();
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const location = useWatch({ control, name: "location" });

  return (
    <>
      <View className="w-full h-full">
        <ScrollView
          className="flex-1 px-6"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          <SectionHeader
            title="Shop Location"
            customClassName="text-[#FFCC00]"
          />

          <Controller
            control={control}
            name="address"
            render={({ field: { onChange, value } }) => (
              <FormInput
                label="Street Address"
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
            render={() => (
              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-200 mb-2 ml-1">
                  Pin Location on Map
                </Text>
                <TouchableOpacity
                  onPress={() => setShowLocationPicker(true)}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center rounded-xl px-4 py-3 bg-white">
                    <View className="flex-1">
                      {location?.lat && location?.lng ? (
                        <Text className="text-black text-base">
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
                  onConfirm={async (loc: SelectedLocation) => {
                    setValue("location", {
                      lat: loc.lat.toString(),
                      lng: loc.lng.toString(),
                      city: "", state: "", zipCode: "",
                    }, { shouldValidate: true });

                    const result = await reverseGeocode(loc.lat, loc.lng);
                    if (result) {
                      setValue("address", result.address, { shouldValidate: true });
                      setValue("city", result.city || "", { shouldValidate: true });
                      setValue("country", result.country || "", { shouldValidate: true });
                    }

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
            title="Wallet Information"
            customClassName="text-[#FFCC00]"
          />

          <FormInput
            label="Connected Wallet"
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
                value={value}
                onChangeText={onChange}
                placeholder="Enter reimbursement address (0x...)"
                autoCapitalize="none"
                maxLength={42}
                helperText="Where to receive payments for token redemptions"
              />
            )}
          />

          <View className="bg-[#FFCC00]/10 rounded-xl p-4 mt-4 flex-row border border-[#FFCC00]/30">
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
