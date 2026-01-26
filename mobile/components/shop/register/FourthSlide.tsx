import { View, Text, ScrollView } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import Checkbox from "expo-checkbox";
import { ShopFormData } from "@/shared/interfaces/shop.interface";
import { AppHeader } from "@/components/ui/AppHeader";
import FormInput from "@/components/ui/FormInput";
import SectionHeader from "@/components/ui/SectionHeader";
import PrimaryButton from "@/components/ui/PrimaryButton";

type Props = {
  handleGoBack: () => void;
  handleSubmit: () => void;
  formData: ShopFormData;
  updateFormData: <K extends keyof ShopFormData>(
    field: K,
    value: ShopFormData[K]
  ) => void;
  isLoading?: boolean;
};

export default function FourthShopRegisterSlide({
  handleGoBack,
  handleSubmit,
  formData,
  updateFormData,
  isLoading = false,
}: Props) {
  const termsItems = [
    "Your shop will need admin verification before activation",
    "You'll be able to purchase RCN at $100 each",
    "Tier bonuses will be automatically deducted from your RCN balance",
    "Cross-shop redemption can be enabled after verification",
    "All transactions are recorded on the blockchain",
    "You agree to comply with all RepairCoin network policies",
  ];

  return (
    <View className="w-full h-full">
      {/* Header */}
      <AppHeader title="Review & Submit" onBackPress={handleGoBack} />

      <ScrollView
        className="flex-1 px-6"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Optional Fields Section */}
        <SectionHeader
          icon={<Feather name="plus-circle" size={16} color="#000" />}
          title="Additional Details (Optional)"
        />

        <FormInput
          label="State / Province"
          icon={<Ionicons name="map-outline" size={20} color="#FFCC00" />}
          value={formData.location.state}
          onChangeText={(value) =>
            updateFormData("location", { ...formData.location, state: value })
          }
          placeholder="Enter state or province"
        />

        <FormInput
          label="Zip / Postal Code"
          icon={<Ionicons name="pin-outline" size={20} color="#FFCC00" />}
          value={formData.location.zipCode}
          onChangeText={(value) =>
            updateFormData("location", { ...formData.location, zipCode: value })
          }
          placeholder="Enter zip or postal code"
          keyboardType="default"
        />

        <FormInput
          label="FixFlow Shop ID"
          icon={<Feather name="link" size={20} color="#FFCC00" />}
          value={formData.fixflowShopId}
          onChangeText={(value) => updateFormData("fixflowShopId", value)}
          placeholder="Enter FixFlow Shop ID"
          helperText="If you use FixFlow for your repair business"
        />

        {/* Terms and Conditions Section */}
        <SectionHeader
          icon={<Ionicons name="document-text" size={16} color="#000" />}
          title="Terms and Conditions"
        />

        <View className="bg-[#2A2A2C] rounded-xl p-4">
          {termsItems.map((item, index) => (
            <View key={index} className="flex-row items-start mb-3">
              <View className="w-6 h-6 rounded-full bg-[#FFCC00]/20 items-center justify-center mr-3 mt-0.5">
                <Ionicons name="checkmark" size={14} color="#FFCC00" />
              </View>
              <Text className="text-gray-300 text-sm flex-1">{item}</Text>
            </View>
          ))}
        </View>

        {/* Checkbox */}
        <View className="flex-row items-start mt-6 mb-4">
          <Checkbox
            value={formData.acceptTerms}
            onValueChange={(value) => updateFormData("acceptTerms", value)}
            color={formData.acceptTerms ? "#FFCC00" : undefined}
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              borderColor: formData.acceptTerms ? "#FFCC00" : "#666",
            }}
          />
          <Text className="ml-3 text-gray-300 text-sm flex-1">
            I confirm that I have read and accept the terms and conditions and
            privacy policy.
          </Text>
        </View>

        {/* Info Note */}
        <View className="bg-[#FFCC00]/10 rounded-xl p-4 flex-row border border-[#FFCC00]/30">
          <Ionicons name="shield-checkmark" size={20} color="#FFCC00" />
          <Text className="text-gray-300 text-sm ml-3 flex-1">
            By registering, you're joining our network of trusted repair shops.
            Our team will review your application within 1-2 business days.
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
          title={isLoading ? "Registering..." : "Register Shop"}
          onPress={handleSubmit}
          disabled={!formData.acceptTerms || isLoading}
          loading={isLoading}
        />
      </View>
    </View>
  );
}
