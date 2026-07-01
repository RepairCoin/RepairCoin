import { View, Text, TouchableOpacity } from "react-native";
import { AntDesign } from "@expo/vector-icons";
import { Ionicons } from "@expo/vector-icons";

interface QRCodeHeaderProps {
  onBack: () => void;
  onDownload: () => void;
}

export default function QRCodeHeader({ onBack, onDownload }: QRCodeHeaderProps) {
  return (
    <>
      <View className="h-20" />
      <View className="mx-2 flex-row justify-between items-center">
        <AntDesign name="left" color="black" size={25} onPress={onBack} />
        <Text className="text-black text-[22px] font-extrabold">QR Code</Text>
        <TouchableOpacity onPress={onDownload} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="download-outline" size={25} color="black" />
        </TouchableOpacity>
      </View>
    </>
  );
}
