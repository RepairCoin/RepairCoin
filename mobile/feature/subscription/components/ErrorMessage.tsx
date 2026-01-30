import { View, Text } from "react-native";

type ErrorMessageProps = {
  message: string | null;
};

export default function ErrorMessage({ message }: ErrorMessageProps) {
  if (!message) return null;

  return (
    <View className="bg-red-500/20 border border-red-500 rounded-xl p-3 mb-4">
      <Text className="text-red-500 text-center">{message}</Text>
    </View>
  );
}
