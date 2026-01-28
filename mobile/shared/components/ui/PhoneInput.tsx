import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  Platform,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";

// Country data with dial codes
const COUNTRIES = [
  { code: "PH", name: "Philippines", dialCode: "+63", flag: "🇵🇭" },
  { code: "US", name: "United States", dialCode: "+1", flag: "🇺🇸" },
  { code: "GB", name: "United Kingdom", dialCode: "+44", flag: "🇬🇧" },
  { code: "AU", name: "Australia", dialCode: "+61", flag: "🇦🇺" },
  { code: "CA", name: "Canada", dialCode: "+1", flag: "🇨🇦" },
  { code: "SG", name: "Singapore", dialCode: "+65", flag: "🇸🇬" },
  { code: "MY", name: "Malaysia", dialCode: "+60", flag: "🇲🇾" },
  { code: "JP", name: "Japan", dialCode: "+81", flag: "🇯🇵" },
  { code: "KR", name: "South Korea", dialCode: "+82", flag: "🇰🇷" },
  { code: "CN", name: "China", dialCode: "+86", flag: "🇨🇳" },
  { code: "IN", name: "India", dialCode: "+91", flag: "🇮🇳" },
  { code: "AE", name: "UAE", dialCode: "+971", flag: "🇦🇪" },
  { code: "SA", name: "Saudi Arabia", dialCode: "+966", flag: "🇸🇦" },
  { code: "DE", name: "Germany", dialCode: "+49", flag: "🇩🇪" },
  { code: "FR", name: "France", dialCode: "+33", flag: "🇫🇷" },
];

interface Country {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
}

interface PhoneInputProps {
  label?: string;
  value: string; // E.164 format: +639171234567
  onChangePhone: (e164Phone: string) => void;
  placeholder?: string;
  defaultCountryCode?: string;
  error?: string;
}

/**
 * Parse E.164 phone number to extract country and local number
 */
const parseE164 = (e164: string): { country: Country; localNumber: string } => {
  const defaultCountry = COUNTRIES[0]; // Philippines

  if (!e164 || !e164.startsWith("+")) {
    return { country: defaultCountry, localNumber: e164 || "" };
  }

  // Find matching country by dial code (longest match first)
  const sortedCountries = [...COUNTRIES].sort(
    (a, b) => b.dialCode.length - a.dialCode.length
  );

  for (const country of sortedCountries) {
    if (e164.startsWith(country.dialCode)) {
      const localNumber = e164.slice(country.dialCode.length);
      return { country, localNumber };
    }
  }

  return { country: defaultCountry, localNumber: e164.replace(/^\+/, "") };
};

/**
 * Format to E.164
 */
const toE164 = (dialCode: string, localNumber: string): string => {
  // Remove all non-digit characters from local number
  const digits = localNumber.replace(/\D/g, "");
  if (!digits) return "";
  return `${dialCode}${digits}`;
};

export default function PhoneInput({
  label,
  value,
  onChangePhone,
  placeholder = "Enter phone number",
  defaultCountryCode = "PH",
  error,
}: PhoneInputProps) {
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<Country>(
    COUNTRIES.find((c) => c.code === defaultCountryCode) || COUNTRIES[0]
  );
  const [localNumber, setLocalNumber] = useState("");

  // Parse incoming E.164 value when it changes
  useEffect(() => {
    if (value) {
      const parsed = parseE164(value);
      setSelectedCountry(parsed.country);
      setLocalNumber(parsed.localNumber);
    } else {
      setLocalNumber("");
    }
  }, [value]);

  const handleCountrySelect = useCallback(
    (country: Country) => {
      setSelectedCountry(country);
      setShowCountryPicker(false);
      // Update E.164 with new country code
      if (localNumber) {
        onChangePhone(toE164(country.dialCode, localNumber));
      }
    },
    [localNumber, onChangePhone]
  );

  const handleNumberChange = useCallback(
    (text: string) => {
      // Only allow digits
      const digits = text.replace(/\D/g, "");
      setLocalNumber(digits);
      onChangePhone(toE164(selectedCountry.dialCode, digits));
    },
    [selectedCountry, onChangePhone]
  );

  const renderCountryItem = ({ item }: { item: Country }) => (
    <TouchableOpacity
      onPress={() => handleCountrySelect(item)}
      className="flex-row items-center px-4 py-3 border-b border-gray-800"
      activeOpacity={0.7}
    >
      <Text className="text-2xl mr-3">{item.flag}</Text>
      <View className="flex-1">
        <Text className="text-white font-medium">{item.name}</Text>
        <Text className="text-gray-400 text-sm">{item.dialCode}</Text>
      </View>
      {selectedCountry.code === item.code && (
        <Ionicons name="checkmark" size={20} color="#FFCC00" />
      )}
    </TouchableOpacity>
  );

  return (
    <View className="mb-4">
      {label && (
        <Text className="text-sm font-medium text-gray-400 mb-2 ml-1">
          {label}
        </Text>
      )}

      <View className="flex-row items-center rounded-xl bg-[#2A2A2C]">
        {/* Country Code Selector */}
        <TouchableOpacity
          onPress={() => setShowCountryPicker(true)}
          className="flex-row items-center px-3 py-3 border-r border-gray-700"
          activeOpacity={0.7}
        >
          <Text className="text-xl mr-1">{selectedCountry.flag}</Text>
          <Text className="text-white font-medium mr-1">
            {selectedCountry.dialCode}
          </Text>
          <Feather name="chevron-down" size={16} color="#666" />
        </TouchableOpacity>

        {/* Phone Number Input */}
        <View className="flex-1 flex-row items-center px-3">
          <Feather name="phone" size={20} color="#FFCC00" />
          <TextInput
            className="flex-1 h-12 text-white text-base ml-2"
            placeholder={placeholder}
            placeholderTextColor="#666"
            keyboardType="phone-pad"
            value={localNumber}
            onChangeText={handleNumberChange}
          />
        </View>
      </View>

      {error && (
        <Text className="text-red-500 text-sm mt-1 ml-1">{error}</Text>
      )}

      {/* Country Picker Modal */}
      <Modal
        visible={showCountryPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCountryPicker(false)}
      >
        <View className="flex-1 bg-black/80 justify-end">
          <View
            className="bg-[#1A1A1C] rounded-t-3xl"
            style={{ maxHeight: "70%" }}
          >
            {/* Modal Header */}
            <View className="flex-row justify-between items-center px-4 py-4 border-b border-gray-800">
              <Text className="text-white text-lg font-bold">
                Select Country
              </Text>
              <TouchableOpacity
                onPress={() => setShowCountryPicker(false)}
                className="w-8 h-8 rounded-full bg-[#333] items-center justify-center"
              >
                <Ionicons name="close" size={18} color="white" />
              </TouchableOpacity>
            </View>

            {/* Country List */}
            <FlatList
              data={COUNTRIES}
              keyExtractor={(item) => item.code}
              renderItem={renderCountryItem}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: Platform.OS === "ios" ? 40 : 20 }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
