import { View, Text } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { QR_CODE_CONFIG } from "@/shared/constants/qrCode";

type QRCodeRef = {
  toDataURL: (callback: (data: string) => void) => void;
};

interface QRCodeDisplayProps {
  walletAddress: string;
  qrRef?: { current: QRCodeRef | null };
}

export default function QRCodeDisplay({ walletAddress, qrRef }: QRCodeDisplayProps) {
  return (
    <View className="mt-16 items-center">
      {walletAddress ? (
        <QRCode
          value={walletAddress}
          size={QR_CODE_CONFIG.size}
          backgroundColor={QR_CODE_CONFIG.backgroundColor}
          color={QR_CODE_CONFIG.color}
          getRef={(c) => {
            if (qrRef && c) qrRef.current = c as QRCodeRef;
          }}
        />
      ) : (
        <View className="w-[250px] h-[250px] bg-gray-100 rounded-lg items-center justify-center">
          <Text className="text-gray-400">No wallet connected</Text>
        </View>
      )}
    </View>
  );
}
