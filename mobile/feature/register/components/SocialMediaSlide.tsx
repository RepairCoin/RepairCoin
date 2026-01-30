import { View, Text, ScrollView, Alert } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { AppHeader } from "@/shared/components/ui/AppHeader";
import FormInput from "@/shared/components/ui/FormInput";
import SectionHeader from "@/shared/components/ui/SectionHeader";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import { NavigableSlideProps } from "../types";
import { validateShopSocialMediaSlide } from "../utils";

export default function SocialMediaSlide({
  handleGoBack,
  handleGoNext,
  formData,
  updateFormData,
}: NavigableSlideProps) {
  const validateAndProceed = () => {
    const errors = validateShopSocialMediaSlide(
      formData.facebook,
      formData.instagram,
      formData.twitter
    );

    if (errors.length > 0) {
      Alert.alert("Validation Error", errors.join("\n"));
      return;
    }

    handleGoNext();
  };

  return (
    <View className="w-full h-full">
      <AppHeader title="Social Media" onBackPress={handleGoBack} />

      <ScrollView
        className="flex-1 px-6"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <View className="mt-4 mb-2">
          <Text className="text-[#FFCC00] font-bold text-xl">
            Connect with Customers
          </Text>
          <Text className="text-gray-400 text-sm mt-2">
            Add your social media profiles to help customers find and connect
            with you. All fields are optional.
          </Text>
        </View>

        <SectionHeader
          icon={<Feather name="share-2" size={16} color="#000" />}
          title="Social Profiles"
        />

        <FormInput
          label="Facebook"
          icon={<Feather name="facebook" size={20} color="#FFCC00" />}
          value={formData.facebook}
          onChangeText={(value) => updateFormData("facebook", value)}
          placeholder="facebook.com/yourpage"
          keyboardType="url"
          autoCapitalize="none"
          helperText="Your Facebook page or profile URL"
        />

        <FormInput
          label="Instagram"
          icon={<Feather name="instagram" size={20} color="#FFCC00" />}
          value={formData.instagram}
          onChangeText={(value) => updateFormData("instagram", value)}
          placeholder="instagram.com/yourhandle"
          keyboardType="url"
          autoCapitalize="none"
          helperText="Your Instagram profile URL"
        />

        <FormInput
          label="Twitter / X"
          icon={<Feather name="twitter" size={20} color="#FFCC00" />}
          value={formData.twitter}
          onChangeText={(value) => updateFormData("twitter", value)}
          placeholder="twitter.com/yourhandle"
          keyboardType="url"
          autoCapitalize="none"
          helperText="Your Twitter/X profile URL"
        />

        <View className="bg-[#2A2A2C] rounded-xl p-4 mt-4 flex-row">
          <Ionicons name="information-circle" size={20} color="#FFCC00" />
          <Text className="text-gray-400 text-sm ml-3 flex-1">
            Social media links help customers verify your business and stay
            connected. You can update these later in your shop settings.
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
        <PrimaryButton title="Continue" onPress={validateAndProceed} />
      </View>
    </View>
  );
}
