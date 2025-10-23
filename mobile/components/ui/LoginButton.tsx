import { Image, Pressable, Text } from "react-native";

type Props = {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  className?: string;
  icon?: any;
}

export default function LoginButton({
  title, onPress, disabled, className, icon
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`flex-row w-[95%] items-center justify-center rounded-2xl my-4 bg-white`}
      style={{ minHeight: 50 }}
      android_ripple={{ color: 'rgba(0,0,0,0.08)', borderless: false }}
    >
      <Image source={icon} className={`mr-2 ${className}`} />
      <Text className="text-lg font-extrabold">{title}</Text>
    </Pressable>
  );
}
