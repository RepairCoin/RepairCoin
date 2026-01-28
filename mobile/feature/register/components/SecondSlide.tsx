import { View, Text, ScrollView, Alert } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import RNPickerSelect from "react-native-picker-select";
import { useMemo } from "react";
import { AppHeader } from "@/shared/components/ui/AppHeader";
import FormInput from "@/shared/components/ui/FormInput";
import SectionHeader from "@/shared/components/ui/SectionHeader";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import { NavigableSlideProps } from "../types";
import { COMPANY_SIZE_OPTIONS, MONTHLY_REVENUE_OPTIONS, pickerSelectStyles } from "../constants";
import { validateShopSecondSlide, hasMinLength } from "../utils";

export default function SecondSlide({
  handleGoBack,
  handleGoNext,
  formData,
  updateFormData,
}: NavigableSlideProps) {
  const validateAndProceed = () => {
    const errors = validateShopSecondSlide(
      formData.name,
      formData.companySize,
      formData.monthlyRevenue
    );

    if (errors.length > 0) {
      Alert.alert("Validation Error", errors.join("\n"));
      return;
    }

    handleGoNext();
  };

  const isFormValid = useMemo(() => {
    return (
      hasMinLength(formData.name, 2) &&
      formData.companySize !== "" &&
      formData.monthlyRevenue !== ""
    );
  }, [formData.name, formData.companySize, formData.monthlyRevenue]);

  return (
    <View className="w-full h-full">
      <AppHeader title="Business Info" onBackPress={handleGoBack} />

      <ScrollView
        className="flex-1 px-6"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <SectionHeader
          icon={<Feather name="briefcase" size={16} color="#000" />}
          title="Business Information"
        />

        <FormInput
          label="Company Name"
          icon={<Feather name="briefcase" size={20} color="#FFCC00" />}
          value={formData.name}
          onChangeText={(value) => updateFormData("name", value)}
          placeholder="Enter your company name"
        />

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
                items={COMPANY_SIZE_OPTIONS}
                placeholder={{ label: "Select company size", value: "" }}
                style={pickerSelectStyles}
                useNativeAndroidPickerStyle={false}
              />
            </View>
            <Ionicons name="chevron-down" size={20} color="#666" />
          </View>
        </View>

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
                items={MONTHLY_REVENUE_OPTIONS}
                placeholder={{ label: "Select monthly revenue", value: "" }}
                style={pickerSelectStyles}
                useNativeAndroidPickerStyle={false}
              />
            </View>
            <Ionicons name="chevron-down" size={20} color="#666" />
          </View>
        </View>

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
