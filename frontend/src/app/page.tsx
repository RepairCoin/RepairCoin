'use client';

import React from "react";
import { useRouter } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { useWalletDetection } from "@/hooks/useWalletDetection";
import { useAuthStore } from "@/stores/authStore";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

// New landing page sections
import NewHeroSection from "@/components/landing-v2/HeroSection";
import WhatIsRepairCoin from "@/components/landing-v2/WhatIsRepairCoin";
import HowItWorks from "@/components/landing-v2/HowItWorks";
import ShareRewards from "@/components/landing-v2/ShareRewards";
import LoyaltyTiers from "@/components/landing-v2/LoyaltyTiers";
import FindAndRedeem from "@/components/landing-v2/FindAndRedeem";
import RedemptionControl from "@/components/landing-v2/RedemptionControl";
import ShopTiers from "@/components/landing-v2/ShopTiers";
import UseRewardsAnywhere from "@/components/landing-v2/UseRewardsAnywhere";
import WalletControl from "@/components/landing-v2/WalletControl";
import CommunityDriven from "@/components/landing-v2/CommunityDriven";
import FAQ from "@/components/landing-v2/FAQ";

export default function LandingPageNew() {
  const router = useRouter();
  const account = useActiveAccount();
  const { isAuthenticated } = useAuthStore();
  const { walletType, isRegistered, isDetecting } = useWalletDetection();
  const redirectAttemptedRef = React.useRef(false);
  const [isRedirecting, setIsRedirecting] = React.useState(false);

  // Auto-redirect registered users to their dashboard
  React.useEffect(() => {
    if (redirectAttemptedRef.current) {
      return;
    }

    if (account && isRegistered && isAuthenticated && !isDetecting && walletType !== 'unknown') {
      console.log('🔄 [LandingPage] Auto-redirecting authenticated user to:', walletType);
      redirectAttemptedRef.current = true;
      setIsRedirecting(true);

      const targetPath = walletType === "admin" ? "/admin" :
                        walletType === "shop" ? "/shop" :
                        "/customer";

      router.push(targetPath);
    }
  }, [account, isRegistered, isAuthenticated, isDetecting, walletType, router]);

  const handleGetStarted = () => {
    if (!account) {
      return;
    }

    setIsRedirecting(true);

    if (isRegistered) {
      switch (walletType) {
        case "admin":
          router.push("/admin");
          break;
        case "shop":
          router.push("/shop");
          break;
        case "customer":
          router.push("/customer");
          break;
      }
    } else {
      router.push("/choose");
    }
  };

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
