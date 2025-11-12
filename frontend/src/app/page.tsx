'use client';

import React, { useState, useTransition } from "react";
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
  const [isRedirecting, setIsRedirecting] = React.useState(false);
  const [, startTransition] = useTransition();

  // Auto-redirect registered users to their dashboard
  // IMPORTANT: Only redirect if user is authenticated (has valid session)
  React.useEffect(() => {
    // Prevent multiple redirect attempts using ref (persists across renders)
    if (redirectAttemptedRef.current || isRedirecting) {
      return;
    }

    // Use isAuthenticated from authStore instead of trying to read httpOnly cookies
    // (httpOnly cookies cannot be read by JavaScript - that's the security feature!)
    if (account && isRegistered && isAuthenticated && !isDetecting && walletType !== 'unknown') {
      console.log('🔄 [LandingPage] Auto-redirecting authenticated user to:', walletType);
      redirectAttemptedRef.current = true;
      setIsRedirecting(true);

      const targetPath = walletType === "admin" ? "/admin" :
                        walletType === "shop" ? "/shop" :
                        "/customer";

      // Use startTransition to ensure the navigation completes
      startTransition(() => {
        router.replace(targetPath);
      });
    }
  }, [account, isRegistered, isAuthenticated, isDetecting, walletType, router, isRedirecting]);

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

  // Show minimal loading state while redirecting
  if (isRedirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFCC00] mx-auto"></div>
          <p className="mt-4 text-white">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

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