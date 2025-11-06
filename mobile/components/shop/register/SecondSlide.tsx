import { View, Text, TextInput, Pressable, StyleSheet, Alert } from "react-native";
import { AntDesign, Ionicons } from "@expo/vector-icons";
import RNPickerSelect from "react-native-picker-select";
import Screen from "@/components/ui/Screen";
import { CompanySize, MonthlyRevenue } from "@/utilities/GlobalTypes";
import type { ShopRegistrationFormData } from "@/app/(auth)/register/shop/index";
import { useMemo } from "react";

type Props = {
  handleGoBack: () => void;
  handleGoNext: () => void;
  formData: ShopRegistrationFormData;
  updateFormData: <K extends keyof ShopRegistrationFormData>(field: K, value: ShopRegistrationFormData[K]) => void;
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
    const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
    return (
      formData.shopId.trim().length >= 3 &&
      formData.name.trim().length >= 2 &&
      formData.companySize !== "" &&
      formData.monthlyRevenue !== "" 
    );
  }, [formData.shopId, formData.name, formData.companySize, formData.monthlyRevenue]);
  return (
    <Screen>
      <View className="px-10 py-20 w-[100vw]">
        <AntDesign name="left" color="white" size={25} onPress={handleGoBack} />
        <Text className="text-[#FFCC00] font-bold mt-6">
          Bussiness Information
        </Text>
        <View className="mt-4">
          <Text className="text-sm text-gray-300 mb-1">
            Shop ID <Text className="text-[#FFCC00]">*</Text>
          </Text>
          <TextInput
            className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
            placeholder="Enter Shop ID"
            placeholderTextColor="#999"
            value={formData.shopId}
            onChangeText={(value) => updateFormData('shopId', value)}
          />
        </View>
        <View className="mt-4">
          <Text className="text-sm text-gray-300 mb-1">
            Company Name <Text className="text-[#FFCC00]">*</Text>
          </Text>
          <TextInput
            className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
            placeholder="Enter Company Name"
            placeholderTextColor="#999"
            value={formData.name}
            onChangeText={(value) => updateFormData('name', value)}
          />
        </View>
        <View className="mt-4">
          <Text className="text-sm text-gray-300 mb-1">
            Company Size <Text className="text-[#FFCC00]">*</Text>
          </Text>
          <RNPickerSelect
            value={formData.companySize}
            onValueChange={(value) => updateFormData('companySize', value)}
            items={[
              { label: "1-10 employees", value: "1-10" },
              { label: "11-50 employees", value: "11-50" },
              { label: "51-100 employees", value: "51-100" },
              { label: "100+ employees", value: "100+" }
            ]}
            placeholder={{ label: "Select Company Size", value: "" }}
            style={pickerSelectStyles}
            Icon={() => (
              <AntDesign name="down" />
            )}
            useNativeAndroidPickerStyle={false}
          />
        </View>
        <View className="mt-4">
          <Text className="text-sm text-gray-300 mb-1">
            Monthly Revenue <Text className="text-[#FFCC00]">*</Text>
          </Text>
          <RNPickerSelect
            value={formData.monthlyRevenue}
            onValueChange={(value) => updateFormData('monthlyRevenue', value)}
            items={[
              { label: "Less than $10,000", value: "<10k" },
              { label: "$10,000 - $50,000", value: "10k-50k" },
              { label: "$50,000 - $100,000", value: "50k-100k" },
              { label: "More than $100,000", value: "100k+" }
            ]}
            placeholder={{ label: "Select Monthly Revenue", value: "" }}
            style={pickerSelectStyles}
            Icon={() => (
              <AntDesign name="down" />
            )}
            useNativeAndroidPickerStyle={false}
          />
        </View>
        <View className="mt-4">
          <Text className="text-sm text-gray-300 mb-1">
            Website URL (Optional)
          </Text>
          <TextInput
            className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
            placeholder="Enter your business website url"
            placeholderTextColor="#999"
            value={formData.website}
            onChangeText={(value) => updateFormData('website', value)}
          />
        </View>
        <View className="mt-4">
          <Text className="text-sm text-gray-300 mb-1">
            Referral (Optional)
          </Text>
          <TextInput
            className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
            placeholder="Who referred you to RepairCoin"
            placeholderTextColor="#999"
            value={formData.referral}
            onChangeText={(value) => updateFormData('referral', value)}
          />
          <Text className="text-sm text-gray-300 mt-2">
            Enter the name or company that referred you.
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