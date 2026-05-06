import { View, Text, ScrollView } from "react-native";
import { Controller, useFormContext } from "react-hook-form";
import { Feather, Ionicons } from "@expo/vector-icons";
import FormInput from "@/shared/components/ui/FormInput";
import SectionHeader from "@/shared/components/ui/SectionHeader";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import { NavigableSlideProps } from "../../types";
import type { ShopRegisterData } from "../../dto/register.dto";

export default function SocialMediaSlide({
  handleGoNext,
}: NavigableSlideProps) {
  const { control } = useFormContext<ShopRegisterData>();

  return (
    <View className="w-full h-full">
      <ScrollView
        className="flex-1 px-6"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <View className="mb-2">
          <Text className="text-gray-400 text-sm mt-2">
            Add your social media profiles to help customers find and connect
            with you. All fields are optional.
          </Text>
        </View>

        <SectionHeader
          title="Social Profiles"
          customClassName="text-[#FFCC00]"
        />

        <Controller
          control={control}
          name="facebook"
          render={({ field: { onChange, value } }) => (
            <FormInput
              label="Facebook"
              value={value}
              onChangeText={onChange}
              placeholder="facebook.com/yourpage"
              keyboardType="url"
              autoCapitalize="none"
              helperText="Your Facebook page or profile URL"
              maxLength={255}
            />
          )}
        />

        <Controller
          control={control}
          name="instagram"
          render={({ field: { onChange, value } }) => (
            <FormInput
              label="Instagram"
              value={value}
              onChangeText={onChange}
              placeholder="instagram.com/yourhandle"
              keyboardType="url"
              autoCapitalize="none"
              helperText="Your Instagram profile URL"
              maxLength={255}
            />
          )}
        />

        <Controller
          control={control}
          name="twitter"
          render={({ field: { onChange, value } }) => (
            <FormInput
              label="Twitter / X"
              value={value}
              onChangeText={onChange}
              placeholder="twitter.com/yourhandle"
              keyboardType="url"
              autoCapitalize="none"
              helperText="Your Twitter/X profile URL"
              maxLength={255}
            />
          )}
        />

        <View className="bg-[#FFCC00]/10 rounded-xl p-4 mt-4 flex-row border border-[#FFCC00]/30">
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
        <PrimaryButton title="Continue" onPress={handleGoNext} />
      </View>
    </View>
  );
}
