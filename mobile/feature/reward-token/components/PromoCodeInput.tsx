import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { PromoCode } from "../types";

interface PromoCodeInputProps {
  promoCode: string;
  promoBonus: number;
  promoError: string | null;
  isValidating: boolean;
  showDropdown: boolean;
  availableCodes: PromoCode[];
  onChangeText: (text: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onClear: () => void;
  onSelectCode: (code: string) => void;
}

export default function PromoCodeInput({
  promoCode,
  promoBonus,
  promoError,
  isValidating,
  showDropdown,
  availableCodes,
  onChangeText,
  onFocus,
  onBlur,
  onClear,
  onSelectCode,
}: PromoCodeInputProps) {
  const filteredCodes = availableCodes.filter((code) =>
    code.code.toUpperCase().includes(promoCode.toUpperCase())
  );

  return (
    <View className="mb-4">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-gray-400 text-sm font-medium">
          Promo Code (Optional)
        </Text>
        {promoBonus > 0 && (
          <View className="flex-row items-center bg-[#FFCC00]/20 px-2 py-1 rounded-full">
            <MaterialIcons name="check-circle" size={12} color="#FFCC00" />
            <Text className="text-[#FFCC00] text-xs ml-1 font-semibold">
              +{promoBonus} RCN
            </Text>
          </View>
        )}
        {isValidating && (
          <View className="flex-row items-center bg-gray-500/20 px-2 py-1 rounded-full">
            <ActivityIndicator size={12} color="#6B7280" />
            <Text className="text-gray-400 text-xs ml-1">Checking...</Text>
          </View>
        )}
      </View>
      <View className="relative">
        <TextInput
          value={promoCode}
          onChangeText={onChangeText}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder="Enter or select promo code"
          placeholderTextColor="#6B7280"
          className="w-full px-4 py-3 bg-[#0A0A0A] border border-gray-700 text-white rounded-xl"
        />
        {promoCode && (
          <TouchableOpacity
            onPress={onClear}
            className="absolute right-3 top-1/2 transform -translate-y-1/2"
          >
            <MaterialIcons name="clear" size={20} color="#6B7280" />
          </TouchableOpacity>
        )}

        {showDropdown && filteredCodes.length > 0 && (
          <View className="absolute z-10 w-full mt-2 bg-[#2A2A2A] border border-gray-600 rounded-xl shadow-xl max-h-64">
            <ScrollView>
              {filteredCodes.map((code) => (
                <TouchableOpacity
                  key={code.id}
                  onPress={() => onSelectCode(code.code)}
                  className="px-4 py-3 border-b border-gray-700 last:border-b-0"
                >
                  <View className="flex-row items-center justify-between">
                    <View>
                      <Text className="text-white font-semibold">
                        {code.code}
                      </Text>
                      {code.name && (
                        <Text className="text-gray-400 text-sm">
                          {code.name}
                        </Text>
                      )}
                    </View>
                    <Text className="text-[#FFCC00] font-bold">
                      {code.bonus_type === "fixed"
                        ? `+${code.bonus_value} RCN`
                        : `${code.bonus_value}%`}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      {promoError && (
        <View className="mt-2 flex-row items-center">
          <MaterialIcons name="error" size={16} color="#EF4444" />
          <Text className="text-red-400 text-sm ml-1">{promoError}</Text>
        </View>
      )}
    </View>
  );
}
