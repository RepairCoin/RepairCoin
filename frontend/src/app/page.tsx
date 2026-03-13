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
import HeroSection from "@/components/landing-v2/HeroSection";
import WhatIsRepairCoin from "@/components/landing-v2/WhatIsRepairCoin";

// Below-the-fold sections - lazy load with dynamic imports
const HowItWorks = dynamic(() => import("@/components/landing-v2/HowItWorks"), { ssr: true });
const WhosItFor = dynamic(() => import("@/components/landing-v2/WhosItFor"), { ssr: true });
const Proof = dynamic(() => import("@/components/landing-v2/Proof"), { ssr: true });
const IndustriesAndWhy = dynamic(() => import("@/components/landing-v2/IndustriesAndWhy"), { ssr: true });
const CTASection = dynamic(() => import("@/components/landing-v2/CTASection"), { ssr: true });

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
    <main className="bg-[#0a0a0a] min-h-screen overflow-x-clip">
      <Header />

      {/* Section 1: Hero */}
      <HeroSection
        hasWallet={!!account}
        isDetecting={isDetecting}
        isRegistered={isRegistered}
        isAuthenticated={isAuthenticated}
        isRedirecting={isRedirecting}
        onGetStartedClick={handleGetStarted}
      />

      {/* Section 2: What is RepairCoin */}
      <WhatIsRepairCoin />

      {/* Section 3: How RepairCoin Works */}
      <div id="how-it-works">
        <HowItWorks />
      </div>

      {/* Section 4: Who's It For + Trust & Security */}
      <div id="security">
        <WhosItFor />
      </div>

      {/* Section 5: Proof */}
      <Proof />

      {/* Section 6: Industries & Why RepairCoin */}
      <div id="why-repaircoin">
        <IndustriesAndWhy />
      </div>

      {/* Section 7: CTA + Footer */}
      <CTASection />
      <Footer />
    </main>
  );
}
