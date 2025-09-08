import { Pressable, Text } from "react-native";

export default function PrimaryButton({
  label,
  onPress,
  disabled,
  className = "",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`items-center justify-center rounded-2xl py-4 ${
        disabled ? "bg-yellow-300" : "bg-yellow-400 active:opacity-90"
      } ${className}`}
    >
      <Text className="font-semibold text-zinc-900">{label}</Text>
    </Pressable>
  );
}
