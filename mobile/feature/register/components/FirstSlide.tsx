import { View, Text, ScrollView, Alert } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { AppHeader } from "@/shared/components/ui/AppHeader";
import CountryPicker from "react-native-country-picker-modal";
import { MaskedTextInput } from "react-native-mask-text";
import { useMemo } from "react";
import FormInput from "@/shared/components/ui/FormInput";
import SectionHeader from "@/shared/components/ui/SectionHeader";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import { FirstSlideProps } from "../types";
import { validateShopFirstSlide, isValidEmail, isValidPhone, hasMinLength } from "../utils";

export default function FirstSlide({
  handleGoBack,
  handleGoNext,
  formData,
  updateFormData,
  countryCode,
  setCountryCode,
}: FirstSlideProps) {
  const validateAndProceed = () => {
    const errors = validateShopFirstSlide(
      formData.firstName,
      formData.lastName,
      formData.email,
      formData.phone
    );

    if (errors.length > 0) {
      Alert.alert("Validation Error", errors.join("\n"));
      return;
    }

    handleGoNext();
  };

  const isFormValid = useMemo(() => {
    return (
      hasMinLength(formData.firstName, 2) &&
      hasMinLength(formData.lastName, 2) &&
      isValidEmail(formData.email) &&
      isValidPhone(formData.phone)
    );
  }, [formData.firstName, formData.lastName, formData.email, formData.phone]);

  return (
    <View className="w-full h-full">
      <AppHeader title="Register Shop" onBackPress={handleGoBack} />

      <ScrollView
        className="flex-1 px-6"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <View className="mt-4 mb-2">
          <Text className="text-[#FFCC00] font-bold text-2xl">
            Welcome Partner!
          </Text>
          <Text className="text-gray-400 text-sm mt-2">
            Join our partner network, attract new customers, and reward loyalty
            with every service you provide.
          </Text>
        </View>

        <SectionHeader
          icon={<Feather name="user" size={16} color="#000" />}
          title="Personal Information"
        />

        <FormInput
          label="First Name"
          icon={<Feather name="user" size={20} color="#FFCC00" />}
          value={formData.firstName}
          onChangeText={(value) => updateFormData("firstName", value)}
          placeholder="Enter your first name"
          autoCapitalize="words"
        />

        <FormInput
          label="Last Name"
          icon={<Feather name="user" size={20} color="#FFCC00" />}
          value={formData.lastName}
          onChangeText={(value) => updateFormData("lastName", value)}
          placeholder="Enter your last name"
          autoCapitalize="words"
        />

        <SectionHeader
          icon={<Feather name="phone" size={16} color="#000" />}
          title="Contact Information"
        />

        <FormInput
          label="Email Address"
          icon={<Feather name="mail" size={20} color="#FFCC00" />}
          value={formData.email}
          onChangeText={(value) => updateFormData("email", value)}
          placeholder="Enter your email address"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-400 mb-2 ml-1">
            Phone Number
          </Text>
          <View className="flex-row items-center rounded-xl px-4 bg-[#2A2A2C]">
            <Feather name="phone" size={20} color="#FFCC00" />
            <View className="ml-3 border-r border-gray-600 pr-2">
              <CountryPicker
                countryCode={countryCode}
                withFilter
                withFlag
                withCallingCode
                withEmoji
                onSelect={(country) => setCountryCode(country.cca2)}
                containerButtonStyle={{
                  paddingVertical: 12,
                }}
              />
            </View>
            <MaskedTextInput
              mask="(999) 999-9999"
              className="flex-1 h-12 text-white text-base ml-2"
              placeholder="(000) 000-0000"
              placeholderTextColor="#666"
              keyboardType="phone-pad"
              value={formData.phone}
              onChangeText={(masked) => updateFormData("phone", masked)}
            />
          </View>
        </View>

        <View className="bg-[#2A2A2C] rounded-xl p-4 mt-2 flex-row">
          <Ionicons name="information-circle" size={20} color="#FFCC00" />
          <Text className="text-gray-400 text-sm ml-3 flex-1">
            Your personal information is secure and will only be used for
            account verification and communication purposes.
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
        <PrimaryButton
          title="Continue"
          onPress={validateAndProceed}
          disabled={!isFormValid}
        />
      </View>
    </View>
  );
}
