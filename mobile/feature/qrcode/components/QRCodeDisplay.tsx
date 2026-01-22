import { View, Text } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { QR_CODE_CONFIG } from "../constants";

interface QRCodeDisplayProps {
  walletAddress: string;
}

export default function QRCodeDisplay({ walletAddress }: QRCodeDisplayProps) {
  return (
    <View className="mt-16 items-center">
      {walletAddress ? (
        <QRCode
          value={walletAddress}
          size={QR_CODE_CONFIG.size}
          backgroundColor={QR_CODE_CONFIG.backgroundColor}
          color={QR_CODE_CONFIG.color}
        />
      ) : (
        <View className="w-[250px] h-[250px] bg-gray-100 rounded-lg items-center justify-center">
          <Text className="text-gray-400">No wallet connected</Text>
        </View>
      )}
    </View>
  );
}
