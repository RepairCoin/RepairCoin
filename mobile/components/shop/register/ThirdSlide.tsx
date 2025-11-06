import { View, Text, TextInput, Pressable, StyleSheet, Alert } from "react-native";
import { AntDesign, Ionicons } from "@expo/vector-icons";
import RNPickerSelect from "react-native-picker-select";
import Screen from "@/components/ui/Screen";
import { CompanySize, MonthlyRevenue } from "@/utilities/GlobalTypes";
import type { ShopRegistrationFormData } from "@/services/authServices";
import { useMemo } from "react";

type Props = {
  handleGoBack: () => void;
  handleGoNext: () => void;
  formData: ShopRegistrationFormData;
  updateFormData: <K extends keyof ShopRegistrationFormData>(field: K, value: ShopRegistrationFormData[K]) => void;
  address: string;
};

export default function ThirdShopRegisterSlide({
  handleGoBack,
  handleGoNext,
  formData,
  updateFormData,
  address
}: Props) {
  // No need to update formData as wallet address is passed via prop

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
    
    // Ethereum address validation (basic check for 0x prefix and 40 hex chars)
    const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!address || !ethAddressRegex.test(address)) {
      errors.push("Please connect your wallet first");
    }
    
    // Reimbursement address is optional, but if provided should be valid
    if (formData.reimbursementAddress.trim() && !ethAddressRegex.test(formData.reimbursementAddress.trim())) {
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
      address && ethAddressRegex.test(address) &&
      (formData.reimbursementAddress.trim() === "" || ethAddressRegex.test(formData.reimbursementAddress.trim()))
    );
  }, [formData.address, formData.city, formData.country, address, formData.reimbursementAddress]);
  return (
    <Screen>
      <View className="px-10 py-20 w-[100vw]">
        <AntDesign name="left" color="white" size={25} onPress={handleGoBack} />
        <Text className="text-[#FFCC00] font-bold mt-6">
          Additional Information
        </Text>
        <View className="mt-4">
          <Text className="text-sm text-gray-300 mb-1">
           Street Address <Text className="text-[#FFCC00]">*</Text>
          </Text>
          <TextInput
            className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
            placeholder="Enter Street Address"
            placeholderTextColor="#999"
            value={formData.address}
            onChangeText={(value) => updateFormData('address', value)}
          />
        </View>
        <View className="mt-4">
          <Text className="text-sm text-gray-300 mb-1">
           City <Text className="text-[#FFCC00]">*</Text>
          </Text>
          <TextInput
            className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
            placeholder="Enter City"
            placeholderTextColor="#999"
            value={formData.city}
            onChangeText={(value) => updateFormData('city', value)}
          />
        </View>
        <View className="mt-4">
          <Text className="text-sm text-gray-300 mb-1">
           Country <Text className="text-[#FFCC00]">*</Text>
          </Text>
          <TextInput
            className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
            placeholder="Enter Country"
            placeholderTextColor="#999"
            value={formData.country}
            onChangeText={(value) => updateFormData('country', value)}
          />
        </View>
        <Text className="text-[#FFCC00] font-bold mt-14">
          Wallet Information
        </Text>
        <View className="mt-4">
          <Text className="text-sm text-gray-300 mb-1">
            Connected Wallet <Text className="text-[#FFCC00]">*</Text>
          </Text>
          <TextInput
            className="w-full h-12 bg-gray-400 text-gray-600 rounded-xl px-3 py-2 text-base"
            placeholder="Enter your wallet address..."
            placeholderTextColor="#999"
            value={address || "Connect wallet to continue"}
            editable={false}
            selectTextOnFocus={false}
          />
          <Text className="text-sm text-gray-300 mt-2">
            Used for shop operations and token management
          </Text>
        </View>
        <View className="mt-4">
          <Text className="text-sm text-gray-300 mb-1 mt-2">
            Reimbursement Address (Optional)
          </Text>
          <TextInput
            className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
            placeholder="Enter reimbursement address..."
            placeholderTextColor="#999"
            value={formData.reimbursementAddress}
            onChangeText={(value) => updateFormData('reimbursementAddress', value)}
          />
          <Text className="text-sm text-gray-300 mt-2">
            Where to receive payments for token redemptions
          </Text>
        </View>

        <Pressable
          className={`ml-auto flex-row items-center mt-10 ${!isFormValid ? 'opacity-50' : ''}`}
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
  );
}

const pickerSelectStyles = StyleSheet.create({
  inputIOS: {
    backgroundColor: "#fff",
    height: 42.3,
    borderRadius: 10.5,
    paddingHorizontal: 10
  },
  inputAndroid: {
    backgroundColor: "#fff",
    height: 42.3,
    borderRadius: 10.5,
    paddingHorizontal: 10
  },
  iconContainer: {
    top: 15,
    right: 15,
  },
  placeholder: {
    color: "#999",
  },
});