import { View, Text } from "react-native";
import { CustomRepairOption, PresetRepairOption } from "./RepairTypeOption";
import { REPAIR_OPTIONS } from "../constants";
import { RepairType } from "../types";

interface RepairTypeSectionProps {
  repairType: RepairType;
  customAmount: string;
  customRcn: string;
  onRepairTypeSelect: (type: RepairType) => void;
  onCustomAmountChange: (value: string) => void;
  onCustomRcnChange: (value: string) => void;
}

export default function RepairTypeSection({
  repairType,
  customAmount,
  customRcn,
  onRepairTypeSelect,
  onCustomAmountChange,
  onCustomRcnChange,
}: RepairTypeSectionProps) {
  return (
    <View className="px-5 mb-40">
      <View className="bg-[#1A1A1A] rounded-2xl p-5">
        <Text className="text-white text-lg font-bold mb-4">
          Select Repair Type
        </Text>

        {/* Custom Amount Option */}
        <CustomRepairOption
          isSelected={repairType === "custom"}
          customAmount={customAmount}
          customRcn={customRcn}
          onSelect={() => onRepairTypeSelect("custom")}
          onAmountChange={onCustomAmountChange}
          onRcnChange={onCustomRcnChange}
        />

        {/* Divider */}
        <View className="flex-row items-center mb-4">
          <View className="flex-1 h-px bg-gray-600" />
          <Text className="text-gray-400 text-sm px-4">OR</Text>
          <View className="flex-1 h-px bg-gray-600" />
        </View>

        {/* Preset Repair Options */}
        <View className="space-y-3 gap-2">
          {REPAIR_OPTIONS.map((option) => (
            <PresetRepairOption
              key={option.type}
              option={option}
              isSelected={repairType === option.type}
              onSelect={onRepairTypeSelect}
            />
          ))}
        </View>
      </View>
    </View>
  );
}
