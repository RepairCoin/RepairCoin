import { View, Text, ScrollView, Alert, StyleSheet } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import RNPickerSelect from "react-native-picker-select";
import { useMemo } from "react";
import { ShopFormData } from "@/shared/interfaces/shop.interface";
import { AppHeader } from "@/components/ui/AppHeader";
import FormInput from "@/components/ui/FormInput";
import SectionHeader from "@/components/ui/SectionHeader";
import PrimaryButton from "@/components/ui/PrimaryButton";

type Props = {
  handleGoBack: () => void;
  handleGoNext: () => void;
  formData: ShopFormData;
  updateFormData: <K extends keyof ShopFormData>(
    field: K,
    value: ShopFormData[K]
  ) => void;
};

export default function SecondShopRegisterSlide({
  handleGoBack,
  handleGoNext,
  formData,
  updateFormData,
}: Props) {
  // Validation function
  const validateAndProceed = () => {
    const errors = [];

    if (!formData.shopId.trim() || formData.shopId.trim().length < 3) {
      errors.push("Shop ID must be at least 3 characters");
    }

    if (!formData.name.trim() || formData.name.trim().length < 2) {
      errors.push("Company name must be at least 2 characters");
    }

    if (!formData.companySize) {
      errors.push("Please select company size");
    }

    if (!formData.monthlyRevenue) {
      errors.push("Please select monthly revenue");
    }

    if (errors.length > 0) {
      Alert.alert("Validation Error", errors.join("\n"));
      return;
    }

    handleGoNext();
  };

  // Check if all required fields are filled
  const isFormValid = useMemo(() => {
    return (
      formData.shopId.trim().length >= 3 &&
      formData.name.trim().length >= 2 &&
      formData.companySize !== "" &&
      formData.monthlyRevenue !== ""
    );
  }, [formData.shopId, formData.name, formData.companySize, formData.monthlyRevenue]);

  return (
    <View className="w-full h-full">
      {/* Header */}
      <AppHeader title="Business Info" onBackPress={handleGoBack} />

      <ScrollView
        className="flex-1 px-6"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Business Information Section */}
        <SectionHeader
          icon={<Feather name="briefcase" size={16} color="#000" />}
          title="Business Information"
        />

        <FormInput
          label="Shop ID"
          icon={<Feather name="hash" size={20} color="#FFCC00" />}
          value={formData.shopId}
          onChangeText={(value) => updateFormData("shopId", value)}
          placeholder="Enter a unique shop ID"
          autoCapitalize="none"
        />

        <FormInput
          label="Company Name"
          icon={<Feather name="briefcase" size={20} color="#FFCC00" />}
          value={formData.name}
          onChangeText={(value) => updateFormData("name", value)}
          placeholder="Enter your company name"
        />

        {/* Company Size Picker */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-400 mb-2 ml-1">
            Company Size
          </Text>
          <View className="flex-row items-center rounded-xl px-4 bg-[#2A2A2C]">
            <Feather name="users" size={20} color="#FFCC00" />
            <View className="flex-1 ml-3">
              <RNPickerSelect
                value={formData.companySize}
                onValueChange={(value) => updateFormData("companySize", value)}
                items={[
                  { label: "1-10 employees", value: "1-10" },
                  { label: "11-50 employees", value: "11-50" },
                  { label: "51-100 employees", value: "51-100" },
                  { label: "100+ employees", value: "100+" },
                ]}
                placeholder={{ label: "Select company size", value: "" }}
                style={pickerSelectStyles}
                useNativeAndroidPickerStyle={false}
              />
            </View>
            <Ionicons name="chevron-down" size={20} color="#666" />
          </View>
        </View>

        {/* Monthly Revenue Picker */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-400 mb-2 ml-1">
            Monthly Revenue
          </Text>
          <View className="flex-row items-center rounded-xl px-4 bg-[#2A2A2C]">
            <Feather name="dollar-sign" size={20} color="#FFCC00" />
            <View className="flex-1 ml-3">
              <RNPickerSelect
                value={formData.monthlyRevenue}
                onValueChange={(value) => updateFormData("monthlyRevenue", value)}
                items={[
                  { label: "Less than $10,000", value: "<10k" },
                  { label: "$10,000 - $50,000", value: "10k-50k" },
                  { label: "$50,000 - $100,000", value: "50k-100k" },
                  { label: "More than $100,000", value: "100k+" },
                ]}
                placeholder={{ label: "Select monthly revenue", value: "" }}
                style={pickerSelectStyles}
                useNativeAndroidPickerStyle={false}
              />
            </View>
            <Ionicons name="chevron-down" size={20} color="#666" />
          </View>
        </View>

        {/* Optional Fields Section */}
        <SectionHeader
          icon={<Feather name="plus-circle" size={16} color="#000" />}
          title="Optional Details"
        />

        <FormInput
          label="Website URL"
          icon={<Feather name="globe" size={20} color="#FFCC00" />}
          value={formData.website}
          onChangeText={(value) => updateFormData("website", value)}
          placeholder="https://yourwebsite.com"
          keyboardType="url"
          autoCapitalize="none"
          helperText="Your business website (optional)"
        />

        <FormInput
          label="Referral"
          icon={<Feather name="user-plus" size={20} color="#FFCC00" />}
          value={formData.referral}
          onChangeText={(value) => updateFormData("referral", value)}
          placeholder="Who referred you to RepairCoin?"
          helperText="Enter the name or company that referred you"
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
          title="Continue"
          onPress={validateAndProceed}
          disabled={!isFormValid}
        />
      </View>
    </View>
  );
}

const pickerSelectStyles = StyleSheet.create({
  inputIOS: {
    height: 48,
    fontSize: 16,
    color: "#fff",
    paddingVertical: 12,
  },
  inputAndroid: {
    height: 48,
    fontSize: 16,
    color: "#fff",
    paddingVertical: 12,
  },
  placeholder: {
    color: "#666",
  },
});
