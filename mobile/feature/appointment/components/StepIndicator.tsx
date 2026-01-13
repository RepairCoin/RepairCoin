import { View, Text } from "react-native";
import { StepIndicatorProps } from "../types";

export default function StepIndicator({
  currentStep,
  totalSteps,
}: StepIndicatorProps) {
  return (
    <View className="flex-row items-center justify-center mt-4">
      <View className="flex-row items-center">
        {Array.from({ length: totalSteps }, (_, index) => {
          const stepNumber = index + 1;
          const isActive = stepNumber === currentStep;
          const isLast = stepNumber === totalSteps;

          return (
            <View key={stepNumber} className="flex-row items-center">
              <View
                className={`w-8 h-8 rounded-full items-center justify-center ${
                  isActive ? "bg-[#FFCC00]" : "bg-zinc-700"
                }`}
              >
                <Text
                  className={`font-bold ${
                    isActive ? "text-black" : "text-white"
                  }`}
                >
                  {stepNumber}
                </Text>
              </View>
              {!isLast && <View className="w-12 h-1 bg-zinc-700 mx-2" />}
            </View>
          );
        })}
      </View>
    </View>
  );
}
