'use client';

import React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { useWalletDetection } from "@/hooks/useWalletDetection";
import { useAuthStore } from "@/stores/authStore";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

// Critical above-the-fold sections - load immediately
import NewHeroSection from "@/components/landing-v2/HeroSection";
import WhatIsRepairCoin from "@/components/landing-v2/WhatIsRepairCoin";

// Below-the-fold sections - lazy load with dynamic imports
const HowItWorks = dynamic(() => import("@/components/landing-v2/HowItWorks"), { ssr: true });
const ShareRewards = dynamic(() => import("@/components/landing-v2/ShareRewards"), { ssr: true });
const LoyaltyTiers = dynamic(() => import("@/components/landing-v2/LoyaltyTiers"), { ssr: true });
const FindAndRedeem = dynamic(() => import("@/components/landing-v2/FindAndRedeem"), { ssr: true });
const RedemptionControl = dynamic(() => import("@/components/landing-v2/RedemptionControl"), { ssr: true });
const ShopTiers = dynamic(() => import("@/components/landing-v2/ShopTiers"), { ssr: true });
const UseRewardsAnywhere = dynamic(() => import("@/components/landing-v2/UseRewardsAnywhere"), { ssr: true });
const WalletControl = dynamic(() => import("@/components/landing-v2/WalletControl"), { ssr: true });
const CommunityDriven = dynamic(() => import("@/components/landing-v2/CommunityDriven"), { ssr: true });
const FAQ = dynamic(() => import("@/components/landing-v2/FAQ"), { ssr: true });

export default function LandingPageNew() {
  const router = useRouter();
  const account = useActiveAccount();
  const { isAuthenticated } = useAuthStore();
  const { walletType, isRegistered, isDetecting, isRateLimited, rateLimitMessage } = useWalletDetection();
  const redirectAttemptedRef = React.useRef(false);
  const [isRedirecting, setIsRedirecting] = React.useState(false);

  // Auto-redirect registered users to their dashboard
  React.useEffect(() => {
    if (redirectAttemptedRef.current) {
      return;
    }

    if (account && isRegistered && isAuthenticated && !isDetecting && walletType !== 'unknown') {
      redirectAttemptedRef.current = true;
      setIsRedirecting(true);

      const targetPath = walletType === "admin" ? "/admin" :
                        walletType === "shop" ? "/shop" :
                        "/customer";

      router.push(targetPath);
    }
  }, [account, isRegistered, isAuthenticated, isDetecting, walletType, router]);

  const handleGetStarted = React.useCallback(() => {
    if (!account) {
      return;
    }

    // Don't redirect if rate limited - show error instead
    if (isRateLimited) {
      alert(rateLimitMessage || 'Too many requests. Please wait a few minutes and try again.');
      return;
    }

    setIsRedirecting(true);

    if (isRegistered) {
      switch (walletType) {
        case "admin":
          router.push("/admin");
          break;
        case "shop":
          router.push("/shop?tab=profile");
          break;
        case "customer":
          router.push("/customer");
          break;
      }
    } else {
      router.push("/choose");
    }
  }, [account, isRegistered, isRateLimited, rateLimitMessage, walletType, router]);

  return (
    <main className="bg-[#191919] min-h-screen overflow-x-clip">
      <Header />

      {/* Hero Section */}
      <NewHeroSection
        hasWallet={!!account}
        isDetecting={isDetecting}
        isRegistered={isRegistered}
        isAuthenticated={isAuthenticated}
        isRedirecting={isRedirecting}
        onGetStartedClick={handleGetStarted}
      />

      {/* What is RepairCoin */}
      <WhatIsRepairCoin />

      {/* How It Works */}
      <HowItWorks />

      {/* Share the Rewards */}
      <ShareRewards />

      {/* Loyalty Tiers */}
      <LoyaltyTiers />

      {/* Find and Redeem at Partner Shops */}
      <FindAndRedeem />

      {/* You Control Every Redemption */}
      <RedemptionControl />

      {/* Verified by Governance - Shop Tiers */}
      <ShopTiers />

      {/* Use Your Rewards Anywhere */}
      <UseRewardsAnywhere />

      {/* Your Wallet. Your Control */}
      <WalletControl />

      {/* Community Driven */}
      <CommunityDriven />

      {/* FAQ */}
      <FAQ />

      <Footer />
    </main>
  );
}
