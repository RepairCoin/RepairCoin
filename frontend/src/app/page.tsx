'use client';

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { useWalletDetection } from "@/hooks/useWalletDetection";
import HowAndWhy from "@/components/landing/HowAndWhy";
import FindARepairCoin from "@/components/landing/FindARepairCoin";
import SuccessStories from "@/components/landing/SuccessStories";
import CommunityBanner from "@/components/CommunityBanner";
import LandingHero from "@/components/landing/LandingHero";
import { useAuthStore } from "@/stores/authStore";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function LandingPage() {
  const router = useRouter();
  const account = useActiveAccount();
  const { isAuthenticated } = useAuthStore();
  const { walletType, isRegistered, isDetecting } = useWalletDetection();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const redirectAttemptedRef = React.useRef(false);

  // Auto-redirect registered users to their dashboard
  // Middleware protection is disabled for cross-domain setup, so client-side handles it
  React.useEffect(() => {
    // Prevent multiple redirect attempts
    if (redirectAttemptedRef.current) {
      return;
    }

    // Only redirect authenticated users with complete wallet detection
    if (account && isRegistered && isAuthenticated && !isDetecting && walletType !== 'unknown') {
      console.log('🔄 [LandingPage] Auto-redirecting authenticated user to:', walletType);
      redirectAttemptedRef.current = true;

      const targetPath = walletType === "admin" ? "/admin" :
                        walletType === "shop" ? "/shop" :
                        "/customer";

      // Use Next.js router for client-side navigation
      router.push(targetPath);
    }
  }, [account, isRegistered, isAuthenticated, isDetecting, walletType, router]);

  const handleGetStarted = () => {
    if (!account) {
      // If no wallet connected, the ConnectButton will handle it
      return;
    }

    if (isRegistered) {
      // Already registered, route to appropriate dashboard
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
      // New wallet, go to choose page
      router.push("/choose");
    }
  };

  const handleAuthConnect = () => {
    setShowAuthModal(false);
    // Redirect logic is now handled inside DualAuthConnect component
  };

  const handleAuthError = (error: any) => {
    console.log("Connection error:", error);
  };

  const getStatusMessage = () => {
    if (account && !isDetecting && !isRegistered) {
      return (
        <p className="text-blue-200 text-sm">
          <span className="font-semibold">New wallet detected!</span>{" "}
          Click "Get Started" to choose how you want to participate in
          RepairCoin.
        </p>
      );
    }
    return null;
  };

  return (
    <main>
      <Header />
      <LandingHero
        backgroundImage="/img/hero-bg.png"  
        techBgImage="/img/tech-bg.png"
        hero1BgImage="/img/hero1-bg.png"
        hasWallet={!!account}
        isDetecting={isDetecting}
        isRegistered={isRegistered}
        isAuthenticated={isAuthenticated}
        showAuthModal={showAuthModal}
        onGetStartedClick={handleGetStarted}
        onAuthModalOpen={() => setShowAuthModal(true)}
        onAuthModalClose={() => setShowAuthModal(false)}
        onAuthConnect={handleAuthConnect}
        onAuthError={handleAuthError}
        statusMessage={getStatusMessage()}
      />
      <HowAndWhy 
        techBgImage="/img/tech-bg.png"
      />
      <FindARepairCoin 
        chainBgImage="/img/chain.png"
      />
      <SuccessStories 
        successStoriesBgImage="/img/success-stories-bg.png"
      />
      <CommunityBanner 
        communityBannerBgImage="/img/community-chain.png"
        bannerChainImage="/img/banner-chain.png"
      />
      <Footer />
    </main>
  );
}