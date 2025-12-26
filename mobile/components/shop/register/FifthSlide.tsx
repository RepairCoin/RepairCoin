import { View, Text, ScrollView } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { AppHeader } from "@/components/ui/AppHeader";
import FormInput from "@/components/ui/FormInput";
import SectionHeader from "@/components/ui/SectionHeader";
import PrimaryButton from "@/components/ui/PrimaryButton";

type Props = {
  handleGoBack: () => void;
  handleGoNext: () => void;
  street: string;
  setStreet: (arg0: string) => void;
  city: string;
  setCity: (arg0: string) => void;
  country: string;
  setCountry: (arg0: string) => void;
  walletAddress: string;
  setWalletAddress: (arg0: string) => void;
  reimbursementAddress: string;
  setReimbursementAddress: (arg0: string) => void;
};

export default function FifthShopRegisterSlide({
  handleGoBack,
  handleGoNext,
  street,
  setStreet,
  city,
  setCity,
  country,
  setCountry,
  walletAddress,
  setWalletAddress,
  reimbursementAddress,
  setReimbursementAddress,
}: Props) {
  // Check if required fields are filled
  const isFormValid =
    street.trim().length >= 3 &&
    city.trim().length >= 2 &&
    country.trim().length >= 2 &&
    walletAddress.trim().length > 0;

  return (
    <View className="w-full h-full">
      {/* Header */}
      <AppHeader title="Additional Information" onBackPress={handleGoBack} />

      <ScrollView
        className="flex-1 px-6"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Location Section */}
        <SectionHeader
          icon={<Ionicons name="location" size={16} color="#000" />}
          title="Address Details"
        />

        <FormInput
          label="Street Address"
          icon={<Ionicons name="location-outline" size={20} color="#FFCC00" />}
          value={street}
          onChangeText={setStreet}
          placeholder="Enter your street address"
        />

        <FormInput
          label="City"
          icon={<Ionicons name="business-outline" size={20} color="#FFCC00" />}
          value={city}
          onChangeText={setCity}
          placeholder="Enter your city"
        />

        <FormInput
          label="Country"
          icon={<Feather name="flag" size={20} color="#FFCC00" />}
          value={country}
          onChangeText={setCountry}
          placeholder="Enter your country"
        />

        {/* Wallet Section */}
        <SectionHeader
          icon={<Ionicons name="wallet" size={16} color="#000" />}
          title="Wallet Information"
        />

        <FormInput
          label="Connected Wallet"
          icon={<Ionicons name="wallet-outline" size={20} color="#666" />}
          value={walletAddress}
          onChangeText={setWalletAddress}
          placeholder="Enter your wallet address"
          editable={false}
          helperText="Used for shop operations and token management"
        />

        <FormInput
          label="Reimbursement Address (Optional)"
          icon={<Ionicons name="card-outline" size={20} color="#FFCC00" />}
          value={reimbursementAddress}
          onChangeText={setReimbursementAddress}
          placeholder="Enter reimbursement address (0x...)"
          autoCapitalize="none"
          helperText="Where to receive payments for token redemptions"
        />

        {/* Info Note */}
        <View className="bg-[#2A2A2C] rounded-xl p-4 mt-2 flex-row">
          <Ionicons name="information-circle" size={20} color="#FFCC00" />
          <Text className="text-gray-400 text-sm ml-3 flex-1">
            Your wallet address will be used for all token operations. The
            reimbursement address is optional and can be set later.
          </Text>
        </View>
      </ScrollView>

      {/* Fixed Bottom Button */}
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
          onPress={handleGoNext}
          disabled={!isFormValid}
        />
      </View>
    </View>
  );
}
