import { View, Text, TouchableOpacity, TextInput } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { RepairOption, RepairType } from "../types";

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
            className={`w-5 h-5 rounded-full border-2 mr-3 ${
              isSelected
                ? "border-[#FFCC00] bg-[#FFCC00]"
                : "border-gray-500"
            }`}
          >
            {isSelected && (
              <MaterialIcons name="check" size={20} color="black" />
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
          className={`w-5 h-5 rounded-full border-2 mr-3 ${
            isSelected
              ? "border-[#FFCC00] bg-[#FFCC00]"
              : "border-gray-500"
          }`}
        >
          {isSelected && (
            <MaterialIcons name="check" size={20} color="black" />
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
              onChangeText={onAmountChange}
              placeholder="0"
              placeholderTextColor="#6B7280"
              keyboardType="numeric"
              className="w-full px-4 py-3 bg-[#000] border border-gray-600 text-white rounded-xl"
            />
          </View>
          <View className="flex-1">
            <Text className="text-gray-400 text-sm mb-2">RCN Reward</Text>
            <TextInput
              value={customRcn}
              onChangeText={onRcnChange}
              placeholder="0"
              placeholderTextColor="#6B7280"
              keyboardType="numeric"
              className="w-full px-4 py-3 bg-[#000] border border-gray-600 text-white rounded-xl"
            />
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}
