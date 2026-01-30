import { View, Text } from "react-native";

type SystemMessageProps = {
  text: string;
};

export default function SystemMessage({ text }: SystemMessageProps) {
  return (
    <View className="items-center my-2">
      <View className="bg-zinc-800 px-4 py-2 rounded-lg max-w-[80%]">
        <Text className="text-xs text-zinc-400 text-center">{text}</Text>
      </View>
    </View>
  );
}
