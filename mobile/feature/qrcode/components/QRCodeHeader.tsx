import { View, Text } from "react-native";
import { AntDesign } from "@expo/vector-icons";

interface QRCodeHeaderProps {
  onBack: () => void;
}

export default function QRCodeHeader({ onBack }: QRCodeHeaderProps) {
  return (
    <>
      <View className="h-20" />
      <View className="mx-2 flex-row justify-between items-center">
        <AntDesign name="left" color="black" size={25} onPress={onBack} />
        <Text className="text-black text-[22px] font-extrabold">QR Code</Text>
        <View className="w-[25px]" />
      </View>
    </>
  );
}
