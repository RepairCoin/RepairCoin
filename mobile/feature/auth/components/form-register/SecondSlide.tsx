import { View, Text, ScrollView, StyleSheet } from "react-native";
import { Controller } from "react-hook-form";
import { Feather, Ionicons } from "@expo/vector-icons";
import RNPickerSelect from "react-native-picker-select";
import { AppHeader } from "@/shared/components/ui/AppHeader";
import FormInput from "@/shared/components/ui/FormInput";
import SectionHeader from "@/shared/components/ui/SectionHeader";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import { NavigableSlideProps } from "../../types";
import { COMPANY_SIZE_OPTIONS, MONTHLY_REVENUE_OPTIONS } from "../../constants";

export default function SecondSlide({
  handleGoBack,
  handleGoNext,
  control,
  errors,
}: NavigableSlideProps) {
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

        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, value } }) => (
            <FormInput
              label="Company Name"
              icon={<Feather name="briefcase" size={20} color="#FFCC00" />}
              value={value}
              onChangeText={onChange}
              placeholder="Enter your company name"
              maxLength={150}
              error={errors.name?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="companySize"
          render={({ field: { onChange, value } }) => (
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-400 mb-2 ml-1">
                Company Size
              </Text>
              <View className="flex-row items-center rounded-xl px-4 bg-[#2A2A2C]">
                <Feather name="users" size={20} color="#FFCC00" />
                <View className="flex-1 ml-3">
                  <RNPickerSelect
                    value={value}
                    onValueChange={onChange}
                    items={COMPANY_SIZE_OPTIONS}
                    placeholder={{ label: "Select company size", value: "" }}
                    style={styles}
                    useNativeAndroidPickerStyle={false}
                  />
                </View>
                <Ionicons name="chevron-down" size={20} color="#666" />
              </View>
            </View>
          )}
        />

        <Controller
          control={control}
          name="monthlyRevenue"
          render={({ field: { onChange, value } }) => (
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-400 mb-2 ml-1">
                Monthly Revenue
              </Text>
              <View className="flex-row items-center rounded-xl px-4 bg-[#2A2A2C]">
                <Feather name="dollar-sign" size={20} color="#FFCC00" />
                <View className="flex-1 ml-3">
                  <RNPickerSelect
                    value={value}
                    onValueChange={onChange}
                    items={MONTHLY_REVENUE_OPTIONS}
                    placeholder={{ label: "Select monthly revenue", value: "" }}
                    style={styles}
                    useNativeAndroidPickerStyle={false}
                  />
                </View>
                <Ionicons name="chevron-down" size={20} color="#666" />
              </View>
            </View>
          )}
        />

        <SectionHeader
          icon={<Feather name="plus-circle" size={16} color="#000" />}
          title="Optional Details"
        />

        <Controller
          control={control}
          name="website"
          render={({ field: { onChange, value } }) => (
            <FormInput
              label="Website URL"
              icon={<Feather name="globe" size={20} color="#FFCC00" />}
              value={value}
              onChangeText={onChange}
              placeholder="https://yourwebsite.com"
              keyboardType="url"
              autoCapitalize="none"
              helperText="Your business website (optional)"
              maxLength={255}
            />
          )}
        />

        <Controller
          control={control}
          name="referral"
          render={({ field: { onChange, value } }) => (
            <FormInput
              label="Referral"
              icon={<Feather name="user-plus" size={20} color="#FFCC00" />}
              value={value}
              onChangeText={onChange}
              placeholder="Who referred you to FixFlow?"
              helperText="Enter the name or company that referred you"
              maxLength={100}
            />
          )}
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
        <PrimaryButton title="Continue" onPress={handleGoNext} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
