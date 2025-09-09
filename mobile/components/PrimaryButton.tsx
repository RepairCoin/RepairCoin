import { Pressable, Text } from "react-native";

type Props = {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
}

export default function PrimaryButton({
  title, onPress, disabled
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="w-full items-center justify-center rounded-2xl bg-rc-yellow py-4 active:opacity-90"
      style={{ minHeight: 56 }}
      android_ripple={{ color: 'rgba(0,0,0,0.08)', borderless: false }}
    >
      <Text className="text-base font-semibold text-black">{title}</Text>
    </Pressable>
  );
}
