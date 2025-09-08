import { View, Text } from "react-native";

const FooterNote = ({ className = "" }: { className?: string }) => (
  <View className={`mt-auto mb-6 items-center px-6 ${className}`}>
    <Text className="text-center text-xs text-zinc-400">
      By using ReparCoin, you agree to the{" "}
      <Text className="text-zinc-600 underline">Terms</Text> and{" "}
      <Text className="text-zinc-600 underline">Privacy Policy</Text>
    </Text>
  </View>
);

export default FooterNote;