import { View } from "react-native";
import ShareQRCodeModal from "@/components/customer/ShareQRCodeModal";
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
    modalVisible,
    copyToClipboard,
    formatAddress,
    handleGoBack,
    closeShareModal,
  } = useQRCode();

  return (
    <View className="w-full h-full px-4 bg-white">
      <QRCodeHeader onBack={handleGoBack} />

      <QRCodeDisplay walletAddress={walletAddress} />

      <QRCodeInfo />

      <CopyAddressButton
        address={walletAddress}
        formattedAddress={formatAddress(walletAddress)}
        copied={copied}
        onPress={copyToClipboard}
      />

      <ShareQRCodeModal
        visible={modalVisible}
        requestClose={closeShareModal}
        walletAddress={walletAddress}
      />
    </View>
  );
}
