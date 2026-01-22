import { useState } from "react";
import { goBack } from "expo-router/build/global-state/routing";
import * as Clipboard from "expo-clipboard";
import { useAuthStore } from "@/store/auth.store";
import { COPY_FEEDBACK_DURATION } from "../../constants";

export function useQRCode() {
  const [modalVisible, setModalVisible] = useState(false);
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

  const openShareModal = () => {
    setModalVisible(true);
  };

  const closeShareModal = () => {
    setModalVisible(false);
  };

  return {
    walletAddress,
    copied,
    modalVisible,
    copyToClipboard,
    formatAddress,
    handleGoBack,
    openShareModal,
    closeShareModal,
  };
}
