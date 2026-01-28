import { Pressable, Text, ActivityIndicator, View } from "react-native";

type Props = {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  className?: string;
  loading?: boolean;
}

export default function PrimaryButton({
  title, onPress, disabled, className, loading
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={`w-full items-center justify-center rounded-2xl py-4 ${disabled || loading ? 'bg-[#FFCC00]/20' : 'bg-[#FFCC00]'} ${className}`}
      style={{ minHeight: 50 }}
      android_ripple={{ color: 'rgba(0,0,0,0.08)', borderless: false }}
    >
      <View className="flex-row items-center">
        {loading && (
          <ActivityIndicator size="small" color="#000" className="mr-2" />
        )}
        <Text className="text-lg font-extrabold text-black">{title}</Text>
      </View>
    </Pressable>
  );
}
