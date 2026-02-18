import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useCustomerSearchQuery } from "../hooks/queries";
import { CustomerSearchResult } from "@/shared/services/appointment.services";

interface CustomerSearchInputProps {
  shopId: string;
  onSelectCustomer: (customer: CustomerSearchResult | null) => void;
  selectedCustomer: CustomerSearchResult | null;
}

export default function CustomerSearchInput({
  shopId,
  onSelectCustomer,
  selectedCustomer,
}: CustomerSearchInputProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const {
    data: customers,
    isLoading,
  } = useCustomerSearchQuery(shopId, debouncedQuery, {
    enabled: debouncedQuery.length >= 2,
  });

  const handleSelectCustomer = (customer: CustomerSearchResult) => {
    onSelectCustomer(customer);
    setSearchQuery("");
    setShowResults(false);
  };

  const handleClearSelection = () => {
    onSelectCustomer(null);
  };

  const truncateAddress = (address: string) => {
    if (!address) return "N/A";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // If customer is selected, show the selected customer card
  if (selectedCustomer) {
    return (
      <View className="bg-[#252525] rounded-xl p-4 border border-[#333]">
        <View className="flex-row items-center">
          <View className="w-10 h-10 rounded-full bg-[#FFCC00]/20 items-center justify-center">
            <Feather name="user" size={18} color="#FFCC00" />
          </View>
          <View className="flex-1 ml-3">
            <Text className="text-white font-medium">
              {selectedCustomer.customerName || "Customer"}
            </Text>
            <Text className="text-gray-400 text-sm">
              {truncateAddress(selectedCustomer.customerAddress)}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleClearSelection}
            className="p-2"
          >
            <Ionicons name="close-circle" size={22} color="#666" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View>
      {/* Search Input */}
      <View className="flex-row items-center bg-[#252525] rounded-xl px-4 py-3 border border-[#333]">
        <Feather name="search" size={18} color="#666" />
        <TextInput
          value={searchQuery}
          onChangeText={(text) => {
            setSearchQuery(text);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          placeholder="Search by name, email, phone, or wallet..."
          placeholderTextColor="#666"
          className="flex-1 ml-2 text-white"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => {
            setSearchQuery("");
            setShowResults(false);
          }}>
            <Ionicons name="close-circle" size={18} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      {/* Search Results Dropdown */}
      {showResults && debouncedQuery.length >= 2 && (
        <View className="mt-2 bg-[#1a1a1a] rounded-xl border border-[#333] max-h-48 overflow-hidden">
          {isLoading ? (
            <View className="py-4 items-center">
              <ActivityIndicator size="small" color="#FFCC00" />
            </View>
          ) : !customers || customers.length === 0 ? (
            <View className="py-4 items-center">
              <Text className="text-gray-500 text-sm">No customers found</Text>
              <Text className="text-gray-600 text-xs mt-1">
                You can create a new customer below
              </Text>
            </View>
          ) : (
            <FlatList
              data={customers}
              keyExtractor={(item) => item.customerAddress}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => handleSelectCustomer(item)}
                  className="flex-row items-center px-4 py-3 border-b border-[#252525]"
                >
                  <View className="w-8 h-8 rounded-full bg-[#333] items-center justify-center">
                    <Feather name="user" size={14} color="#999" />
                  </View>
                  <View className="flex-1 ml-3">
                    <Text className="text-white text-sm">
                      {item.customerName || "Unknown"}
                    </Text>
                    <Text className="text-gray-500 text-xs">
                      {item.customerEmail || truncateAddress(item.customerAddress)}
                    </Text>
                  </View>
                  {item.totalBookings !== undefined && (
                    <Text className="text-gray-500 text-xs">
                      {item.totalBookings} bookings
                    </Text>
                  )}
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      )}

      {/* Helper Text */}
      <Text className="text-gray-500 text-xs mt-2">
        Search for an existing customer or enter details manually below
      </Text>
    </View>
  );
}
