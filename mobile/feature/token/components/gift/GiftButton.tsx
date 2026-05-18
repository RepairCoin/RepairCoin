import { TouchableOpacity, Text, ActivityIndicator } from "react-native";

interface GiftButtonProps {
  onPress: () => void;
  isLoading: boolean;
  isValidated: boolean;
}

export default function GiftButton({
  onPress,
  isLoading,
  isValidated,
}: GiftButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isLoading}
      className={`rounded-xl py-4 mt-4 ${
        isLoading ? "bg-[#FFCC00]/50" : "bg-[#FFCC00]"
      }`}
      activeOpacity={0.8}
    >
      {isLoading ? (
        <ActivityIndicator color="#000" />
      ) : (
        <Text className="text-black text-center text-lg font-bold">
          {isValidated ? "Gift Tokens" : "Validate & Gift"}
        </Text>
      )}
    </TouchableOpacity>
  );
}
