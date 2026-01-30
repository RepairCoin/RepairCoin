import { View, ActivityIndicator } from "react-native";

type LoadingFooterProps = {
  isLoading: boolean;
};

export default function LoadingFooter({ isLoading }: LoadingFooterProps) {
  if (!isLoading) return null;

  return (
    <View className="py-4">
      <ActivityIndicator color="#FFCC00" />
    </View>
  );
}
