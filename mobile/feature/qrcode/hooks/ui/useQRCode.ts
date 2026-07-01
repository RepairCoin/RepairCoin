import { useState, useRef } from "react";
import { Alert } from "react-native";
import { goBack } from "expo-router/build/global-state/routing";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { COPY_FEEDBACK_DURATION } from "@/shared/constants/qrCode";

type QRCodeRef = {
  toDataURL: (callback: (data: string) => void) => void;
};

export function useQRCode() {
  const [copied, setCopied] = useState(false);
  const { account, userProfile } = useAuthStore();
  const qrRef = useRef<QRCodeRef | null>(null);

  const walletAddress = account?.address || userProfile?.address || "";

  const copyToClipboard = async () => {
    if (walletAddress) {
      await Clipboard.setStringAsync(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), COPY_FEEDBACK_DURATION);
    }
  };

  const formatAddress = (address: string) => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleGoBack = () => {
    goBack();
  };

  const handleDownload = async () => {
    if (!walletAddress || !qrRef.current) return;

    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Please allow access to your photo library to save the QR code.");
      return;
    }

    qrRef.current.toDataURL(async (data: string) => {
      try {
        const uri = `${FileSystem.cacheDirectory}repaircoin-qrcode.png`;
        await FileSystem.writeAsStringAsync(uri, data, {
          encoding: FileSystem.EncodingType.Base64,
        });
        await MediaLibrary.saveToLibraryAsync(uri);
        Alert.alert("Saved", "QR code image saved to your photo library.");
      } catch {
        Alert.alert("Error", "Failed to save QR code. Please try again.");
      }
    });
  };

  return {
    walletAddress,
    copied,
    copyToClipboard,
    formatAddress,
    handleGoBack,
    handleDownload,
    qrRef,
  };
}
