import { Modal, TouchableOpacity, View, Text, FlatList, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SearchInput } from "@/shared/components/ui/SearchInput";
import { useDebounce } from "@/shared/hooks";
import { useState } from "react";
import { useMarketingCustomersQuery } from "../hooks";
import { MarketingCustomer } from "../services/marketing.interface";

interface CustomerSelectModalProps {
  visible: boolean;
  onClose: () => void;
  selectedAddresses: Set<string>;
  onToggleAddress: (address: string) => void;
}

export function CustomerSelectModal({
  visible,
  onClose,
  selectedAddresses,
  onToggleAddress,
}: CustomerSelectModalProps) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);

  const { data, isLoading } = useMarketingCustomersQuery(debouncedSearch || undefined);
  const customers = data?.customers ?? [];

  const renderItem = ({ item }: { item: MarketingCustomer }) => {
    const address = item.walletAddress.toLowerCase();
    const isSelected = selectedAddresses.has(address);
    return (
      <TouchableOpacity
        onPress={() => onToggleAddress(address)}
        activeOpacity={0.7}
        className="flex-row items-center justify-between px-4 py-3.5 border-b border-zinc-800"
      >
        <View className="flex-1 mr-3">
          <Text className="text-white text-sm font-medium" numberOfLines={1}>
            {item.name || item.email || address}
          </Text>
          {(item.name || item.email) && (
            <Text className="text-gray-500 text-xs mt-0.5" numberOfLines={1}>
              {item.email ?? address}
            </Text>
          )}
        </View>
        <Ionicons
          name={isSelected ? "checkbox" : "square-outline"}
          size={22}
          color={isSelected ? "#FFCC00" : "#6B7280"}
        />
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-black/60 justify-end">
        <View className="bg-zinc-900 rounded-t-3xl h-[80%]">
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-zinc-800">
            <Text className="text-white text-lg font-semibold">Select customers</Text>
            <TouchableOpacity onPress={onClose} className="p-1">
              <Ionicons name="close" size={24} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <View className="px-4 py-3">
            <SearchInput value={search} onChangeText={setSearch} placeholder="Search customers…" variant="filled" />
          </View>

          {isLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color="#FFCC00" />
            </View>
          ) : (
            <FlatList
              data={customers}
              keyExtractor={(item) => item.walletAddress}
              renderItem={renderItem}
              contentContainerStyle={{ paddingBottom: 24 }}
              ListEmptyComponent={
                <View className="items-center py-12">
                  <Text className="text-gray-500 text-sm">No customers found</Text>
                </View>
              }
            />
          )}

          <View className="px-5 py-4 border-t border-zinc-800">
            <TouchableOpacity
              onPress={onClose}
              className="bg-[#FFCC00] rounded-xl py-3.5 items-center"
              activeOpacity={0.8}
            >
              <Text className="text-black font-bold">
                Done{selectedAddresses.size > 0 ? ` (${selectedAddresses.size})` : ""}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
