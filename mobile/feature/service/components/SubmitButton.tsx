import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface SubmitButtonProps {
  onSubmit: () => void;
  isDisabled: boolean;
  isPending: boolean;
  isSubmitted: boolean;
  hasRating: boolean;
}

export default function SubmitButton({
  onSubmit,
  isDisabled,
  isPending,
  isSubmitted,
  hasRating,
}: SubmitButtonProps) {
  return (
    <View className="absolute bottom-0 left-0 right-0 bg-zinc-950 px-4 py-4 border-t border-gray-800 pb-8">
      <TouchableOpacity
        onPress={onSubmit}
        disabled={isDisabled}
        className={`rounded-xl py-4 items-center ${
          isSubmitted ? "bg-gray-700" : hasRating ? "bg-[#FFCC00]" : "bg-gray-700"
        }`}
        activeOpacity={0.8}
      >
        {isPending ? (
          <ActivityIndicator size="small" color="black" />
        ) : isSubmitted ? (
          <View className="flex-row items-center">
            <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
            <Text className="text-green-500 text-lg font-bold ml-2">
              Review Submitted
            </Text>
          </View>
        ) : (
          <Text
            className={`text-lg font-bold ${
              hasRating ? "text-black" : "text-gray-500"
            }`}
          >
            Submit Review
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
