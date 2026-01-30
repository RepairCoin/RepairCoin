import { Text, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";

interface CopyAddressButtonProps {
  address: string;
  formattedAddress: string;
  copied: boolean;
  onPress: () => void;
}

export default function CopyAddressButton({
  address,
  formattedAddress,
  copied,
  onPress,
}: CopyAddressButtonProps) {
  if (!address) return null;

  return (
    <Pressable
      onPress={onPress}
      className="mt-6 bg-gray-100 rounded-lg px-4 py-3 flex-row items-center justify-center"
    >
      <Text className="text-gray-700 font-medium mr-2">{formattedAddress}</Text>
      <Feather
        name={copied ? "check" : "copy"}
        size={18}
        color={copied ? "#10b981" : "#6b7280"}
      />
    </Pressable>
  );
}
