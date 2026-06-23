import { useState } from "react";
import { Share } from "react-native";
import { goBack } from "expo-router/build/global-state/routing";
import * as Clipboard from "expo-clipboard";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { COPY_FEEDBACK_DURATION } from "@/shared/constants/qrCode";

export function useQRCode() {
  const [copied, setCopied] = useState(false);
  const { account, userProfile } = useAuthStore();

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

  const handleShare = async () => {
    if (!walletAddress) return;
    try {
      await Share.share({
        message: walletAddress,
        title: "My RepairCoin QR Code",
      });
    } catch {
      // user dismissed — no-op
    }
  };

  return {
    walletAddress,
    copied,
    copyToClipboard,
    formatAddress,
    handleGoBack,
    handleShare,
  };
}
