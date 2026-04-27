import { View, Text, TouchableOpacity, TextInput } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { RepairOption, RepairType } from "../../types";

interface RepairTypeOptionProps {
  option: RepairOption;
  isSelected: boolean;
  onSelect: (type: RepairType) => void;
}

export function PresetRepairOption({ option, isSelected, onSelect }: RepairTypeOptionProps) {
  return (
    <TouchableOpacity
      onPress={() => onSelect(option.type)}
      className={`p-4 rounded-xl border-2 ${
        isSelected
          ? "border-[#FFCC00] bg-[#FFCC00]/10"
          : "border-gray-700 bg-[#0A0A0A]"
      }`}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center flex-1">
          <View
            className={`w-5 h-5 rounded-full border-2 mr-3 items-center justify-center ${
              isSelected
                ? "border-[#FFCC00] bg-[#FFCC00]"
                : "border-gray-500"
            }`}
          >
            {isSelected && (
              <MaterialIcons name="check" size={12} color="black" />
            )}
          </View>
          <View className="flex-1">
            <Text className="text-white font-semibold">{option.label}</Text>
            <Text className="text-gray-400 text-sm">{option.description}</Text>
          </View>
        </View>
        <View className="text-right">
          <Text className="text-[#FFCC00] text-2xl font-bold">{option.rcn}</Text>
          <Text className="text-[#FFCC00] text-xs">RCN</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

interface CustomRepairOptionProps {
  isSelected: boolean;
  customAmount: string;
  customRcn: string;
  onSelect: () => void;
  onAmountChange: (value: string) => void;
  onRcnChange: (value: string) => void;
}

export function CustomRepairOption({
  isSelected,
  customAmount,
  customRcn,
  onSelect,
  onAmountChange,
  onRcnChange,
}: CustomRepairOptionProps) {
  return (
    <TouchableOpacity
      onPress={onSelect}
      className={`p-4 rounded-xl border-2 mb-4 ${
        isSelected
          ? "border-[#FFCC00] bg-[#FFCC00]/10"
          : "border-gray-700 bg-[#0A0A0A]"
      }`}
    >
      <View className="flex-row items-center">
        <View
          className={`w-5 h-5 rounded-full border-2 mr-3 items-center justify-center ${
            isSelected
              ? "border-[#FFCC00] bg-[#FFCC00]"
              : "border-gray-500"
          }`}
        >
          {isSelected && (
            <MaterialIcons name="check" size={12} color="black" />
          )}
        </View>
        <View className="flex-1">
          <Text className="text-white font-semibold">Custom Amount</Text>
          <Text className="text-gray-400 text-sm">
            Enter specific RCN reward and repair value
          </Text>
        </View>
      </View>

      {isSelected && (
        <View className="mt-4 flex-col gap-2">
          <View className="flex-1">
            <Text className="text-gray-400 text-sm mb-2">Repair Amount ($)</Text>
            <TextInput
              value={customAmount}
              onChangeText={(text) => {
                const sanitized = text.replace(/[^0-9.]/g, "");
                // Prevent multiple decimal points
                const parts = sanitized.split(".");
                const cleaned = parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : sanitized;
                onAmountChange(cleaned);
              }}
              placeholder="Min $1"
              placeholderTextColor="#6B7280"
              keyboardType="decimal-pad"
              className={`w-full px-4 py-3 bg-[#000] border text-white rounded-xl ${
                customAmount && (parseFloat(customAmount) <= 0 || parseFloat(customAmount) > 100000)
                  ? "border-red-500"
                  : "border-gray-600"
              }`}
            />
            {customAmount && parseFloat(customAmount) <= 0 && (
              <Text className="text-red-400 text-xs mt-1">Amount must be greater than $0</Text>
            )}
            {customAmount && parseFloat(customAmount) > 100000 && (
              <Text className="text-red-400 text-xs mt-1">Amount cannot exceed $100,000</Text>
            )}
          </View>
          <View className="flex-1">
            <Text className="text-gray-400 text-sm mb-2">RCN Reward</Text>
            <TextInput
              value={customRcn}
              onChangeText={(text) => {
                const sanitized = text.replace(/[^0-9.]/g, "");
                const parts = sanitized.split(".");
                const cleaned = parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : sanitized;
                onRcnChange(cleaned);
              }}
              placeholder="Min 1 RCN"
              placeholderTextColor="#6B7280"
              keyboardType="decimal-pad"
              className={`w-full px-4 py-3 bg-[#000] border text-white rounded-xl ${
                customRcn && (parseFloat(customRcn) <= 0 || parseFloat(customRcn) > 10000)
                  ? "border-red-500"
                  : "border-gray-600"
              }`}
            />
            {customRcn && parseFloat(customRcn) <= 0 && (
              <Text className="text-red-400 text-xs mt-1">RCN must be greater than 0</Text>
            )}
            {customRcn && parseFloat(customRcn) > 10000 && (
              <Text className="text-red-400 text-xs mt-1">RCN cannot exceed 10,000</Text>
            )}
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}
