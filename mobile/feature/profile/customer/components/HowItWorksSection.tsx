import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { HOW_IT_WORKS_STEPS } from "../constants";

export default function HowItWorksSection() {
  return (
    <View className="px-5 mb-6">
      <Text className="text-white text-lg font-semibold mb-4">How It Works</Text>
      <View className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
        {HOW_IT_WORKS_STEPS.map((step, index) => (
          <View key={index}>
            <View className="flex-row items-start">
              <View className="bg-[#FFCC00] w-10 h-10 rounded-full items-center justify-center mr-4">
                <Ionicons name={step.icon as any} size={20} color="#000" />
              </View>
              <View className="flex-1">
                <Text className="text-white font-semibold text-base">
                  {step.title}
                </Text>
                <Text className="text-gray-400 text-sm mt-1">
                  {step.description}
                </Text>
              </View>
            </View>
            {index < HOW_IT_WORKS_STEPS.length - 1 && (
              <View className="ml-5 border-l-2 border-dashed border-zinc-700 h-6 my-2" />
            )}
          </View>
        ))}
      </View>
    </View>
  );
}
