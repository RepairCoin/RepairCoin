import { View, Text } from "react-native";

const STEP_LABELS = ["Personal", "Business", "Location", "Social", "Terms"];

export default function ProgressBar({ currentStep }: { currentStep: number }) {
  return (
    <View className="px-6 pb-3 bg-zinc-950">
      <View className="flex-row items-center justify-between mb-2">
        {STEP_LABELS.map((label, i) => (
          <View key={label} className="items-center flex-1">
            <View
              className={`w-7 h-7 rounded-full items-center justify-center ${
                i <= currentStep ? "bg-[#FFCC00]" : "bg-[#2A2A2C]"
              }`}
            >
              {i < currentStep ? (
                <Text className="text-black text-xs font-bold">✓</Text>
              ) : (
                <Text
                  className={`text-xs font-bold ${
                    i === currentStep ? "text-black" : "text-gray-500"
                  }`}
                >
                  {i + 1}
                </Text>
              )}
            </View>
            <Text
              className={`text-[10px] mt-1 ${
                i <= currentStep
                  ? "text-[#FFCC00] font-semibold"
                  : "text-gray-500"
              }`}
            >
              {label}
            </Text>
          </View>
        ))}
      </View>
      <View className="flex-row items-center mt-1">
        {STEP_LABELS.map((_, i) => (
          <View key={i} className="flex-1 mx-0.5">
            <View
              className={`h-1 rounded-full ${
                i <= currentStep ? "bg-[#FFCC00]" : "bg-[#2A2A2C]"
              }`}
            />
          </View>
        ))}
      </View>
    </View>
  );
}
