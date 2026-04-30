import { View, Text, ScrollView } from "react-native";
import { Controller, useFormContext } from "react-hook-form";
import type { ShopRegisterData } from "../../dto/register.dto";
import { Feather, Ionicons } from "@expo/vector-icons";
import FormInput from "@/shared/components/ui/FormInput";
import PhoneInput from "@/shared/components/ui/PhoneInput";
import SectionHeader from "@/shared/components/ui/SectionHeader";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import { THEME_COLORS } from "@/shared/constants/Colors";
import { FirstSlideProps } from "../../types";

export default function FirstSlide({
  handleGoNext,
}: FirstSlideProps) {
  const { control, formState: { errors } } = useFormContext<ShopRegisterData>();

  return (
    <View className="w-full h-full">
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

        <Controller
          control={control}
          name="firstName"
          render={({ field: { onChange, value } }) => (
            <FormInput
              label="First Name"
              icon={<Feather name="user" size={20} color="#FFCC00" />}
              value={value}
              onChangeText={onChange}
              placeholder="Enter your first name"
              autoCapitalize="words"
              maxLength={100}
              error={errors.firstName?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="lastName"
          render={({ field: { onChange, value } }) => (
            <FormInput
              label="Last Name"
              icon={<Feather name="user" size={20} color="#FFCC00" />}
              value={value}
              onChangeText={onChange}
              placeholder="Enter your last name"
              autoCapitalize="words"
              maxLength={100}
              error={errors.lastName?.message}
            />
          )}
        />

        <SectionHeader
          icon={<Feather name="phone" size={16} color="#000" />}
          title="Contact Information"
        />

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, value } }) => (
            <FormInput
              label="Email Address"
              icon={<Feather name="mail" size={20} color="#FFCC00" />}
              value={value}
              onChangeText={onChange}
              placeholder="Enter your email address"
              keyboardType="email-address"
              autoCapitalize="none"
              maxLength={255}
              error={errors.email?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="phone"
          render={({ field: { onChange, value } }) => (
            <PhoneInput
              label="Phone Number"
              value={value}
              onChangePhone={onChange}
              defaultCountryCode="US"
            />
          )}
        />

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
          backgroundColor: THEME_COLORS.background,
          borderTopWidth: 1,
          borderTopColor: "#2A2A2C",
        }}
      >
        <PrimaryButton title="Continue" onPress={handleGoNext} />
      </View>
    </View>
  );
}
