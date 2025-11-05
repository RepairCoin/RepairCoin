import { View, Text, TextInput, Pressable, Alert } from "react-native";
import { AntDesign, Ionicons } from "@expo/vector-icons";
import Screen from "@/components/ui/Screen";
import type { ShopRegistrationFormData } from "@/app/(auth)/register/shop/index";
import { useMemo } from "react";

type Props = {
  handleGoBack: () => void;
  handleGoNext: () => void;
  formData: ShopRegistrationFormData;
  updateFormData: <K extends keyof ShopRegistrationFormData>(field: K, value: ShopRegistrationFormData[K]) => void;
};

export default function SocialMediaSlide({
  handleGoBack,
  handleGoNext,
  formData,
  updateFormData,
}: Props) {
  // Validation function - all social media fields are optional
  const validateAndProceed = () => {
    const errors = [];
    
    // Basic URL validation for social media links if provided
    const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-@]*)*\/?$/;
    
    if (formData.facebookUrl && formData.facebookUrl.trim() && !urlRegex.test(formData.facebookUrl.trim())) {
      errors.push("Please enter a valid Facebook URL");
    }
    
    if (formData.instagramUrl && formData.instagramUrl.trim() && !urlRegex.test(formData.instagramUrl.trim())) {
      errors.push("Please enter a valid Instagram URL");
    }
    
    if (formData.linkedinUrl && formData.linkedinUrl.trim() && !urlRegex.test(formData.linkedinUrl.trim())) {
      errors.push("Please enter a valid LinkedIn URL");
    }
    
    if (errors.length > 0) {
      Alert.alert("Validation Error", errors.join("\n"));
      return;
    }
    
    handleGoNext();
  };

  // Since all fields are optional, form is always valid
  const isFormValid = true;

  return (
    <Screen>
      <View className="px-10 py-20 w-[100vw]">
        <AntDesign name="left" color="white" size={25} onPress={handleGoBack} />
        <Text className="text-[#FFCC00] font-bold mt-6">
          Social Media Information
        </Text>
        <Text className="text-white text-[12px] mt-2 mb-6">
          Connect with your customers through social media (Optional)
        </Text>
        
        <View className="mt-4">
          <Text className="text-sm text-gray-300 mb-1">
            Facebook
          </Text>
          <TextInput
            className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
            placeholder="facebook.com/yourpage"
            placeholderTextColor="#999"
            value={formData.facebookUrl}
            onChangeText={(value) => updateFormData('facebookUrl', value)}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text className="text-sm text-gray-300 mt-2">
            Your Facebook page or profile URL
          </Text>
        </View>

        <View className="mt-6">
          <Text className="text-sm text-gray-300 mb-1">
            Instagram
          </Text>
          <TextInput
            className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
            placeholder="instagram.com/yourhandle"
            placeholderTextColor="#999"
            value={formData.instagramUrl}
            onChangeText={(value) => updateFormData('instagramUrl', value)}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text className="text-sm text-gray-300 mt-2">
            Your Instagram profile URL
          </Text>
        </View>

        <View className="mt-6">
          <Text className="text-sm text-gray-300 mb-1">
            LinkedIn
          </Text>
          <TextInput
            className="w-full h-12 bg-white text-black rounded-xl px-3 py-2 text-base"
            placeholder="linkedin.com/company/yourcompany"
            placeholderTextColor="#999"
            value={formData.linkedinUrl}
            onChangeText={(value) => updateFormData('linkedinUrl', value)}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text className="text-sm text-gray-300 mt-2">
            Your LinkedIn company or profile URL
          </Text>
        </View>

        <Pressable
          className="ml-auto flex-row items-center mt-10"
          onPress={validateAndProceed}
        >
          <Text className="text-white text-base mr-2">
            Continue Registration
          </Text>
          <Ionicons name="arrow-forward" color="yellow" size={20} />
        </Pressable>
      </View>
    </Screen>
  );
}