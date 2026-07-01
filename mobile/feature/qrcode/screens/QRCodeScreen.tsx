import { View } from "react-native";
import { useQRCode } from "../hooks";
import {
  QRCodeHeader,
  QRCodeDisplay,
  QRCodeInfo,
  CopyAddressButton,
} from "../components";

export default function QRCodeScreen() {
  const {
    walletAddress,
    copied,
    copyToClipboard,
    formatAddress,
    handleGoBack,
    handleDownload,
    qrRef,
  } = useQRCode();

  return (
    <View className="w-full h-full px-4 bg-white">
      <QRCodeHeader onBack={handleGoBack} onDownload={handleDownload} />

      <QRCodeDisplay walletAddress={walletAddress} qrRef={qrRef} />

      <QRCodeInfo />

      <CopyAddressButton
        address={walletAddress}
        formattedAddress={formatAddress(walletAddress)}
        copied={copied}
        onPress={copyToClipboard}
      />
    </View>
  );
}
