import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { HOW_IT_WORKS_STEPS } from "../constants";

const DASH_HEIGHT = 8;
const DASH_GAP = 6;

export default function HowItWorksSection() {
  return (
    <View className="px-5 mb-6">
      <Text className="text-white text-lg font-semibold mb-4">How It Works</Text>
      <View className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
        {HOW_IT_WORKS_STEPS.map((step, index) => {
          const isLast = index === HOW_IT_WORKS_STEPS.length - 1;
          return (
            <View key={index} className="flex-row">
              {/* Left column: icon + dashed connector */}
              <View className="items-center w-10 mr-4">
                <View className="bg-[#FFCC00] w-10 h-10 rounded-full items-center justify-center">
                  <Ionicons name={step.icon as any} size={20} color="#000" />
                </View>
                {!isLast && (
                  <View className="items-center justify-center" style={{ height: 32 }}>
                    <View className="bg-zinc-700 rounded-full" style={{ width: 2, height: DASH_HEIGHT }} />
                    <View style={{ height: DASH_GAP }} />
                    <View className="bg-zinc-700 rounded-full" style={{ width: 2, height: DASH_HEIGHT }} />
                  </View>
                )}
              </View>
              {/* Right column: text content */}
              <View className={`flex-1 ${!isLast ? "pb-2" : ""}`}>
                <Text className="text-white font-semibold text-base" style={{ lineHeight: 20, marginTop: 2 }}>
                  {step.title}
                </Text>
                <Text className="text-gray-400 text-sm mt-1">
                  {step.description}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
