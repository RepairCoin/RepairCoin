import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import CustomerInfoCard from "./CustomerInfoCard";
import CustomerWarning from "./CustomerWarning";
import PromoCodeInput from "./PromoCodeInput";
import { CustomerData, PromoCode } from "../types";

interface CustomerDetailsSectionProps {
  customerAddress: string;
  onAddressChange: (address: string) => void;
  customerInfo?: CustomerData;
  isLoadingCustomer: boolean;
  isCustomerNotFound: boolean;
  isSelfReward: boolean;
  onQRScan: () => void;
  // Promo code props
  promoCode: string;
  promoBonus: number;
  promoError: string | null;
  isValidatingPromo: boolean;
  showPromoDropdown: boolean;
  availablePromoCodes: PromoCode[];
  onPromoCodeChange: (text: string) => void;
  onPromoFocus: () => void;
  onPromoBlur: () => void;
  onPromoClear: () => void;
  onPromoSelect: (code: string) => void;
}

export default function CustomerDetailsSection({
  customerAddress,
  onAddressChange,
  customerInfo,
  isLoadingCustomer,
  isCustomerNotFound,
  isSelfReward,
  onQRScan,
  promoCode,
  promoBonus,
  promoError,
  isValidatingPromo,
  showPromoDropdown,
  availablePromoCodes,
  onPromoCodeChange,
  onPromoFocus,
  onPromoBlur,
  onPromoClear,
  onPromoSelect,
}: CustomerDetailsSectionProps) {
  return (
    <View className="px-5 mb-6">
      <View className="bg-[#1A1A1A] rounded-2xl p-5">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-white text-lg font-bold">Customer Details</Text>
          <Pressable onPress={onQRScan} className="p-2">
            <MaterialIcons name="qr-code-scanner" size={24} color="#FFCC00" />
          </Pressable>
        </View>

        {/* Wallet Address Input */}
        <View className="mb-4">
          <Text className="text-gray-400 text-sm font-medium mb-2">
            Wallet Address
          </Text>
          <View className="relative">
            <TextInput
              value={customerAddress}
              onChangeText={onAddressChange}
              placeholder="0x0000...0000"
              placeholderTextColor="#6B7280"
              className="w-full px-4 py-3 bg-[#0A0A0A] border border-gray-700 text-white rounded-xl"
            />
            {isLoadingCustomer && (
              <View className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <ActivityIndicator size="small" color="#FFCC00" />
              </View>
            )}
          </View>
        </View>

        {/* Promo Code Input */}
        <PromoCodeInput
          promoCode={promoCode}
          promoBonus={promoBonus}
          promoError={promoError}
          isValidating={isValidatingPromo}
          showDropdown={showPromoDropdown}
          availableCodes={availablePromoCodes}
          onChangeText={onPromoCodeChange}
          onFocus={onPromoFocus}
          onBlur={onPromoBlur}
          onClear={onPromoClear}
          onSelectCode={onPromoSelect}
        />

        {/* Customer Info Display */}
        {customerInfo && <CustomerInfoCard customerInfo={customerInfo} />}

        {/* Customer Not Found Warning */}
        {isCustomerNotFound && <CustomerWarning type="not-found" />}

        {/* Self-Reward Warning */}
        {isSelfReward && <CustomerWarning type="self-reward" />}
      </View>
    </View>
  );
}
