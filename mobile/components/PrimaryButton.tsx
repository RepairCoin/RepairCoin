import { Pressable, Text } from "react-native";

type Props = {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  className?: string;
}

export default function PrimaryButton({
  title, onPress, disabled, className
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`w-full items-center justify-center rounded-2xl py-4 bg-[#FFCC00] ${className}`}
      style={{ minHeight: 50 }}
      android_ripple={{ color: 'rgba(0,0,0,0.08)', borderless: false }}
    >
      <Text className="text-lg font-extrabold text-black">{title}</Text>
    </Pressable>
  );
}
