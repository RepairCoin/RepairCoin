import { useEffect, useState } from "react";
import { Share, Alert, Linking } from "react-native";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { useAuthStore } from "@/shared/store/auth.store";
import { useCustomer } from "@/shared/hooks/customer/useCustomer";
import { REFERRER_REWARD, COPY_FEEDBACK_DURATION } from "../../constants";

export function useReferral() {
  const { account } = useAuthStore();
  const { useGetCustomerByWalletAddress } = useCustomer();
  const { data: customerData } = useGetCustomerByWalletAddress(account?.address);

  const [codeCopied, setCodeCopied] = useState(false);

  const referralCode = customerData?.customer?.referralCode || "LOADING...";
  const totalReferrals = customerData?.customer?.referralCount || 0;
  const totalEarned = totalReferrals * REFERRER_REWARD;

  const referralMessage = `Join RepairCoin and earn rewards on every repair! Use my referral code: ${referralCode} to get 10 RCN bonus on your first repair. Download now!`;

  useEffect(() => {
    if (codeCopied) {
      const timer = setTimeout(() => {
        setCodeCopied(false);
      }, COPY_FEEDBACK_DURATION);
      return () => clearTimeout(timer);
    }
  }, [codeCopied]);

  const handleCopyCode = async () => {
    if (referralCode && referralCode !== "LOADING...") {
      await Clipboard.setStringAsync(referralCode);
      setCodeCopied(true);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: referralMessage,
      });
    } catch (error) {
      console.log("Error sharing:", error);
    }
  };

  const handleWhatsAppShare = () => {
    const url = `whatsapp://send?text=${encodeURIComponent(referralMessage)}`;
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Alert.alert("WhatsApp not installed", "Please install WhatsApp to share.");
        }
      })
      .catch((err) => console.log("WhatsApp error:", err));
  };

  const handleTwitterShare = () => {
    const url = `twitter://post?message=${encodeURIComponent(referralMessage)}`;
    const webUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(referralMessage)}`;

    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Linking.openURL(webUrl);
        }
      })
      .catch(() => Linking.openURL(webUrl));
  };

  const handleFacebookShare = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(referralMessage)}`;
    Linking.openURL(url);
  };

  const handleGoBack = () => {
    router.back();
  };

  return {
    referralCode,
    totalReferrals,
    totalEarned,
    codeCopied,
    handleCopyCode,
    handleShare,
    handleWhatsAppShare,
    handleTwitterShare,
    handleFacebookShare,
    handleGoBack,
  };
}
