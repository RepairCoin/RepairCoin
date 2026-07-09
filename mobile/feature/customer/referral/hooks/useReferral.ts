import { useEffect, useState, useCallback } from "react";
import { Share, Linking } from "react-native";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { useAppToast } from "@/shared/hooks";
import { REFERRER_REWARD, COPY_FEEDBACK_DURATION } from "@/shared/constants/referral";
import { useCustomer } from "../../profile/hooks/useCustomer";
import { customerApi } from "../../profile/services/customer.services";

export function useReferral() {
  const { account } = useAuthStore();
  const { useGetCustomerByWalletAddress } = useCustomer();
  const { data: customerData, refetch } = useGetCustomerByWalletAddress(account?.address);
  const { showWarning } = useAppToast();

  const [codeCopied, setCodeCopied] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  const profileCode = customerData?.customer?.referralCode;
  const referralCode = profileCode || generatedCode || "Generating...";

  // Auto-generate code for new accounts that don't have one yet
  const generateCode = useCallback(async () => {
    if (profileCode || generatingCode || !account?.address) return;
    setGeneratingCode(true);
    try {
      const code = await customerApi.generateReferralCode();
      if (code) {
        setGeneratedCode(code);
        refetch();
      }
    } catch (error) {
      console.error("Failed to generate referral code:", error);
    } finally {
      setGeneratingCode(false);
    }
  }, [profileCode, generatingCode, account?.address, refetch]);

  useEffect(() => {
    if (customerData && !profileCode) {
      generateCode();
    }
  }, [customerData, profileCode, generateCode]);
  const totalReferrals = customerData?.customer?.referralCount || 0;
  const totalEarned = totalReferrals * REFERRER_REWARD;

  const referralMessage = `Join FixFlow and earn rewards on every repair! Use my referral code: ${referralCode} to get 10 RCN bonus on your first repair. Download now!`;

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
    Linking.openURL(url).catch(() => {
      showWarning("WhatsApp is not installed on this device.");
    });
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

  const handleFacebookShare = async () => {
    await Clipboard.setStringAsync(referralMessage);
    showWarning("Message copied — paste it as your caption on Facebook.");
    const shareLink = "https://repaircoin.ai";
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareLink)}`;
    await WebBrowser.openBrowserAsync(url);
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
