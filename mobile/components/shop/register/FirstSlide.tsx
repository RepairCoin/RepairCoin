import { View, Text, TextInput, Pressable, Alert } from "react-native";
import { AntDesign, Ionicons } from "@expo/vector-icons";
import CountryPicker, { CountryCode } from "react-native-country-picker-modal";
import { MaskedTextInput } from "react-native-mask-text";
import Screen from "@/components/ui/Screen";
import { useMemo } from "react";
import { ShopFormData } from "@/interfaces/shop.interface";

type Props = {
  handleGoBack: () => void;
  handleGoNext: () => void;
  formData: ShopFormData;
  updateFormData: <K extends keyof ShopFormData>(field: K, value: ShopFormData[K]) => void;
  countryCode: CountryCode;
  setCountryCode: (code: CountryCode) => void;
}

export default function FirstShopRegisterSlide ({
  handleGoBack, handleGoNext, formData, updateFormData, countryCode, setCountryCode
}: Props) {
  // Validation function
  const validateAndProceed = () => {
    const errors = [];
    
    if (!formData.firstName.trim() || formData.firstName.trim().length < 2) {
      errors.push("First name must be at least 2 characters");
    }
    
    if (!formData.lastName.trim() || formData.lastName.trim().length < 2) {
      errors.push("Last name must be at least 2 characters");
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim() || !emailRegex.test(formData.email.trim())) {
      errors.push("Please enter a valid email address");
    }
    
    // Phone validation - checking if it has 14 characters (xxx) xxx-xxxx
    if (!formData.phone || formData.phone.replace(/\D/g, '').length !== 10) {
      errors.push("Please enter a complete phone number");
    }
    
    if (errors.length > 0) {
      Alert.alert("Validation Error", errors.join("\n"));
      return;
    }
    
    handleGoNext();
  };

  // Check if all fields are filled to enable/disable button
  const isFormValid = useMemo(() => {
    return (
      formData.firstName.trim().length >= 2 &&
      formData.lastName.trim().length >= 2 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim()) &&
      formData.phone.replace(/\D/g, '').length === 10
    );
  }, [formData.firstName, formData.lastName, formData.email, formData.phone]);
  return (
    <Screen>
      <View className="px-10 py-20 w-[100vw]">
        <AntDesign name="left" color="white" size={25} onPress={handleGoBack} />
        <Text className="text-[#FFCC00] font-extrabold text-[32px] mt-4">
          Register as Shop
        </Text>
        <Text className="text-white text-[12px] my-4">
          Join our partner network, attract new customers,{"\n"}
          and reward loyalty with every service you provide.
        </Text>
        <Text className="text-[#FFCC00] font-bold mt-8">Personal Information</Text>
        <View className="mt-4">
          <Text className="text-sm text-gray-300 mb-1">First Name{' '}<Text className="text-[#FFCC00]">*</Text></Text>
          <TextInput
            className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
            placeholder="Enter Your First Name"
            placeholderTextColor="#999"
            value={formData.firstName}
            onChangeText={(value) => updateFormData('firstName', value)}
          />
        </View>
        <View className="mt-4">
          <Text className="text-sm text-gray-300 mb-1">Last Name{' '}<Text className="text-[#FFCC00]">*</Text></Text>
          <TextInput
            className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
            placeholder="Enter Your Last Name"
            placeholderTextColor="#999"
            value={formData.lastName}
            onChangeText={(value) => updateFormData('lastName', value)}
          />
        </View>
        <View className="mt-4">
          <Text className="text-sm text-gray-300 mb-1">Email{' '}<Text className="text-[#FFCC00]">*</Text></Text>
          <TextInput
            className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
            placeholder="Enter Email"
            placeholderTextColor="#999"
            value={formData.email}
            onChangeText={(value) => updateFormData('email', value)}
          />
        </View>
        <View className="mt-4 mb-10">
          <Text className="text-sm text-gray-300 mb-1">Phone Number{' '}<Text className="text-[#FFCC00]">*</Text></Text>
          <View className="flex-row bg-white h-12 items-center px-3 rounded-xl">
            <CountryPicker
              countryCode={countryCode}
              withFilter
              withFlag
              withCallingCode
              withEmoji
              onSelect={(country) => setCountryCode(country.cca2)}
            />
            <MaskedTextInput
              mask="(999) 999-9999"
              className="h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
              placeholder="(000) 000-0000"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
              value={formData.phone}
              onChangeText={(masked) => updateFormData('phone', masked)}
            />
          </View>
        </View>

        <Pressable 
          className={`ml-auto flex-row items-center mt-4 ${!isFormValid ? 'opacity-50' : ''}`} 
          onPress={validateAndProceed}
          disabled={!isFormValid}
        >
          <Text className={`text-base mr-2 ${isFormValid ? 'text-white' : 'text-gray-400'}`}>
            Continue Registration
          </Text>
          <Ionicons name="arrow-forward" color={isFormValid ? "yellow" : "#9CA3AF"} size={20} />
        </Pressable>
      </View>
    </Screen>
  )
}